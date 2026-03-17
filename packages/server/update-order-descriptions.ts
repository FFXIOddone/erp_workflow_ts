/**
 * Update Order Descriptions - Remove [Safari] and [Wilde Signs] tags
 * Also update Safari Signs -> Port City Signs
 * 
 * Run: cd packages/server && npx tsx update-order-descriptions.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateOrderDescriptions() {
  console.log('🔧 Starting order description cleanup...\n');

  // Get count of affected orders
  const safariOrders = await prisma.workOrder.count({
    where: {
      description: { contains: '[Safari]' }
    }
  });
  
  const wildeOrders = await prisma.workOrder.count({
    where: {
      description: { contains: '[Wilde Signs]' }
    }
  });

  console.log(`Found ${safariOrders} orders with [Safari] tag`);
  console.log(`Found ${wildeOrders} orders with [Wilde Signs] tag`);

  // Update orders to remove [Safari] tag
  if (safariOrders > 0) {
    const result1 = await prisma.$executeRaw`
      UPDATE "WorkOrder" 
      SET description = REPLACE(description, '[Safari] ', '')
      WHERE description LIKE '%[Safari]%'
    `;
    console.log(`✅ Removed [Safari] from ${result1} orders`);
  }

  // Update orders to remove [Wilde Signs] tag
  if (wildeOrders > 0) {
    const result2 = await prisma.$executeRaw`
      UPDATE "WorkOrder" 
      SET description = REPLACE(description, '[Wilde Signs] ', '')
      WHERE description LIKE '%[Wilde Signs]%'
    `;
    console.log(`✅ Removed [Wilde Signs] from ${result2} orders`);
  }

  // Also handle case without trailing space
  await prisma.$executeRaw`
    UPDATE "WorkOrder" 
    SET description = REPLACE(description, '[Safari]', '')
    WHERE description LIKE '%[Safari]%'
  `;
  
  await prisma.$executeRaw`
    UPDATE "WorkOrder" 
    SET description = REPLACE(description, '[Wilde Signs]', '')
    WHERE description LIKE '%[Wilde Signs]%'
  `;

  // Update company notes that reference Safari Signs
  const notesUpdate = await prisma.$executeRaw`
    UPDATE "Company"
    SET notes = REPLACE(notes, 'Safari Signs', 'Port City Signs')
    WHERE notes LIKE '%Safari Signs%'
  `;
  console.log(`✅ Updated ${notesUpdate} company notes (Safari Signs -> Port City Signs)`);

  // Update any order notes
  const orderNotesUpdate = await prisma.$executeRaw`
    UPDATE "WorkOrder"
    SET notes = REPLACE(notes, 'Safari Signs', 'Port City Signs')
    WHERE notes LIKE '%Safari Signs%'
  `;
  console.log(`✅ Updated ${orderNotesUpdate} order notes (Safari Signs -> Port City Signs)`);

  // Update tags on companies (Safari -> Port City)
  // First get companies with Safari tag
  const companiesWithSafariTag = await prisma.company.findMany({
    where: {
      tags: { has: 'Safari' }
    },
    select: { id: true, tags: true }
  });

  console.log(`\nFound ${companiesWithSafariTag.length} companies with 'Safari' tag`);
  
  for (const company of companiesWithSafariTag) {
    const newTags = company.tags.map(tag => 
      tag === 'Safari' ? 'Port City' : tag
    );
    await prisma.company.update({
      where: { id: company.id },
      data: { tags: newTags }
    });
  }
  console.log(`✅ Updated company tags (Safari -> Port City)`);

  // Also check legacy Customer table if it exists
  try {
    const customerTagsUpdate = await prisma.$executeRaw`
      UPDATE "Customer"
      SET tags = array_replace(tags, 'Safari', 'Port City')
      WHERE 'Safari' = ANY(tags)
    `;
    console.log(`✅ Updated ${customerTagsUpdate} customer tags (Safari -> Port City)`);
  } catch (e) {
    // Customer table might not exist or have different structure
  }

  console.log('\n✅ Order description cleanup complete!');
}

async function main() {
  try {
    await updateOrderDescriptions();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
