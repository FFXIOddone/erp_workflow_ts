import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const eq = await p.equipment.findMany({
  select: { id: true, name: true, type: true, ipAddress: true, connectionType: true, status: true },
  orderBy: { name: 'asc' },
});
console.table(eq.map(e => ({
  name: e.name,
  type: e.type,
  ip: e.ipAddress || '(none)',
  conn: e.connectionType || '(none)',
  status: e.status,
})));
await p.$disconnect();
