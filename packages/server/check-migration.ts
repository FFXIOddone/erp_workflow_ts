import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const companies = await p.company.count();
  const contacts = await p.contact.count();
  const hierarchies = await p.companyHierarchy.count();
  const linkedOrders = await p.workOrder.count({ where: { companyId: { not: null } } });
  const linkedQuotes = await p.quote.count({ where: { companyId: { not: null } } });
  
  console.log('='.repeat(50));
  console.log('MIGRATION RESULTS');
  console.log('='.repeat(50));
  console.log('Companies:', companies);
  console.log('Contacts:', contacts);
  console.log('Company Hierarchies:', hierarchies);
  console.log('Work Orders linked:', linkedOrders);
  console.log('Quotes linked:', linkedQuotes);
  
  // Show sample companies
  console.log('\nSample Companies:');
  const samples = await p.company.findMany({ 
    take: 5,
    include: { contacts: { take: 2 } },
    orderBy: { name: 'asc' }
  });
  for (const c of samples) {
    console.log(`  - ${c.name} (${c.contacts.length} contacts)`);
  }
  
  await p.$disconnect();
}

main();
