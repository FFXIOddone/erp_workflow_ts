import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listPortalUsers() {
  const users = await prisma.portalUser.findMany({
    select: {
      email: true,
      firstName: true,
      lastName: true,
      customerId: true,
    },
  });
  console.log('Portal Users:');
  users.forEach(u => console.log(`  - ${u.firstName} ${u.lastName} (${u.email}) customerId: ${u.customerId}`));
  
  // Also show the quote
  const quote = await prisma.quote.findFirst({
    where: { quoteNumber: 'QT-TEST-001' },
    select: { quoteNumber: true, customerId: true, status: true }
  });
  console.log('\nTest Quote:', quote);
  
  await prisma.$disconnect();
}

listPortalUsers();
