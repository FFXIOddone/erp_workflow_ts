import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find all customers with # followed by numbers (store numbers)
  const customers = await prisma.customer.findMany({
    where: {
      name: { contains: '#' },
    },
    select: { 
      name: true,
      _count: { select: { workOrders: true } }
    },
    orderBy: { name: 'asc' },
  });

  console.log(`Found ${customers.length} customers with # in name:\n`);

  // Group by base company name (everything before #)
  const groups = new Map<string, { name: string; count: number }[]>();
  
  for (const c of customers) {
    const match = c.name.match(/^(.+?)\s*#/);
    if (match) {
      const baseName = match[1].trim();
      if (!groups.has(baseName)) {
        groups.set(baseName, []);
      }
      groups.get(baseName)!.push({ name: c.name, count: c._count.workOrders });
    }
  }

  // Sort by number of locations
  const sortedGroups = Array.from(groups.entries())
    .sort((a, b) => b[1].length - a[1].length);

  for (const [baseName, locations] of sortedGroups) {
    const totalOrders = locations.reduce((sum, l) => sum + l.count, 0);
    console.log(`\n${baseName} (${locations.length} locations, ${totalOrders} orders):`);
    
    // Show first 5 examples
    for (const loc of locations.slice(0, 5)) {
      console.log(`  - ${loc.name} (${loc.count} orders)`);
    }
    if (locations.length > 5) {
      console.log(`  ... and ${locations.length - 5} more`);
    }
  }

  await prisma.$disconnect();
}

main();
