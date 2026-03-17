import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── MERGE DEFINITIONS ─────────────────────────────────────────
// Each entry: [keepName, ...mergeNames]
// The first name is the company to KEEP, all others get merged into it.
// For WO-only names, we just reassign the WO's companyId + customerName.

interface MergeGroup {
  keepName: string;       // Company name to keep
  mergeCompanies: string[];   // Company names to merge (delete after moving relations)
  mergeWONames: string[];      // WO customerNames to reassign to the kept company
}

const MERGE_GROUPS: MergeGroup[] = [
  // ─── Company-to-Company merges (keep the more complete/formal one) ───
  { keepName: "Abel Oil Co., Inc.", mergeCompanies: ["Abel Oil"], mergeWONames: [] },
  { keepName: "Casey's General Stores INC", mergeCompanies: ["Casey's General Stores,inc"], mergeWONames: [] },
  { keepName: "Coffee Break Roasting Company", mergeCompanies: ["Coffee Break Roasting Co."], mergeWONames: [] },
  { keepName: "Millerknoll (formerly Herman Miller)", mergeCompanies: ["Millerknoll"], mergeWONames: [] },
  { keepName: "The Van Roy Coffee Company", mergeCompanies: ["The Van Roy Coffee CO"], mergeWONames: [] },
  { keepName: "Fleming Brothers Oil Co., Inc.", mergeCompanies: ["Fleming Brothers Oil"], mergeWONames: [] },
  { keepName: "Miller Oil Company", mergeCompanies: ["Miller Oil Co., Inc."], mergeWONames: [] },
  { keepName: "First Class Towing", mergeCompanies: ["1st Class Towing"], mergeWONames: [] },
  { keepName: "Aaron's Oil Company", mergeCompanies: ["Aarons Oil CO"], mergeWONames: [] },
  { keepName: "CornerstonePCA", mergeCompanies: ["Cornerstone Pca"], mergeWONames: [] },
  { keepName: "Dick Dykehouse Company", mergeCompanies: ["Dike Dykehouse Company"], mergeWONames: [] },
  { keepName: "Exhaust Special -T's", mergeCompanies: ["Exhaust Special-ts"], mergeWONames: [] },
  { keepName: "Heineken USA", mergeCompanies: ["HeinekenUSA"], mergeWONames: [] },
  { keepName: "Johnstone Supply Muskegon Group", mergeCompanies: ["Johnstone Supply Muskegon Grou"], mergeWONames: [] },
  { keepName: "La Fiesta Chip Co.", mergeCompanies: ["La Fiesta Chips"], mergeWONames: [] },
  { keepName: "Mona Shores Robotics", mergeCompanies: ["Mona Shores Ftc Robotics"], mergeWONames: [] },
  { keepName: "Muskegon Township Fire Department", mergeCompanies: ["Muskegon Township Fire Dept"], mergeWONames: [] },
  { keepName: "Oakridge Schools", mergeCompanies: ["Oakridge School"], mergeWONames: [] },
  { keepName: "Ottawa Conservation District", mergeCompanies: ["Ottawa Conservation Disctrict"], mergeWONames: [] },
  { keepName: "Quick Mart", mergeCompanies: ["Quickmart"], mergeWONames: [] },
  { keepName: "Roberts Business Forms", mergeCompanies: ["Robert Business Forms"], mergeWONames: [] },
  { keepName: "Rock Plant-it", mergeCompanies: ["Rock Plant It"], mergeWONames: [] },
  { keepName: "Ryan's Repair and Remodel LLC", mergeCompanies: ["Ryan's Repair & Remodel"], mergeWONames: [] },
  { keepName: "S & R Transport Restoration", mergeCompanies: ["S&R Transport Restoration"], mergeWONames: [] },
  { keepName: "Salon Mia Bella", mergeCompanies: ["Salon_Mia_Bella"], mergeWONames: [] },
  { keepName: "Smart Vision Lights", mergeCompanies: ["Smart Vision Light"], mergeWONames: [] },
  { keepName: "Westshore Lawn Care and Snow Plowing", mergeCompanies: ["Westshore Lawn Care & Snow Plowing"], mergeWONames: [] },

  // ─── Company + WO name merges (link WO orders to existing company) ───
  { keepName: "Mastertag", mergeCompanies: [], mergeWONames: ["Mastertag PO 4226", "Mastertag PO4221", "Mastertag PO4222", "Mastertag PO4225"] },
  { keepName: "Total Source INC", mergeCompanies: [], mergeWONames: ["Total Source PO 15157", "Total Source PO15141"] },
  { keepName: "Corepark Investments LLC", mergeCompanies: [], mergeWONames: ["Corepark Investments", "COREPARK INVESTMENTS LLC"] },
  { keepName: "Blocker Outdoors, LLC", mergeCompanies: [], mergeWONames: ["Blocker Outdoors"] },
  { keepName: "Buc-ee's, Ltd.", mergeCompanies: [], mergeWONames: ["Buc-ee's LTD"] },
  { keepName: "Coles Energy, Inc.", mergeCompanies: [], mergeWONames: ["Coles Energy"] },
  { keepName: "H.T. Hackney Co.", mergeCompanies: [], mergeWONames: ["HT Hackney"] },
  { keepName: "Herman Miller, Inc.", mergeCompanies: [], mergeWONames: ["HERMAN MILLER"] },
  { keepName: "Kate's Transportation, LLC", mergeCompanies: [], mergeWONames: ["Kate's Transportation"] },
  { keepName: "Meijer, Inc.", mergeCompanies: [], mergeWONames: ["Meijer"] },
  { keepName: "Southern Area Chamber of Commerce", mergeCompanies: [], mergeWONames: ["SOUTHERN AREA  CHAMBER OF COMMERCE"] },
  { keepName: "Gino's BBQ, Inc.", mergeCompanies: [], mergeWONames: ["Ginos BBQ"] },
];

// ─── Also auto-link the 422 case-only WO matches ──────────────
// These are WO customerNames that are the same as a Company name (case-insensitive)
// We'll find and link them in a bulk pass

async function mergeCompanies(keepId: string, mergeId: string, keepName: string, mergeName: string): Promise<number> {
  let moved = 0;

  // Move workOrders
  const woResult = await prisma.workOrder.updateMany({
    where: { companyId: mergeId },
    data: { companyId: keepId },
  });
  moved += woResult.count;

  // Move contacts
  const contactResult = await prisma.contact.updateMany({
    where: { companyId: mergeId },
    data: { companyId: keepId },
  });
  moved += contactResult.count;

  // Move quotes
  const quoteResult = await prisma.quote.updateMany({
    where: { companyId: mergeId },
    data: { companyId: keepId },
  });
  moved += quoteResult.count;

  // Move portalUsers
  const portalResult = await prisma.portalUser.updateMany({
    where: { companyId: mergeId },
    data: { companyId: keepId },
  });
  moved += portalResult.count;

  // Move documents
  const docResult = await prisma.document.updateMany({
    where: { companyId: mergeId },
    data: { companyId: keepId },
  });
  moved += docResult.count;

  // Move recurringOrders
  const recurringResult = await prisma.recurringOrder.updateMany({
    where: { companyId: mergeId },
    data: { companyId: keepId },
  });
  moved += recurringResult.count;

  // Move installationJobs
  const installResult = await prisma.installationJob.updateMany({
    where: { companyId: mergeId },
    data: { companyId: keepId },
  });
  moved += installResult.count;

  // Move projects
  const projectResult = await prisma.project.updateMany({
    where: { companyId: mergeId },
    data: { companyId: keepId },
  });
  moved += projectResult.count;

  // Move hierarchy relations (parent side)
  await prisma.companyHierarchy.updateMany({
    where: { parentCompanyId: mergeId },
    data: { parentCompanyId: keepId },
  }).catch(() => {}); // Ignore unique constraint violations

  // Move hierarchy relations (child side)
  await prisma.companyHierarchy.updateMany({
    where: { childCompanyId: mergeId },
    data: { childCompanyId: keepId },
  }).catch(() => {});

  // Delete the merged company
  await prisma.company.delete({ where: { id: mergeId } });

  return moved;
}

async function main() {
  console.log('\n🔄 Starting duplicate merge process...\n');

  let totalMerged = 0;
  let totalWOLinked = 0;
  let totalCaseLinked = 0;
  let errors: string[] = [];

  // ─── PHASE 1: Process defined merge groups ──────────────
  console.log('═══ PHASE 1: Merging duplicate companies & linking WO names ═══\n');

  for (const group of MERGE_GROUPS) {
    // Find the "keep" company
    const keepCompany = await prisma.company.findFirst({
      where: { name: group.keepName },
    });

    if (!keepCompany) {
      errors.push(`❌ Could not find company to keep: "${group.keepName}"`);
      continue;
    }

    // Merge duplicate companies into the keep company
    for (const mergeName of group.mergeCompanies) {
      const mergeCompany = await prisma.company.findFirst({
        where: { name: mergeName },
      });

      if (!mergeCompany) {
        errors.push(`❌ Could not find company to merge: "${mergeName}" → "${group.keepName}"`);
        continue;
      }

      try {
        const moved = await mergeCompanies(keepCompany.id, mergeCompany.id, group.keepName, mergeName);
        console.log(`  ✅ Merged "${mergeName}" → "${group.keepName}" (${moved} relations moved)`);
        totalMerged++;
      } catch (err: any) {
        errors.push(`❌ Failed to merge "${mergeName}" → "${group.keepName}": ${err.message}`);
      }
    }

    // Link WO names to the keep company
    for (const woName of group.mergeWONames) {
      try {
        const result = await prisma.workOrder.updateMany({
          where: {
            customerName: woName,
            companyId: null, // Only link unlinked orders
          },
          data: {
            companyId: keepCompany.id,
          },
        });

        // Also update already-linked ones to point to the correct company
        const result2 = await prisma.workOrder.updateMany({
          where: {
            customerName: woName,
            companyId: { not: keepCompany.id },
          },
          data: {
            companyId: keepCompany.id,
          },
        });

        const count = result.count + result2.count;
        if (count > 0) {
          console.log(`  🔗 Linked "${woName}" → "${group.keepName}" (${count} orders)`);
          totalWOLinked += count;
        }
      } catch (err: any) {
        errors.push(`❌ Failed to link WO "${woName}" → "${group.keepName}": ${err.message}`);
      }
    }
  }

  // ─── PHASE 2: Auto-link case-only WO matches ───────────
  console.log('\n═══ PHASE 2: Auto-linking case-only WO customer names ═══\n');

  // Get all companies indexed by lowercase name
  const allCompanies = await prisma.company.findMany({
    select: { id: true, name: true },
  });
  const companyByLower = new Map<string, { id: string; name: string }>();
  for (const c of allCompanies) {
    companyByLower.set(c.name.toLowerCase(), c);
  }

  // Get all distinct WO customerNames
  const woNames = await prisma.workOrder.groupBy({
    by: ['customerName'],
    _count: { id: true },
  });

  for (const wo of woNames) {
    const lower = wo.customerName.toLowerCase();
    const company = companyByLower.get(lower);
    
    if (company && company.name !== wo.customerName) {
      // Case difference — link these WOs to the company
      const result = await prisma.workOrder.updateMany({
        where: {
          customerName: wo.customerName,
          OR: [
            { companyId: null },
            { companyId: { not: company.id } },
          ],
        },
        data: { companyId: company.id },
      });

      if (result.count > 0) {
        totalCaseLinked += result.count;
      }
    }
  }

  console.log(`  ✅ Auto-linked ${totalCaseLinked} orders by case-insensitive company name match\n`);

  // ─── SUMMARY ────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  MERGE SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Companies merged (deleted):  ${totalMerged}`);
  console.log(`  WO orders linked by name:    ${totalWOLinked}`);
  console.log(`  WO orders linked by case:    ${totalCaseLinked}`);
  console.log(`  Errors:                      ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n  ERRORS:');
    for (const err of errors) {
      console.log(`    ${err}`);
    }
  }

  console.log('');
  await prisma.$disconnect();
}

main().catch(console.error);
