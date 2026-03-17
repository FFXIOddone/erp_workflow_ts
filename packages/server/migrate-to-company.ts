/**
 * Migrate Customer data to Company/Contact structure
 * 
 * This script:
 * 1. Creates a Company record for each Customer
 * 2. Creates a Contact record for each Customer that has person info
 * 3. Links WorkOrders, Quotes, etc. to the new Company
 * 4. Migrates CustomerHierarchy to CompanyHierarchy
 */

import { PrismaClient, CustomerRelationType, ContactRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Migrating Customer data to Company/Contact structure');
  console.log('='.repeat(60) + '\n');

  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }

  // Get all customers
  const customers = await prisma.customer.findMany({
    include: {
      contacts: true,
      _count: {
        select: {
          workOrders: true,
          quotes: true,
        },
      },
    },
  });

  console.log(`Found ${customers.length} customers to migrate\n`);

  let companiesCreated = 0;
  let contactsCreated = 0;
  let ordersLinked = 0;
  let quotesLinked = 0;
  let hierarchiesMigrated = 0;

  // Map old customer IDs to new company IDs
  const customerToCompanyMap = new Map<string, string>();

  for (const customer of customers) {
    if (dryRun) {
      console.log(`Would migrate: ${customer.name}`);
      companiesCreated++;
      if (customer.firstName || customer.lastName || customer.primaryContact) {
        contactsCreated++;
      }
      continue;
    }

    // Create Company record
    const company = await prisma.company.create({
      data: {
        name: customer.name,
        legalName: customer.companyName,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        zipCode: customer.zipCode,
        country: customer.country,
        phone: customer.phone,
        fax: customer.fax,
        email: customer.email,
        billToLine1: customer.billToLine1,
        billToLine2: customer.billToLine2,
        billToLine3: customer.billToLine3,
        billToLine4: customer.billToLine4,
        billToLine5: customer.billToLine5,
        shipToLine1: customer.shipToLine1,
        shipToLine2: customer.shipToLine2,
        shipToLine3: customer.shipToLine3,
        shipToLine4: customer.shipToLine4,
        shipToLine5: customer.shipToLine5,
        taxExempt: customer.taxExempt,
        resaleNumber: customer.resaleNumber,
        creditLimit: customer.creditLimit,
        currentBalance: customer.currentBalance,
        paymentTerms: customer.paymentTerms,
        isOnCreditHold: customer.isOnCreditHold,
        creditHoldReason: customer.creditHoldReason,
        creditHoldDate: customer.creditHoldDate,
        accountNumber: customer.accountNumber,
        companyType: customer.customerType,
        salesRep: customer.salesRep,
        salesTaxCode: customer.salesTaxCode,
        taxItem: customer.taxItem,
        tags: customer.tags,
        notes: customer.notes,
        isActive: customer.isActive,
        createdAt: customer.createdAt,
      },
    });

    customerToCompanyMap.set(customer.id, company.id);
    companiesCreated++;

    // Create Contact record if customer has person info
    const hasPersonInfo = customer.firstName || customer.lastName || customer.primaryContact;
    if (hasPersonInfo) {
      // Parse primaryContact if no first/last name
      let firstName = customer.firstName || '';
      let lastName = customer.lastName || '';
      
      if (!firstName && !lastName && customer.primaryContact) {
        const parts = customer.primaryContact.split(' ');
        firstName = parts[0] || 'Unknown';
        lastName = parts.slice(1).join(' ') || '';
      }

      if (firstName || lastName) {
        await prisma.contact.create({
          data: {
            firstName: firstName || 'Unknown',
            lastName: lastName || '',
            salutation: customer.salutation,
            middleInitial: customer.middleInitial,
            title: customer.jobTitle,
            role: ContactRole.PRIMARY,
            isPrimary: true,
            email: customer.email,
            phone: customer.phone,
            mobile: customer.altPhone,
            companyId: company.id,
            createdAt: customer.createdAt,
          },
        });
        contactsCreated++;
      }
    }

    // Also migrate existing CustomerContacts
    for (const contact of customer.contacts) {
      const nameParts = contact.name.split(' ');
      await prisma.contact.create({
        data: {
          firstName: nameParts[0] || 'Unknown',
          lastName: nameParts.slice(1).join(' ') || '',
          title: contact.title,
          role: contact.isPrimary ? ContactRole.PRIMARY : ContactRole.PROJECT_MANAGER,
          isPrimary: contact.isPrimary,
          email: contact.email,
          phone: contact.phone,
          notes: contact.notes,
          companyId: company.id,
        },
      });
      contactsCreated++;
    }

    // Link WorkOrders to Company
    if (customer._count.workOrders > 0) {
      const result = await prisma.workOrder.updateMany({
        where: { customerId: customer.id },
        data: { companyId: company.id },
      });
      ordersLinked += result.count;
    }

    // Link Quotes to Company
    if (customer._count.quotes > 0) {
      const result = await prisma.quote.updateMany({
        where: { customerId: customer.id },
        data: { companyId: company.id },
      });
      quotesLinked += result.count;
    }

    // Link other entities
    await prisma.document.updateMany({
      where: { customerId: customer.id },
      data: { companyId: company.id },
    });

    await prisma.recurringOrder.updateMany({
      where: { customerId: customer.id },
      data: { companyId: company.id },
    });

    await prisma.installationJob.updateMany({
      where: { customerId: customer.id },
      data: { companyId: company.id },
    });

    await prisma.project.updateMany({
      where: { customerId: customer.id },
      data: { companyId: company.id },
    });

    await prisma.portalUser.updateMany({
      where: { customerId: customer.id },
      data: { companyId: company.id },
    });
  }

  // Migrate CustomerHierarchy to CompanyHierarchy
  if (!dryRun) {
    const hierarchies = await prisma.customerHierarchy.findMany();
    
    for (const hierarchy of hierarchies) {
      const parentCompanyId = customerToCompanyMap.get(hierarchy.parentCustomerId);
      const childCompanyId = customerToCompanyMap.get(hierarchy.childCustomerId);
      
      if (parentCompanyId && childCompanyId) {
        await prisma.companyHierarchy.create({
          data: {
            parentCompanyId,
            childCompanyId,
            relationType: hierarchy.relationType,
            effectiveFrom: hierarchy.effectiveFrom,
            effectiveUntil: hierarchy.effectiveUntil,
            isPrimary: hierarchy.isPrimary,
            inheritBilling: hierarchy.inheritBilling,
            inheritPricing: hierarchy.inheritPricing,
            inheritTerms: hierarchy.inheritTerms,
            notes: hierarchy.notes,
          },
        });
        hierarchiesMigrated++;
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Companies created: ${companiesCreated}`);
  console.log(`Contacts created: ${contactsCreated}`);
  console.log(`Work orders linked: ${ordersLinked}`);
  console.log(`Quotes linked: ${quotesLinked}`);
  console.log(`Hierarchies migrated: ${hierarchiesMigrated}`);

  if (dryRun) {
    console.log('\n⚠️  This was a DRY RUN - no changes were made.');
    console.log('Run without --dry-run to apply changes.');
  } else {
    console.log('\n✅ Migration complete!');
    console.log('\nNext steps:');
    console.log('1. Verify data in Company table');
    console.log('2. Update API routes to use Company');
    console.log('3. Update frontend components');
    console.log('4. Eventually remove legacy Customer references');
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Error:', e);
  prisma.$disconnect();
  process.exit(1);
});
