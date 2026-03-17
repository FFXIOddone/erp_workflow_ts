/**
 * Backfill missing PRODUCTION and SHIPPING_RECEIVING routes on existing orders
 * that have any printing station (ROLL_TO_ROLL, FLATBED, SCREEN_PRINT) but
 * are missing these downstream stations.
 *
 * Run: npx tsx backfill-routes.ts
 */
import { PrismaClient, PrintingMethod } from '@prisma/client';

const prisma = new PrismaClient();

const PRINTING_STATIONS = ['ROLL_TO_ROLL', 'FLATBED', 'SCREEN_PRINT'] as const;

const STATION_ORDER: PrintingMethod[] = [
  'ORDER_ENTRY',
  'SALES',
  'DESIGN',
  'FLATBED',
  'ROLL_TO_ROLL',
  'SCREEN_PRINT',
  'PRODUCTION',
  'INSTALLATION',
  'SHIPPING_RECEIVING',
];

async function main() {
  const orders = await prisma.workOrder.findMany({
    where: {
      status: { notIn: ['SHIPPED', 'CANCELLED'] },
    },
    include: { stationProgress: true },
  });

  let fixedCount = 0;
  let skippedCount = 0;

  for (const order of orders) {
    const routing = (order.routing as string[]) || [];
    
    // Rule: ALL active orders should have PRODUCTION and SHIPPING_RECEIVING
    const needsProduction = !routing.includes('PRODUCTION');
    const needsShipping = !routing.includes('SHIPPING_RECEIVING');

    // Check description for install/outsourced
    const desc = (order.description || '').toUpperCase();
    const needsInstall = desc.includes('(INSTALL)') && !routing.includes('INSTALLATION');
    const needsOrderEntry = desc.includes('(OUTSOURCED)') && !routing.includes('ORDER_ENTRY');

    if (!needsProduction && !needsShipping && !needsInstall && !needsOrderEntry) {
      skippedCount++;
      continue;
    }

    const newRouting = new Set(routing);
    if (needsProduction) newRouting.add('PRODUCTION');
    if (needsShipping) newRouting.add('SHIPPING_RECEIVING');
    if (needsInstall) newRouting.add('INSTALLATION');
    if (needsOrderEntry) newRouting.add('ORDER_ENTRY');

    // Sort into standard order
    const sortedRouting = STATION_ORDER.filter(s => newRouting.has(s));

    // Figure out which stations need new stationProgress records
    const existingStations = order.stationProgress.map(sp => sp.station);
    const newStations = sortedRouting.filter(s => !existingStations.includes(s));

    await prisma.$transaction([
      prisma.workOrder.update({
        where: { id: order.id },
        data: { routing: sortedRouting },
      }),
      ...(newStations.length > 0
        ? [
            prisma.stationProgress.createMany({
              data: newStations.map(station => ({
                orderId: order.id,
                station,
                status: 'NOT_STARTED',
              })),
            }),
          ]
        : []),
    ]);

    const added = newStations.join(', ');
    console.log(`✓ ${order.orderNumber}: added ${added}`);
    fixedCount++;
  }

  console.log(`\nDone. Fixed ${fixedCount} orders, skipped ${skippedCount}.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
