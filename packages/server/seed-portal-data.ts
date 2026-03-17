import { PrismaClient, OrderStatus, StationStatus, PrintingMethod } from '@prisma/client';

const prisma = new PrismaClient();

async function seedPortalData() {
  console.log('🌱 Seeding portal test data...');

  // Find the test portal user's customer
  const portalUser = await prisma.portalUser.findUnique({
    where: { email: 'user@yahoo.com' },
    include: { customer: true }
  });

  if (!portalUser) {
    console.error('❌ Portal user not found. Run create-portal-user.ts first.');
    await prisma.$disconnect();
    return;
  }

  const customerId = portalUser.customerId;
  const customerName = portalUser.customer.name;
  console.log(`Found customer: ${customerName} (${customerId})`);

  // Get an admin user for assignments
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!adminUser) {
    console.error('❌ No admin user found');
    await prisma.$disconnect();
    return;
  }

  // Create test orders
  const orders = [
    {
      orderNumber: 'WO-PORTAL-001',
      status: OrderStatus.IN_PROGRESS,
      priority: 4,
      routing: [PrintingMethod.DESIGN, PrintingMethod.ROLL_TO_ROLL, PrintingMethod.SHIPPING_RECEIVING],
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      description: 'Outdoor Banner - Grand Opening: 4x8 vinyl banner for grand opening event',
    },
    {
      orderNumber: 'WO-PORTAL-002',
      status: OrderStatus.PENDING,
      priority: 3,
      routing: [PrintingMethod.DESIGN, PrintingMethod.FLATBED, PrintingMethod.INSTALLATION],
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
      description: 'Vehicle Wrap - Company Fleet: Full vehicle wrap for 3 company vans',
    },
    {
      orderNumber: 'WO-PORTAL-003',
      status: OrderStatus.COMPLETED,
      priority: 3,
      routing: [PrintingMethod.DESIGN, PrintingMethod.FLATBED, PrintingMethod.INSTALLATION],
      dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      description: 'Window Graphics - Storefront: Frosted vinyl window graphics',
    },
    {
      orderNumber: 'WO-PORTAL-004',
      status: OrderStatus.SHIPPED,
      priority: 5,
      routing: [PrintingMethod.DESIGN, PrintingMethod.ROLL_TO_ROLL, PrintingMethod.SHIPPING_RECEIVING],
      dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      description: 'Trade Show Display: 10x10 pop-up display with banner stands',
    },
  ];

  for (const orderData of orders) {
    const existing = await prisma.workOrder.findFirst({
      where: { orderNumber: orderData.orderNumber }
    });

    if (existing) {
      console.log(`Order ${orderData.orderNumber} already exists, skipping...`);
      continue;
    }

    const order = await prisma.workOrder.create({
      data: {
        ...orderData,
        customerId,
        customerName,
        createdById: adminUser.id,
        lineItems: {
          create: [
            {
              itemNumber: 1,
              description: orderData.description.split(':')[0],
              quantity: 1,
              unitPrice: Math.floor(Math.random() * 500) + 200,
            }
          ]
        },
        stationProgress: {
          create: orderData.routing.map((station) => ({
            station,
            status: orderData.status === OrderStatus.COMPLETED || orderData.status === OrderStatus.SHIPPED
              ? StationStatus.COMPLETED
              : station === orderData.routing[0] && orderData.status === OrderStatus.IN_PROGRESS
                ? StationStatus.IN_PROGRESS
                : StationStatus.NOT_STARTED,
          }))
        }
      }
    });

    console.log(`✅ Created order: ${order.orderNumber}`);

    // Add proof attachment for IN_PROGRESS order
    if (orderData.status === OrderStatus.IN_PROGRESS) {
      const attachment = await prisma.orderAttachment.create({
        data: {
          orderId: order.id,
          fileName: 'Grand Opening Banner - Proof v1.pdf',
          filePath: '\\\\server\\proofs\\' + order.orderNumber + '\\proof_v1.pdf',
          fileType: 'PROOF',
          fileSize: 245678,
          description: 'First proof for banner design',
          uploadedById: adminUser.id,
        }
      });

      // Create proof approval request
      await prisma.proofApproval.create({
        data: {
          orderId: order.id,
          attachmentId: attachment.id,
          status: 'PENDING',
          revision: 1,
          dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
          requestedAt: new Date(),
        }
      });

      console.log(`  📎 Added proof approval request`);
    }
  }

  // Create a test message thread
  const inProgressOrder = await prisma.workOrder.findFirst({
    where: { orderNumber: 'WO-PORTAL-001' }
  });

  if (inProgressOrder) {
    const existingMessage = await prisma.portalMessage.findFirst({
      where: { orderId: inProgressOrder.id }
    });

    if (!existingMessage) {
      // Message from staff to customer
      const threadId = `thread-${inProgressOrder.id}`;
      await prisma.portalMessage.create({
        data: {
          threadId,
          subject: 'Your proof is ready for review',
          content: 'Hi! We\'ve uploaded the first proof for your Grand Opening banner. Please review it and let us know if you\'d like any changes. We\'re aiming to have this printed by end of week!',
          orderId: inProgressOrder.id,
          customerId,
          userId: adminUser.id,
          isFromCustomer: false,
          isRead: false,
        }
      });
      console.log(`✅ Created test message thread`);
    }
  }

  console.log('\n🎉 Portal test data seeded successfully!');
  await prisma.$disconnect();
}

seedPortalData().catch(console.error);
