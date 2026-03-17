/**
 * Backfill DESIGN routing to ALL active orders.
 * Every order should have: DESIGN → [PRINTING] → PRODUCTION → SHIPPING_RECEIVING
 * 
 * This adds DESIGN to any order that doesn't already have it.
 * Also ensures PRODUCTION + SHIPPING_RECEIVING are present (safety net).
 *
 * Run: npx tsx backfill-design.ts
 */
import { PrismaClient, PrintingMethod } from '@prisma/client';

const prisma = new PrismaClient();

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
  // Get ALL non-cancelled orders (include shipped so they have correct history)
  const orders = await prisma.workOrder.findMany({
    where: {
      status: { notIn: ['CANCELLED'] },
    },
    include: { stationProgress: true },
  });

  let fixedCount = 0;
  let skippedCount = 0;

  for (const order of orders) {
    const routing = (order.routing as string[]) || [];

    const needsDesign = !routing.includes('DESIGN');
    const needsProduction = !routing.includes('PRODUCTION');
    const needsShipping = !routing.includes('SHIPPING_RECEIVING');

    if (!needsDesign && !needsProduction && !needsShipping) {
      skippedCount++;
      continue;
    }

    const newRouting = new Set(routing);
    if (needsDesign) newRouting.add('DESIGN');
    if (needsProduction) newRouting.add('PRODUCTION');
    if (needsShipping) newRouting.add('SHIPPING_RECEIVING');

    // Sort into standard order
    const sortedRouting = STATION_ORDER.filter(s => newRouting.has(s));

    // Create stationProgress for newly added stations
    const existingStations = order.stationProgress.map(sp => sp.station);
    const newStations = sortedRouting.filter(s => !existingStations.includes(s));

    // For shipped/completed orders, mark new stations as COMPLETED automatically
    const isFinished = order.status === 'SHIPPED' || order.status === 'COMPLETED';

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
                status: isFinished ? 'COMPLETED' : 'NOT_STARTED',
                ...(isFinished ? { completedAt: order.updatedAt } : {}),
              })),
            }),
          ]
        : []),
    ]);

    const added = newStations.join(', ');
    console.log(`✓ ${order.orderNumber}: added ${added}${isFinished ? ' (auto-completed)' : ''}`);
    fixedCount++;
  }

  console.log(`\nDone. Fixed ${fixedCount} orders, skipped ${skippedCount}.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
