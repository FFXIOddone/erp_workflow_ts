/**
 * One-time script: scan S:\INNER WORKINGS\ for HH Global print files
 * and create PrintCutLink records so resolveAutoRipSourceFile() can find them.
 *
 * Pattern: S:\INNER WORKINGS\WO{orderNumber}_*\PRINT\*.pdf
 *
 * Run: npx tsx scripts/link-hh-global-print-files.ts
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const INNER_WORKINGS = 'S:\\INNER WORKINGS';
const PRINT_EXT = /\.(pdf|eps|ai|tiff?|png)$/i;

async function main() {
  // 1. Get all HH Global work orders
  const orders = await prisma.workOrder.findMany({
    where: {
      customerName: { contains: 'HH Global', mode: 'insensitive' },
    },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
    },
  });

  console.log(`Found ${orders.length} HH Global work orders`);

  // 2. Build a map: orderNumber → workOrder
  const orderMap = new Map<string, (typeof orders)[0]>();
  for (const o of orders) {
    orderMap.set(o.orderNumber, o);
  }

  // 3. Scan S:\INNER WORKINGS\ for WO* folders
  let entries: string[];
  try {
    entries = fs.readdirSync(INNER_WORKINGS);
  } catch (e) {
    console.error(`Cannot read ${INNER_WORKINGS}:`, e);
    process.exit(1);
  }

  const woFolders = entries.filter((e) => /^WO\d+/i.test(e));
  console.log(`Found ${woFolders.length} WO folders in S:\\INNER WORKINGS\\`);

  let created = 0;
  let skipped = 0;
  let noFiles = 0;
  let noMatch = 0;

  for (const folder of woFolders) {
    // Extract order number from folder name: WO64372_... → 64372
    const match = folder.match(/^WO(\d+)/i);
    if (!match) continue;

    const orderNumber = match[1];
    const order = orderMap.get(orderNumber);
    if (!order) {
      noMatch++;
      continue;
    }

    // Look for files in PRINT/ subfolder first, then root of folder
    const folderPath = path.join(INNER_WORKINGS, folder);
    const printSubdir = path.join(folderPath, 'PRINT');

    let printFiles: string[] = [];

    if (fs.existsSync(printSubdir)) {
      try {
        printFiles = fs
          .readdirSync(printSubdir)
          .filter((f) => PRINT_EXT.test(f))
          .map((f) => path.join(printSubdir, f));
      } catch {
        // ignore
      }
    }

    // Fall back to any PDF directly in folder root (excluding Purchase Orders)
    if (printFiles.length === 0) {
      try {
        printFiles = fs
          .readdirSync(folderPath)
          .filter((f) => PRINT_EXT.test(f) && !/purchase.?order|^E\d{8}/i.test(f))
          .map((f) => path.join(folderPath, f));
      } catch {
        // ignore
      }
    }

    if (printFiles.length === 0) {
      noFiles++;
      continue;
    }

    // Use the first print file (prefer PRINTANDCUT > PRINT > other)
    const ranked = printFiles.sort((a, b) => {
      const scoreA = /printandcut/i.test(a) ? 2 : /print/i.test(a) ? 1 : 0;
      const scoreB = /printandcut/i.test(b) ? 2 : /print/i.test(b) ? 1 : 0;
      return scoreB - scoreA;
    });
    const bestFile = ranked[0];
    const fileName = path.basename(bestFile);

    // Check if a PrintCutLink already exists for this order + file
    const existing = await prisma.printCutLink.findFirst({
      where: {
        workOrderId: order.id,
        printFilePath: bestFile,
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    // Get file size
    let fileSize: number | undefined;
    try {
      fileSize = fs.statSync(bestFile).size;
    } catch {
      // ignore
    }

    // Create PrintCutLink
    await prisma.printCutLink.create({
      data: {
        workOrderId: order.id,
        printFileName: fileName,
        printFilePath: bestFile,
        printFileSize: fileSize,
        status: 'DESIGN',
        linkConfidence: 'HIGH',
      },
    });

    console.log(`  [CREATED] ${order.orderNumber} → ${fileName}`);
    created++;
  }

  console.log('\n--- Summary ---');
  console.log(`Created:  ${created}`);
  console.log(`Skipped (already exists): ${skipped}`);
  console.log(`No print files found: ${noFiles}`);
  console.log(`No HH Global order match: ${noMatch}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
