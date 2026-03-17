import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const keywords = ['kwik', 'country fair', 'stop and go', 'stop n go', 'speedway', 'marathon', 'circle k', 'shell'];
  
  for (const keyword of keywords) {
    const customers = await prisma.customer.findMany({
      where: {
        name: { contains: keyword, mode: 'insensitive' },
      },
      select: { name: true },
      orderBy: { name: 'asc' },
    });
    
    if (customers.length > 0) {
      console.log(`\n${keyword.toUpperCase()} (${customers.length} results):`);
      customers.forEach(c => console.log(`  - ${c.name}`));
    }
  }
  
  await prisma.$disconnect();
}

main();
