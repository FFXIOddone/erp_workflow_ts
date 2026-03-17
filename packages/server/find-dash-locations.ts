import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find all customers with " - " pattern (location separator)
  const customers = await prisma.customer.findMany({
    where: {
      name: { contains: ' - ' },
    },
    select: { 
      name: true,
      _count: { select: { workOrders: true } }
    },
    orderBy: { name: 'asc' },
  });

  console.log(`Found ${customers.length} customers with " - " pattern:\n`);

  // Group by base company name (everything before -)
  const groups = new Map<string, { name: string; count: number }[]>();
  
  for (const c of customers) {
    const match = c.name.match(/^(.+?)\s+-\s+/);
    if (match) {
      const baseName = match[1].trim();
      // Skip very short base names (likely false positives)
      if (baseName.length < 3) continue;
      
      if (!groups.has(baseName)) {
        groups.set(baseName, []);
      }
      groups.get(baseName)!.push({ name: c.name, count: c._count.workOrders });
    }
  }

  // Sort by number of locations (only show groups with 2+ locations)
  const sortedGroups = Array.from(groups.entries())
    .filter(([_, locs]) => locs.length >= 2)
    .sort((a, b) => b[1].length - a[1].length);

  console.log(`Companies with 2+ locations:\n`);

  for (const [baseName, locations] of sortedGroups) {
    const totalOrders = locations.reduce((sum, l) => sum + l.count, 0);
    console.log(`\n${baseName} (${locations.length} locations, ${totalOrders} orders):`);
    
    for (const loc of locations) {
      console.log(`  - ${loc.name} (${loc.count} orders)`);
    }
  }

  await prisma.$disconnect();
}

main();
