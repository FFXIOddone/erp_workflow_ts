/**
 * One-time script to enable Production List sync and configure tally paths.
 * 
 * Run: npx tsx packages/server/enable-production-list.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PRODUCTION_LIST_PATH = String.raw`C:\Users\Jake\OneDrive - Wilde Signs\Production List`;

async function main() {
  const settings = await prisma.systemSettings.upsert({
    where: { id: 'system' },
    update: {
      enableProductionListSync: true,
      productionListPath: PRODUCTION_LIST_PATH,
      updatedAt: new Date(),
    },
    create: {
      id: 'system',
      enableProductionListSync: true,
      productionListPath: PRODUCTION_LIST_PATH,
    },
  });

  console.log('✅ Production List sync ENABLED');
  console.log(`   Path: ${settings.productionListPath}`);
  console.log(`   Sync enabled: ${settings.enableProductionListSync}`);

  // Verify tally paths resolve correctly
  const fs = await import('fs');
  const path = await import('path');
  
  const sources = [
    { name: "Brenda's Daily List", folder: "Brenda's Daily List" },
    { name: "Christina's Daily List", folder: "Christina's Daily List" },
    { name: "Pam's Daily List", folder: "Pam's Daily List" },
  ];

  console.log('\n📁 Tally directory check:');
  for (const { name, folder } of sources) {
    const fullPath = path.join(PRODUCTION_LIST_PATH, folder);
    const exists = fs.existsSync(fullPath);
    console.log(`   ${exists ? '✅' : '❌'} ${name}: ${fullPath}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
