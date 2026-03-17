import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestQuote() {
  // Get the portal user's customer
  const portalUser = await prisma.portalUser.findFirst({ where: { email: 'user@yahoo.com' } });
  if (!portalUser) {
    console.log('No portal user found');
    await prisma.$disconnect();
    return;
  }

  console.log('Found portal user:', portalUser.email, 'customerId:', portalUser.customerId);

  // Get admin user
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) {
    console.log('No admin user found');
    await prisma.$disconnect();
    return;
  }

  console.log('Found admin:', admin.email);

  // Check if test quote already exists
  const existingQuote = await prisma.quote.findFirst({
    where: { quoteNumber: 'QT-TEST-001' }
  });

  if (existingQuote) {
    console.log('Test quote already exists:', existingQuote.quoteNumber, existingQuote.id);
    await prisma.$disconnect();
    return;
  }

  // Create a quote with SENT status
  const quote = await prisma.quote.create({
    data: {
      quoteNumber: 'QT-TEST-001',
      status: 'SENT',
      customerName: 'Test Portal Customer',
      description: 'Test Quote for Approval Workflow',
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      subtotal: 500,
      total: 500,
      customerId: portalUser.customerId,
      createdById: admin.id,
      sentAt: new Date(),
      lineItems: {
        create: [
          {
            itemNumber: 1,
            description: 'Custom Vinyl Banner 4x8',
            quantity: 2,
            unitPrice: 150,
            totalPrice: 300,
          },
          {
            itemNumber: 2,
            description: 'Installation Service',
            quantity: 1,
            unitPrice: 200,
            totalPrice: 200,
          },
        ],
      },
    },
    include: { lineItems: true },
  });

  console.log('Created quote:', quote.quoteNumber, quote.id);
  console.log('Line items:', quote.lineItems.length);
  await prisma.$disconnect();
}

createTestQuote();
