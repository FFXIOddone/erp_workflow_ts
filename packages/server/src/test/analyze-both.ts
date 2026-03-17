import { thriveService } from '../services/thrive.js';
import { prisma } from '../db/client.js';

async function analyze() {
  const { printJobs, cutJobs } = await thriveService.getAllJobs();
  
  console.log('=== Print Jobs ===');
  console.log('Total:', printJobs.length);
  const printWOs = printJobs.filter(j => j.workOrderNumber).map(j => j.workOrderNumber);
  console.log('Print WO numbers:', [...new Set(printWOs)].slice(0, 10));
  
  console.log('\n=== Cut Jobs ===');
  console.log('Total:', cutJobs.length);
  for (const cut of cutJobs.slice(0, 10)) {
    console.log('-', cut.workOrderNumber, ':', cut.jobName?.slice(0, 50));
  }
  const cutWOs = cutJobs.filter(j => j.workOrderNumber).map(j => j.workOrderNumber);
  console.log('Cut WO numbers:', [...new Set(cutWOs)]);
  
  // Find overlap
  const printSet = new Set(printWOs);
  const cutSet = new Set(cutWOs);
  const overlap = [...printSet].filter(wo => cutSet.has(wo));
  console.log('\n=== Overlap ===');
  console.log('Print WOs with cut data:', overlap);
  
  // Use the actual linking function
  console.log('\n=== Using actual linking function ===');
  const linked = await thriveService.linkJobsToWorkOrders(printJobs);
  const linkedCount = linked.filter(l => l.workOrder).length;
  console.log('Linked print jobs:', linkedCount, '/', printJobs.length);
  
  // Show some linked examples
  const linkedExamples = linked.filter(l => l.workOrder).slice(0, 5);
  console.log('\n=== 5 Linked Print Jobs ===');
  for (const { job, workOrder } of linkedExamples) {
    console.log(job.workOrderNumber, '->', workOrder?.orderNumber, ':', workOrder?.customerName);
  }
  
  // Link cut jobs too
  const linkedCuts = await thriveService.linkCutJobsToWorkOrders(cutJobs);
  const linkedCutCount = linkedCuts.filter(l => l.workOrder).length;
  console.log('\n=== Linked Cut Jobs ===');
  console.log('Linked:', linkedCutCount, '/', cutJobs.length);
  
  for (const { job, workOrder } of linkedCuts.filter(l => l.workOrder)) {
    console.log(job.workOrderNumber, '->', workOrder?.orderNumber, ':', workOrder?.customerName);
  }
  
  // Find orders that have BOTH linked print AND linked cut
  const linkedPrintWOs = new Set(linked.filter(l => l.workOrder).map(l => l.workOrder!.orderNumber));
  const linkedCutWOs = new Set(linkedCuts.filter(l => l.workOrder).map(l => l.workOrder!.orderNumber));
  const bothLinked = [...linkedPrintWOs].filter(wo => linkedCutWOs.has(wo));
  
  console.log('\n=== Orders with BOTH print AND cut (linked) ===');
  console.log('Count:', bothLinked.length);
  console.log('Order numbers:', bothLinked.slice(0, 5));
  
  await prisma.$disconnect();
}

analyze().catch(console.error);
