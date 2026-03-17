import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addProofToOrder1() {
  const order = await prisma.workOrder.findFirst({ where: { orderNumber: 'WO-PORTAL-001' } });
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  
  if (!order || !admin) {
    console.log('Order or admin not found');
    await prisma.$disconnect();
    return;
  }

  // Check if proof already exists
  const existingProof = await prisma.proofApproval.findFirst({ where: { orderId: order.id } });
  if (existingProof) {
    console.log('✅ Proof already exists for order 1');
    await prisma.$disconnect();
    return;
  }

  // Create attachment
  const attachment = await prisma.orderAttachment.create({
    data: {
      orderId: order.id,
      fileName: 'Grand Opening Banner - Proof v1.pdf',
      filePath: '\\\\server\\proofs\\' + order.orderNumber + '\\proof_v1.pdf',
      fileType: 'PROOF',
      fileSize: 245678,
      description: 'First proof for banner design',
      uploadedById: admin.id,
    }
  });

  // Create proof approval
  await prisma.proofApproval.create({
    data: {
      orderId: order.id,
      attachmentId: attachment.id,
      status: 'PENDING',
      revision: 1,
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      requestedAt: new Date(),
    }
  });
  
  console.log('✅ Proof approval created for order WO-PORTAL-001');
  await prisma.$disconnect();
}

addProofToOrder1().catch(console.error);
