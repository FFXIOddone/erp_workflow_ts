/**
 * Customer Migration Script
 * 
 * Migrates real customer and work order data from CUSTOMER_LIST.md into the ERP database.
 * 
 * Features:
 * - Clears test customer data
 * - Parses CUSTOMER_LIST.md to extract customers and work orders
 * - Differentiates between Wilde Signs (5-digit WO#) and Safari (4-digit WO#) orders
 * - Creates customers with placeholder contact info
 * - Creates alerts for customers missing contact information
 * - Imports all historical work orders linked to customers
 * 
 * Run: npx tsx migrate-customers.ts
 */

import { PrismaClient, OrderStatus, PrintingMethod, UserRole, AlertType, AlertSeverity } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

// Track statistics
const stats = {
  customersCreated: 0,
  customersSkipped: 0,
  workOrdersCreated: 0,
  workOrdersSkipped: 0,
  alertsCreated: 0,
  errors: [] as string[],
};

// Parse the CUSTOMER_LIST.md file
function parseCustomerList(filePath: string): Map<string, { name: string; workOrders: { number: string; description: string; source: 'WILDE' | 'SAFARI' }[] }> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const customers = new Map<string, { name: string; workOrders: { number: string; description: string; source: 'WILDE' | 'SAFARI' }[] }>();
  
  let currentCustomer: string | null = null;
  let currentSource: 'WILDE' | 'SAFARI' = 'WILDE';
  
  for (const line of lines) {
    // Check for section header (Wilde vs Safari)
    if (line.includes('## Wilde Orders')) {
      currentSource = 'WILDE';
      continue;
    }
    if (line.includes('## Safari Orders')) {
      currentSource = 'SAFARI';
      continue;
    }
    
    // Check for customer header (### CustomerName)
    if (line.startsWith('### ')) {
      currentCustomer = line.replace('### ', '').trim();
      
      // Normalize customer name (remove special characters, standardize case)
      const normalizedName = normalizeCustomerName(currentCustomer);
      
      if (!customers.has(normalizedName)) {
        customers.set(normalizedName, {
          name: currentCustomer,
          workOrders: [],
        });
      }
      continue;
    }
    
    // Check for work order line (- WO#####_Description)
    if (line.startsWith('- WO') && currentCustomer) {
      const woMatch = line.match(/- (WO\d+)(?:_|-|\.|\s)?(.+)?/i);
      if (woMatch) {
        const woNumber = woMatch[1].toUpperCase();
        const description = woMatch[2]?.trim() || 'Work Order';
        
        const normalizedName = normalizeCustomerName(currentCustomer);
        const customer = customers.get(normalizedName);
        if (customer) {
          customer.workOrders.push({
            number: woNumber,
            description: cleanDescription(description),
            source: currentSource,
          });
        }
      }
    }
  }
  
  return customers;
}

// Normalize customer name for deduplication
function normalizeCustomerName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Clean up work order description
function cleanDescription(desc: string): string {
  return desc
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Determine routing based on description keywords
function determineRouting(description: string): PrintingMethod[] {
  const desc = description.toUpperCase();
  const routing: PrintingMethod[] = [];
  
  // Design is almost always first for custom work
  routing.push(PrintingMethod.DESIGN);
  
  // Check for specific production methods
  if (desc.includes('BANNER') || desc.includes('VINYL') || desc.includes('WRAP') || desc.includes('VEHICLE') || desc.includes('TRUCK') || desc.includes('VAN') || desc.includes('BOAT')) {
    routing.push(PrintingMethod.ROLL_TO_ROLL);
  }
  if (desc.includes('SIGN') || desc.includes('PANEL') || desc.includes('BOARD') || desc.includes('MONUMENT') || desc.includes('PYLON') || desc.includes('BACKLIT')) {
    routing.push(PrintingMethod.FLATBED);
  }
  if (desc.includes('SCREEN') || desc.includes('DECAL') || desc.includes('STICKER') || desc.includes('MAGNET')) {
    routing.push(PrintingMethod.SCREEN_PRINT);
  }
  if (desc.includes('INSTALL') || desc.includes('INSTALLED')) {
    routing.push(PrintingMethod.INSTALLATION);
  }
  
  // Production is always included for finishing work
  routing.push(PrintingMethod.PRODUCTION);
  
  // If nothing matched, add flatbed as default
  if (routing.length === 2) { // Only design and production
    routing.splice(1, 0, PrintingMethod.FLATBED);
  }
  
  return routing;
}

// Clear test customer and work order data
async function clearTestData() {
  console.log('🧹 Clearing test data...');
  
  // First, get all customers that look like test data
  const testCustomers = await prisma.customer.findMany({
    where: {
      OR: [
        { name: { contains: 'Test' } },
        { name: { contains: 'Sample' } },
        { name: { contains: 'Demo' } },
        { email: { contains: '@example.com' } },
        { email: { contains: '@test.com' } },
      ],
    },
    select: { id: true, name: true },
  });
  
  console.log(`   Found ${testCustomers.length} test customers to remove`);
  
  // Delete related records for test customers
  for (const customer of testCustomers) {
    try {
      // Delete in order of dependencies
      await prisma.proofApproval.deleteMany({ where: { workOrder: { customerId: customer.id } } });
      await prisma.stationProgress.deleteMany({ where: { workOrder: { customerId: customer.id } } });
      await prisma.lineItem.deleteMany({ where: { workOrder: { customerId: customer.id } } });
      await prisma.timeEntry.deleteMany({ where: { workOrder: { customerId: customer.id } } });
      await prisma.workEvent.deleteMany({ where: { workOrder: { customerId: customer.id } } });
      await prisma.portalMessage.deleteMany({ where: { customerId: customer.id } });
      await prisma.customerInteraction.deleteMany({ where: { customerId: customer.id } });
      await prisma.customerContact.deleteMany({ where: { customerId: customer.id } });
      await prisma.recurringOrder.deleteMany({ where: { customerId: customer.id } });
      await prisma.portalUser.deleteMany({ where: { customerId: customer.id } });
      await prisma.quote.deleteMany({ where: { customerId: customer.id } });
      await prisma.workOrder.deleteMany({ where: { customerId: customer.id } });
      
      // Now delete the customer
      await prisma.customer.delete({
        where: { id: customer.id },
      });
      console.log(`   ✅ Deleted test customer: ${customer.name}`);
    } catch (e: any) {
      console.log(`   ⚠️ Could not fully delete customer ${customer.name}: ${e.message}`);
    }
  }
  
  // Also delete work orders that are clearly test data
  const testOrders = await prisma.workOrder.deleteMany({
    where: {
      OR: [
        { orderNumber: { startsWith: 'TEST-' } },
        { customerName: { contains: 'Test' } },
        { customerName: { contains: 'Sample' } },
        { description: { contains: '[TEST]' } },
      ],
    },
  });
  
  console.log(`   Deleted ${testOrders.count} test work orders`);
  console.log('✅ Test data cleared\n');
}

// Get or create the admin user for creating alerts
async function getAdminUser(): Promise<string> {
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true },
  });
  
  if (!admin) {
    throw new Error('No admin user found! Please seed the database first.');
  }
  
  return admin.id;
}

// Get a user who can create work orders
async function getCreatorUser(): Promise<string> {
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { role: 'ADMIN' },
        { role: 'MANAGER' },
        { allowedStations: { has: PrintingMethod.ORDER_ENTRY } },
      ],
    },
    select: { id: true },
  });
  
  if (!user) {
    throw new Error('No suitable user found for creating work orders!');
  }
  
  return user.id;
}

// Create a customer
async function createCustomer(name: string, source: 'WILDE' | 'SAFARI'): Promise<string | null> {
  // Check if customer already exists
  const existing = await prisma.customer.findFirst({
    where: {
      OR: [
        { name: { equals: name, mode: 'insensitive' } },
        { companyName: { equals: name, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  });
  
  if (existing) {
    stats.customersSkipped++;
    return existing.id;
  }
  
  try {
    // Determine tags based on source
    const tags = [source === 'SAFARI' ? 'Port City' : 'Wilde Signs'];
    
    // Check if it's a church, school, or other known entity type
    const nameLower = name.toLowerCase();
    if (nameLower.includes('church') || nameLower.includes('ministry') || nameLower.includes('baptist') || nameLower.includes('lutheran') || nameLower.includes('methodist') || nameLower.includes('reformed')) {
      tags.push('Religious Organization');
      tags.push('Tax Exempt');
    }
    if (nameLower.includes('school') || nameLower.includes('academy') || nameLower.includes('university') || nameLower.includes('college')) {
      tags.push('Education');
      tags.push('Tax Exempt');
    }
    if (nameLower.includes('city of') || nameLower.includes('township') || nameLower.includes('county') || nameLower.includes('state of')) {
      tags.push('Government');
      tags.push('Tax Exempt');
    }
    if (nameLower.includes('inc') || nameLower.includes('llc') || nameLower.includes('corp') || nameLower.includes('company') || nameLower.includes('co.')) {
      tags.push('Corporation');
    }
    
    const customer = await prisma.customer.create({
      data: {
        name: name,
        companyName: name,
        notes: `Imported from ${source === 'SAFARI' ? 'Port City Signs' : 'Wilde Signs'} historical records. Contact information needs verification.`,
        tags: tags,
        taxExempt: tags.includes('Tax Exempt'),
        paymentTerms: 'Net 30',
        isActive: true,
      },
    });
    
    stats.customersCreated++;
    return customer.id;
  } catch (error: any) {
    stats.errors.push(`Customer "${name}": ${error.message}`);
    return null;
  }
}

// Create a work order
async function createWorkOrder(
  customerId: string,
  customerName: string,
  woNumber: string,
  description: string,
  source: 'WILDE' | 'SAFARI',
  creatorId: string
): Promise<boolean> {
  // Check if work order already exists
  const existing = await prisma.workOrder.findUnique({
    where: { orderNumber: woNumber },
    select: { id: true },
  });
  
  if (existing) {
    stats.workOrdersSkipped++;
    return false;
  }
  
  try {
    // Determine routing based on description
    const routing = determineRouting(description);
    
    // Parse WO number to estimate date (higher numbers = more recent)
    const woNum = parseInt(woNumber.replace('WO', ''));
    let estimatedDate = new Date();
    
    if (source === 'WILDE') {
      // Wilde WO numbers range from ~13000 to ~61000 over 10+ years
      // Estimate: WO13000 = ~2014, WO61000 = ~2026
      const yearsAgo = Math.max(0, (61000 - woNum) / 4000);
      estimatedDate.setFullYear(estimatedDate.getFullYear() - Math.round(yearsAgo));
    } else {
      // Safari WO numbers range from ~1000 to ~6700 over ~5 years
      const yearsAgo = Math.max(0, (6700 - woNum) / 1200);
      estimatedDate.setFullYear(estimatedDate.getFullYear() - Math.round(yearsAgo));
    }
    
    // Historical orders are completed
    await prisma.workOrder.create({
      data: {
        orderNumber: woNumber,
        customerName: customerName,
        description: description,  // No prefix needed - brand is tracked via companyBrand field
        status: OrderStatus.COMPLETED,
        priority: 3,
        routing: routing,
        isTempOrder: false,
        notes: `Historical order imported from ${source === 'SAFARI' ? 'Port City Signs' : 'Wilde Signs'} archive.`,
        createdAt: estimatedDate,
        updatedAt: estimatedDate,
        createdById: creatorId,
        customerId: customerId,
      },
    });
    
    stats.workOrdersCreated++;
    return true;
  } catch (error: any) {
    stats.errors.push(`Work Order "${woNumber}": ${error.message}`);
    return false;
  }
}

// Create alerts for customers missing contact info
async function createMissingContactAlerts(adminId: string) {
  console.log('📢 Creating alerts for customers missing contact information...\n');
  
  // Find all customers without email or phone
  const customersNeedingAttention = await prisma.customer.findMany({
    where: {
      AND: [
        { email: null },
        { phone: null },
      ],
    },
    select: { id: true, name: true },
  });
  
  console.log(`   Found ${customersNeedingAttention.length} customers needing contact info`);
  
  // Create a single alert for admins, managers, and order entry staff
  if (customersNeedingAttention.length > 0) {
    await prisma.alert.create({
      data: {
        title: '⚠️ Customer Contact Information Needed',
        message: `${customersNeedingAttention.length} customers were imported without contact information (email, phone). Please update customer records when processing orders for these accounts.`,
        type: AlertType.WARNING,
        severity: AlertSeverity.MEDIUM,
        isGlobal: false,
        targetRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR],
        isDismissible: false, // Keep showing until resolved
        showOnPages: ['/sales/customers', '/orders', '/orders/new'],
        createdById: adminId,
      },
    });
    stats.alertsCreated++;
    
    // Also add a note tag to these customers for easy filtering
    for (const customer of customersNeedingAttention) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          tags: {
            push: 'Needs Contact Info',
          },
        },
      });
    }
    
    console.log(`   ✅ Created alert and tagged ${customersNeedingAttention.length} customers with "Needs Contact Info"`);
  }
}

// Main migration function
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('       WILDE SIGNS CUSTOMER & WORK ORDER MIGRATION');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const startTime = Date.now();
  
  try {
    // Step 1: Get admin user
    console.log('🔑 Getting admin user...');
    const adminId = await getAdminUser();
    const creatorId = await getCreatorUser();
    console.log('✅ Admin user found\n');
    
    // Step 2: Clear test data
    await clearTestData();
    
    // Step 3: Parse customer list
    console.log('📄 Parsing CUSTOMER_LIST.md...');
    const listPath = path.join(__dirname, '../docs/CUSTOMER_LIST.md');
    
    if (!fs.existsSync(listPath)) {
      // Try alternative path
      const altPath = path.join(__dirname, '../../docs/CUSTOMER_LIST.md');
      if (!fs.existsSync(altPath)) {
        throw new Error(`Customer list not found at ${listPath} or ${altPath}`);
      }
    }
    
    const customers = parseCustomerList(
      fs.existsSync(path.join(__dirname, '../docs/CUSTOMER_LIST.md'))
        ? path.join(__dirname, '../docs/CUSTOMER_LIST.md')
        : path.join(__dirname, '../../docs/CUSTOMER_LIST.md')
    );
    
    const totalCustomers = customers.size;
    let totalWorkOrders = 0;
    for (const [, data] of customers) {
      totalWorkOrders += data.workOrders.length;
    }
    
    console.log(`   Found ${totalCustomers} unique customers`);
    console.log(`   Found ${totalWorkOrders} work orders\n`);
    
    // Step 4: Create customers and work orders
    console.log('📥 Importing customers and work orders...\n');
    
    let processed = 0;
    for (const [, customerData] of customers) {
      processed++;
      
      // Determine primary source (most work orders)
      const wildeCount = customerData.workOrders.filter(wo => wo.source === 'WILDE').length;
      const safariCount = customerData.workOrders.filter(wo => wo.source === 'SAFARI').length;
      const primarySource = wildeCount >= safariCount ? 'WILDE' : 'SAFARI';
      
      // Create customer
      const customerId = await createCustomer(customerData.name, primarySource);
      
      if (customerId) {
        // Create work orders
        for (const wo of customerData.workOrders) {
          await createWorkOrder(
            customerId,
            customerData.name,
            wo.number,
            wo.description,
            wo.source,
            creatorId
          );
        }
      }
      
      // Progress indicator every 50 customers
      if (processed % 50 === 0) {
        console.log(`   Processed ${processed}/${totalCustomers} customers...`);
      }
    }
    
    console.log(`   Processed ${processed}/${totalCustomers} customers\n`);
    
    // Step 5: Create alerts for missing contact info
    await createMissingContactAlerts(adminId);
    
    // Final summary
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('                      MIGRATION COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Customers created: ${stats.customersCreated}`);
    console.log(`   ⏭️  Customers skipped (already exist): ${stats.customersSkipped}`);
    console.log(`   ✅ Work orders created: ${stats.workOrdersCreated}`);
    console.log(`   ⏭️  Work orders skipped (already exist): ${stats.workOrdersSkipped}`);
    console.log(`   📢 Alerts created: ${stats.alertsCreated}`);
    console.log(`   ⏱️  Time elapsed: ${elapsed}s`);
    
    if (stats.errors.length > 0) {
      console.log(`\n⚠️ Errors (${stats.errors.length}):`);
      stats.errors.slice(0, 10).forEach(err => console.log(`   - ${err}`));
      if (stats.errors.length > 10) {
        console.log(`   ... and ${stats.errors.length - 10} more`);
      }
    }
    
    console.log('\n💡 Next steps:');
    console.log('   1. Review customers tagged with "Needs Contact Info"');
    console.log('   2. Update customer email/phone from QuickBooks or customer calls');
    console.log('   3. Once contact info is saved, the "Needs Contact Info" tag can be removed');
    console.log('   4. The alert will remain visible until all customers have contact info\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
