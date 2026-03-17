import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createPortalUser() {
  const passwordHash = await bcrypt.hash('user123', 12);
  
  // First create or find a test customer
  let customer = await prisma.customer.findFirst({ where: { email: 'user@yahoo.com' } });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        name: 'Test Portal Customer',
        email: 'user@yahoo.com',
        phone: '555-0123',
        address: '123 Test Street',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345'
      }
    });
    console.log('Created customer:', customer.id);
  } else {
    console.log('Found existing customer:', customer.id);
  }
  
  // Create portal user
  const portalUser = await prisma.portalUser.upsert({
    where: { email: 'user@yahoo.com' },
    update: { passwordHash },
    create: {
      email: 'user@yahoo.com',
      passwordHash,
      firstName: 'Test',
      lastName: 'User',
      phone: '555-0123',
      isActive: true,
      emailVerified: true,
      customerId: customer.id
    }
  });
  console.log('✅ Portal user ready:', portalUser.email, '/ password: user');
  await prisma.$disconnect();
}

createPortalUser().catch(console.error);
