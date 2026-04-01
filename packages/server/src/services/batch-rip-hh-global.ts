/**
 * Batch RIP service for HH Global orders
 * Groups orders by material and size, submits to Fiery RIP
 */
import path from 'path';
import { prisma } from '../db/client.js';
import { validateSourceFile } from './rip-queue.js';
import { PrintingMethod } from '@erp/shared';
import { THRIVE_CONFIG } from './thrive.js';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

function resolveFilePath(storedPath: string): string {
  const isAbsoluteOrUnc = path.isAbsolute(storedPath) || storedPath.startsWith('\\\\');
  return isAbsoluteOrUnc ? storedPath : path.resolve(UPLOAD_DIR, path.basename(storedPath));
}

export interface BatchGroup {
  material: string;
  size: 'Sml' | 'Lrg' | 'Mixed';
  orderIds: string[];
  orderNumbers: string[];
  description: string;
  wobbler: boolean;
}

export interface BatchRipRequest {
  batches: BatchGroup[];
  totalOrders: number;
  ripmachine: string;
  hotfolderId: string;
}

/**
 * Extract material name from description or line items
 * E.g., "3M IJ35C-10 Sml" → "3M IJ35C-10"
 */
function extractMaterial(description: string): string {
  // Remove size notations
  let material = description
    .replace(/\b(Sml|Lrg|Small|Large)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // If starts with material codes like "3M", "Avery", etc., keep first 2-3 tokens
  const tokens = material.split(/\s+/);
  if (tokens.length > 2 && !material.match(/^\d/)) {
    material = tokens.slice(0, 2).join(' ');
  }

  return material || 'Default';
}

/**
 * Extract size notation from description
 */
function extractSize(description: string): 'Sml' | 'Lrg' | 'Mixed' {
  const hasSml = /\bSml\b/i.test(description);
  const hasLrg = /\bLrg\b/i.test(description);

  if (hasSml && !hasLrg) return 'Sml';
  if (hasLrg && !hasSml) return 'Lrg';
  return 'Mixed';
}

/**
 * Check if order contains Wobblers
 */
function isWobbler(description: string): boolean {
  return /wobbler/i.test(description);
}

/**
 * Get all HH Global orders ready for batch RIP
 * Groups by: material → size → wobbler status
 */
export async function getHHGlobalBatches(
  station: PrintingMethod = PrintingMethod.FLATBED
): Promise<BatchGroup[]> {
  const orders = await prisma.workOrder.findMany({
    where: {
      customerName: { contains: 'HH Global', mode: 'insensitive' },
      routing: { has: station },
      status: { in: ['PENDING', 'IN_PROGRESS', 'ON_HOLD'] },
      stationProgress: {
        some: {
          station: station,
          status: { notIn: ['COMPLETED'] },
        },
      },
    },
    select: {
      id: true,
      orderNumber: true,
      description: true,
      lineItems: {
        select: {
          description: true,
          notes: true,
        },
      },
    },
  });

  if (orders.length === 0) {
    return [];
  }

  // Group orders: material → size → wobbler
  const grouped = new Map<string, BatchGroup>();

  orders.forEach((order) => {
    const description = order.description || '';
    const material = extractMaterial(description);
    const size = extractSize(description);
    const wobbler = isWobbler(description);

    // Build group key: material|size|wobbler
    const groupKey = `${material}|${size}|${wobbler}`;

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        material,
        size,
        wobbler,
        orderIds: [],
        orderNumbers: [],
        description: `${material} - ${size}${wobbler ? ' (Wobblers)' : ''}`,
      });
    }

    const group = grouped.get(groupKey)!;
    group.orderIds.push(order.id);
    group.orderNumbers.push(order.orderNumber);
  });

  return Array.from(grouped.values());
}

/**
 * Validate that orders have printable files before RIP submission.
 * Checks PrintCutLinks and all printable attachments, and verifies each
 * candidate is actually accessible on disk — not just present in the DB.
 */
export async function validateBatchFiles(
  orderIds: string[]
): Promise<{ valid: string[]; missing: string[] }> {
  const valid: string[] = [];
  const missing: string[] = [];
  const PRINT_TYPES = new Set(['ARTWORK', 'PROOF', 'OTHER']);
  const PRINT_EXT = /\.(pdf|eps|ai|psd|tiff?|png|jpe?g)$/i;

  for (const orderId of orderIds) {
    // Check PrintCutLinks first (highest quality source — confirmed file-chain path)
    const printCutLink = await prisma.printCutLink.findFirst({
      where: { workOrderId: orderId, printFilePath: { not: undefined } },
      select: { printFilePath: true },
      orderBy: { linkConfidence: 'desc' },
    });

    if (printCutLink?.printFilePath) {
      const check = await validateSourceFile(printCutLink.printFilePath.trim());
      if (check.valid) {
        valid.push(orderId);
        continue;
      }
    }

    // Fall back to any printable attachment (any type, any print-file extension)
    const attachments = await prisma.orderAttachment.findMany({
      where: { orderId },
      select: { fileName: true, filePath: true, fileType: true },
    });

    let found = false;
    for (const att of attachments) {
      if (!att.filePath?.trim()) continue;
      const name = att.fileName || path.basename(att.filePath);
      if (!PRINT_TYPES.has(att.fileType) && !PRINT_EXT.test(name)) continue;
      const check = await validateSourceFile(resolveFilePath(att.filePath.trim()));
      if (check.valid) {
        found = true;
        break;
      }
    }

    if (found) valid.push(orderId);
    else missing.push(orderId);
  }

  return { valid, missing };
}

/**
 * Get Fiery RIP config for flatbed
 */
export async function getFieryRipConfig(): Promise<any> {
  const fiery = await prisma.equipment.findFirst({
    where: {
      OR: [
        { ipAddress: THRIVE_CONFIG.fiery.ip },
        { name: { equals: 'EFI VUTEk GS3250LX Pro', mode: 'insensitive' } },
        { name: { contains: 'fiery', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      ipAddress: true,
      station: true,
    },
  });

  return fiery || null;
}
