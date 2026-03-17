import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  const user = await prisma.portalUser.findFirst({ where: { email: 'user@yahoo.com' } });
  console.log('PortalUser customerId:', user?.customerId);
  
  const quote = await prisma.quote.findFirst({ where: { quoteNumber: 'QT-TEST-001' } });
  console.log('Quote customerId:', quote?.customerId);
  console.log('Quote status:', quote?.status);
  
  console.log('Match:', user?.customerId === quote?.customerId);
  
  await prisma.$disconnect();
}

verify();
