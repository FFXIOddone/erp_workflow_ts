import { prisma } from './src/db/client.js';

async function seedRecurringOrders() {
  // Find the portal user's customer
  const portalUser = await prisma.portalUser.findFirst({
    where: { email: 'user@yahoo.com' }
  });

  if (!portalUser) {
    console.log('Portal user not found');
    return;
  }

  console.log('Portal user found:', portalUser.customerId);

  // Create recurring orders for this customer
  const recurringOrders = await Promise.all([
    // Monthly Banner Service
    prisma.recurringOrder.create({
      data: {
        name: 'Monthly Banner Service',
        description: 'Monthly promotional banners for storefront',
        frequency: 'MONTHLY',
        startDate: new Date('2025-01-01'),
        nextGenerateDate: new Date('2025-02-01'),
        lastGeneratedAt: new Date('2025-01-15'),
        isActive: true,
        isPaused: false,
        notifyDaysBefore: 5,
        discountPercent: 10,
        customerId: portalUser.customerId,
        lineItems: {
          create: [
            {
              description: '4x8 Vinyl Banner - Full Color',
              quantity: 2,
              unitPrice: 125.00,
            },
            {
              description: 'Banner Installation Service',
              quantity: 1,
              unitPrice: 50.00,
            }
          ]
        }
      }
    }),

    // Quarterly Vehicle Magnets
    prisma.recurringOrder.create({
      data: {
        name: 'Quarterly Vehicle Magnets',
        description: 'Replacement vehicle magnets for delivery fleet',
        frequency: 'QUARTERLY',
        startDate: new Date('2025-01-01'),
        nextGenerateDate: new Date('2025-04-01'),
        lastGeneratedAt: new Date('2025-01-10'),
        isActive: true,
        isPaused: true,
        pausedReason: 'Fleet maintenance in progress',
        notifyDaysBefore: 7,
        customerId: portalUser.customerId,
        lineItems: {
          create: [
            {
              description: '18x24 Vehicle Magnet - White',
              quantity: 6,
              unitPrice: 45.00,
            }
          ]
        }
      }
    }),

    // Weekly Safety Signs
    prisma.recurringOrder.create({
      data: {
        name: 'Weekly Safety Sign Replacement',
        description: 'Weekly replacement of worn safety signs',
        frequency: 'WEEKLY',
        startDate: new Date('2025-01-01'),
        nextGenerateDate: new Date('2025-01-27'),
        isActive: true,
        isPaused: false,
        notifyDaysBefore: 2,
        discountPercent: 15,
        customerId: portalUser.customerId,
        lineItems: {
          create: [
            {
              description: 'Safety Warning Sign 12x18',
              quantity: 4,
              unitPrice: 18.50,
            },
            {
              description: 'No Smoking Sign 8x12',
              quantity: 2,
              unitPrice: 12.00,
            }
          ]
        }
      }
    }),
  ]);

  console.log('Created recurring orders:', recurringOrders.length);
  
  for (const order of recurringOrders) {
    console.log(`  - ${order.name} (${order.frequency})`);
  }
}

seedRecurringOrders()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
