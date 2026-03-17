import { PrismaClient, PrintingMethod, EquipmentStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Remove non-connected equipment
async function cleanup() {
  const del = await prisma.equipment.deleteMany({
    where: { name: { in: ['Laminator', 'Screen Print Press'] } },
  });
  if (del.count > 0) console.log(`Removed ${del.count} non-connected equipment`);
}

const equipment = [
  // === WORKSTATIONS (Computers running RIP / control software) ===
  {
    name: 'Flatbed Computer (WILDE-FLATBEDPC)',
    type: 'Workstation',
    manufacturer: 'Dell',
    station: PrintingMethod.FLATBED,
    status: EquipmentStatus.OPERATIONAL,
    ipAddress: '192.168.254.53',
    connectionType: 'SMB',
    location: 'Production Floor',
    notes: 'Flatbed RIP workstation. Runs Onyx Thrive for FB700 and FB700_2 print logs.',
  },
  {
    name: 'Roll-to-Roll Computer (WS-RIP2)',
    type: 'Workstation',
    manufacturer: 'Dell',
    station: PrintingMethod.ROLL_TO_ROLL,
    status: EquipmentStatus.OPERATIONAL,
    ipAddress: '192.168.254.77',
    connectionType: 'SMB',
    location: 'Production Floor',
    notes: 'Roll-to-roll RIP workstation. Runs Onyx Thrive for Latex 800W, Latex 570, and Mimaki job logs.',
  },
  {
    name: 'Zund Computer #1',
    type: 'Workstation',
    manufacturer: 'Zund',
    station: PrintingMethod.PRODUCTION,
    status: EquipmentStatus.OPERATIONAL,
    ipAddress: '192.168.254.38',
    connectionType: 'SMB',
    location: 'Production Floor',
    notes: 'Primary Zund control computer. Sends cut files to Zund cutter.',
  },
  {
    name: 'Zund Computer #2',
    type: 'Workstation',
    manufacturer: 'Zund',
    station: PrintingMethod.PRODUCTION,
    status: EquipmentStatus.OPERATIONAL,
    ipAddress: '192.168.254.28',
    connectionType: 'SMB',
    location: 'Production Floor',
    notes: 'Secondary Zund control computer. Statistics DB at \\\\WILDESIGNS-2NDZ\\Statistics\\Statistic.db3.',
  },
  {
    name: 'FedEx Ship Station',
    type: 'Workstation',
    manufacturer: 'Dell',
    station: PrintingMethod.SHIPPING_RECEIVING,
    status: EquipmentStatus.OPERATIONAL,
    ipAddress: '192.168.254.131',
    connectionType: 'SMB',
    location: 'Shipping Dept',
    notes: 'FedEx Ship Manager on WS-FEDEX1. Handles all outbound shipments.',
  },

  // === PRINTERS (Actual physical print devices) ===
  {
    name: 'HP Latex 800W',
    type: 'Printer',
    manufacturer: 'HP',
    model: 'Latex 800W',
    station: PrintingMethod.ROLL_TO_ROLL,
    status: EquipmentStatus.OPERATIONAL,
    ipAddress: '192.168.254.42',
    connectionType: 'HTTP',
    location: 'Production Floor',
    notes: 'Roll-to-roll latex printer. EWS live data available. RIP on WS-RIP2 (.77).',
  },
  {
    name: 'HP Scitex FB700',
    type: 'Printer',
    manufacturer: 'HP',
    model: 'Scitex FB700',
    station: PrintingMethod.FLATBED,
    status: EquipmentStatus.OPERATIONAL,
    ipAddress: '192.168.254.44',
    connectionType: 'HTTP',
    location: 'Production Floor',
    notes: 'Flatbed UV printer. Print status from event files. RIP on WILDE-FLATBEDPC (.53).',
  },
  {
    name: 'HP Scitex FB700_2',
    type: 'Printer',
    manufacturer: 'HP',
    model: 'Scitex FB700',
    station: PrintingMethod.FLATBED,
    status: EquipmentStatus.OPERATIONAL,
    ipAddress: '192.168.254.46',
    connectionType: 'HTTP',
    location: 'Production Floor',
    notes: 'Second flatbed UV printer. Print status from event files. RIP on WILDE-FLATBEDPC (.53).',
  },
  {
    name: 'HP Latex 570',
    type: 'Printer',
    manufacturer: 'HP',
    model: 'Latex 570',
    station: PrintingMethod.ROLL_TO_ROLL,
    status: EquipmentStatus.OPERATIONAL,
    ipAddress: '192.168.254.40',
    connectionType: 'HTTP',
    location: 'Production Floor',
    notes: 'Roll-to-roll latex printer. LEDM web access for accounting at /hp/device/webAccess/. RIP on WS-RIP2 (.77).',
  },
  {
    name: 'EFI Fiery DFE',
    type: 'Workstation',
    manufacturer: 'EFI',
    model: 'Fiery',
    station: PrintingMethod.FLATBED,
    status: EquipmentStatus.OPERATIONAL,
    ipAddress: '192.168.254.57',
    connectionType: 'SMB',
    location: 'Production Floor',
    notes: 'VUTEk Fiery DFE workstation. JDF metadata on EFI Export Folder share. Controls VUTEk printer at .60.',
  },
  {
    name: 'VUTEk GS3250LX Pro',
    type: 'Printer',
    manufacturer: 'EFI',
    model: 'GS3250LX Pro',
    station: PrintingMethod.FLATBED,
    status: EquipmentStatus.OPERATIONAL,
    ipAddress: '192.168.254.60',
    connectionType: 'SSH',
    location: 'Production Floor',
    notes: 'VUTEk flatbed printer controller (Ubuntu). SSH for ink levels, JMF for status. Fiery DFE at .57.',
  },
];

async function main() {
  await cleanup();
  console.log('Seeding equipment...');
  for (const eq of equipment) {
    const existing = await prisma.equipment.findFirst({ where: { name: eq.name } });
    if (existing) {
      console.log(`  Skipped (exists): ${eq.name}`);
      continue;
    }
    const created = await prisma.equipment.create({ data: eq });
    console.log(`  Created: ${created.name} (${created.id})`);
  }
  const count = await prisma.equipment.count();
  console.log(`\nTotal equipment: ${count}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
