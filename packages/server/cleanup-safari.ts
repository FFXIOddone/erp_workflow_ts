/**
 * Final Safari -> Port City cleanup script
 * Updates any remaining "Safari" references in the database
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Final Safari -> Port City cleanup...\n');

  // Update order notes that reference Safari
  const orderNotes = await prisma.$executeRaw`
    UPDATE "WorkOrder"
    SET notes = REPLACE(notes, 'Safari archive', 'Port City Signs archive')
    WHERE notes LIKE '%Safari archive%'
  `;
  console.log(`Updated ${orderNotes} order notes (Safari archive -> Port City Signs archive)`);
  
  // Update 'imported from Safari' text
  const orderNotes2 = await prisma.$executeRaw`
    UPDATE "WorkOrder"
    SET notes = REPLACE(notes, 'from Safari historical', 'from Port City Signs historical')
    WHERE notes LIKE '%from Safari historical%'
  `;
  console.log(`Updated ${orderNotes2} order notes (from Safari historical -> from Port City Signs historical)`);

  // Update customer notes
  const customerNotes = await prisma.$executeRaw`
    UPDATE "Customer"
    SET notes = REPLACE(notes, 'Safari', 'Port City Signs')
    WHERE notes LIKE '%Safari%'
  `;
  console.log(`Updated ${customerNotes} customer notes`);

  // Update company notes
  const companyNotes = await prisma.$executeRaw`
    UPDATE "Company"
    SET notes = REPLACE(notes, 'Safari', 'Port City Signs')
    WHERE notes LIKE '%Safari%'
  `;
  console.log(`Updated ${companyNotes} company notes`);

  console.log('\n✅ Cleanup complete!');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
