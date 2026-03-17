import { thriveService } from '../services/thrive.js';
import { prisma } from '../db/client.js';

async function analyze() {
  const { printJobs, cutJobs } = await thriveService.getAllJobs();
  
  // Find WO numbers that appear in BOTH print and cut jobs
  const printWOs = new Set(printJobs.filter(j => j.workOrderNumber).map(j => j.workOrderNumber));
  const cutWOs = new Set(cutJobs.filter(j => j.workOrderNumber).map(j => j.workOrderNumber));
  const bothWOs = [...printWOs].filter(wo => cutWOs.has(wo));
  
  console.log('=== WOs with BOTH print AND cut data ===');
  console.log('Total found:', bothWOs.length);
  console.log('First 10:', bothWOs.slice(0, 10));
  
  // Check if these exist in DB
  console.log('\n=== Checking DB for WOs with BOTH print+cut ===');
  const foundBoth: string[] = [];
  for (const wo of bothWOs) {
    const order = await prisma.workOrder.findFirst({ 
      where: { orderNumber: wo },
      select: { id: true, orderNumber: true, customerName: true }
    });
    if (order) {
      foundBoth.push(wo!);
      console.log(wo + ': FOUND - ' + order.customerName);
    } else {
      console.log(wo + ': NOT IN DB');
    }
  }
  
  console.log('\n=== 5 WOs with BOTH print AND cut (in DB) ===');
  console.log(foundBoth.slice(0, 5));
  
  // Show sample of unmatched WO numbers
  const allWOs = new Set([...printWOs, ...cutWOs]);
  const matched: string[] = [];
  const unmatched: string[] = [];
  for (const wo of allWOs) {
    const order = await prisma.workOrder.findFirst({ where: { orderNumber: wo } });
    if (order) matched.push(wo!);
    else unmatched.push(wo!);
  }
  
  console.log('\n=== Match analysis ===');
  console.log('Total unique WOs:', allWOs.size);
  console.log('Matched in DB:', matched.length);
  console.log('NOT in DB:', unmatched.length);
  console.log('\nSample unmatched WOs:', unmatched.slice(0, 15));
  
  // Check if unmatched look like valid WO numbers
  console.log('\n=== Why low match rate? ===');
  const woPatterns: Record<string, number> = {};
  for (const wo of unmatched) {
    const pattern = wo.replace(/\d/g, '#');
    woPatterns[pattern] = (woPatterns[pattern] || 0) + 1;
  }
  console.log('Unmatched WO patterns:', woPatterns);
  
  // Show DB order numbers for comparison
  console.log('\n=== DB Order Numbers (sample) ===');
  const dbOrders = await prisma.workOrder.findMany({
    take: 20,
    orderBy: { createdAt: 'desc' },
    select: { orderNumber: true, customerName: true }
  });
  for (const o of dbOrders) {
    console.log(o.orderNumber, '-', o.customerName);
  }
  
  // Try matching with WO prefix
  console.log('\n=== Trying to match with WO prefix ===');
  const matchedWithPrefix: string[] = [];
  for (const wo of [...unmatched].slice(0, 20)) {
    const withPrefix = 'WO' + wo;
    const order = await prisma.workOrder.findFirst({ where: { orderNumber: withPrefix } });
    if (order) {
      matchedWithPrefix.push(wo);
      console.log(wo, '-> WO' + wo, ': FOUND -', order.customerName);
    }
  }
  console.log('Matched with WO prefix:', matchedWithPrefix.length);
  
  // Check DB count and range
  const totalOrders = await prisma.workOrder.count();
  console.log('\n=== DB Stats ===');
  console.log('Total orders in DB:', totalOrders);
  
  await prisma.$disconnect();
}

analyze().catch(console.error);
