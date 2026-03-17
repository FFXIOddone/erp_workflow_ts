/**
 * Folder utilities for work order network drive operations.
 * Extracted from file-browser.ts for reuse by auto-poll and other services.
 */
import fs from 'fs';
import path from 'path';
import { prisma } from '../db/client.js';

// Standardized file categories for new uploads
export const FILE_CATEGORIES = {
  PROOF: 'Proofs',
  ARTWORK: 'Artwork',
  EMAIL: 'Emails',
  PRINT_FILE: 'Print Files',
  PHOTO: 'Photos',
  DOCUMENT: 'Documents',
  OTHER: 'Other',
} as const;

/**
 * Extract just the WO number from an order number
 * Handles formats: WO12345, WO-12345, WO-000001, 12345
 */
export function extractWoNumber(orderNumber: string): string {
  const match = orderNumber.match(/\d+/);
  return match ? match[0] : orderNumber;
}

/**
 * Sanitize a string for use as a folder name
 */
export function sanitizeFolderName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100);
}

interface FolderSearchResult {
  found: boolean;
  folderPath: string | null;
  folderName: string | null;
  customerFolder: string | null;
  searchedLocations: string[];
}

/**
 * Find the WO folder within customer folders on the network drive
 */
export function findWoFolder(
  basePath: string,
  woNumber: string,
  customerName: string,
  customerFolderOverride?: string | null,
): FolderSearchResult {
  const searchedLocations: string[] = [];
  const woPattern = new RegExp(`^WO${woNumber}([_\\s\\-]|$)`, 'i');

  // Strategy 0: If the customer has an explicit folder override, try that first
  if (customerFolderOverride) {
    const overridePath = path.join(basePath, customerFolderOverride);
    searchedLocations.push(`Override: ${overridePath}`);
    try {
      if (fs.existsSync(overridePath)) {
        const woFolders = fs.readdirSync(overridePath, { withFileTypes: true })
          .filter(e => e.isDirectory() && woPattern.test(e.name))
          .map(e => e.name);
        if (woFolders.length > 0) {
          return {
            found: true,
            folderPath: path.join(overridePath, woFolders[0]),
            folderName: woFolders[0],
            customerFolder: customerFolderOverride,
            searchedLocations,
          };
        }
      }
    } catch {}
  }

  const normalizedCustomerName = customerName.toLowerCase();
  let customerFolders: string[] = [];
  try {
    customerFolders = fs.readdirSync(basePath, { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('$'))
      .map(e => e.name);
  } catch {
    return { found: false, folderPath: null, folderName: null, customerFolder: null, searchedLocations };
  }

  // Strategy 1: Exact match on customer folder name
  const exactMatch = customerFolders.find(f => f.toLowerCase() === normalizedCustomerName);
  if (exactMatch) {
    searchedLocations.push(`Exact: ${path.join(basePath, exactMatch)}`);
    try {
      const woFolders = fs.readdirSync(path.join(basePath, exactMatch), { withFileTypes: true })
        .filter(e => e.isDirectory() && woPattern.test(e.name))
        .map(e => e.name);
      if (woFolders.length > 0) {
        return {
          found: true,
          folderPath: path.join(basePath, exactMatch, woFolders[0]),
          folderName: woFolders[0],
          customerFolder: exactMatch,
          searchedLocations,
        };
      }
    } catch {}
  }

  // Strategy 2: Contains match on customer folder name
  const containsMatches = customerFolders.filter(f =>
    f.toLowerCase().includes(normalizedCustomerName) ||
    normalizedCustomerName.includes(f.toLowerCase())
  );
  for (const folder of containsMatches) {
    searchedLocations.push(`Contains: ${path.join(basePath, folder)}`);
    try {
      const woFolders = fs.readdirSync(path.join(basePath, folder), { withFileTypes: true })
        .filter(e => e.isDirectory() && woPattern.test(e.name))
        .map(e => e.name);
      if (woFolders.length > 0) {
        return {
          found: true,
          folderPath: path.join(basePath, folder, woFolders[0]),
          folderName: woFolders[0],
          customerFolder: folder,
          searchedLocations,
        };
      }
    } catch {}
  }

  // Strategy 3: Brute-force search all customer folders
  for (const folder of customerFolders) {
    if (containsMatches.includes(folder) || folder === exactMatch) continue;
    try {
      const woFolders = fs.readdirSync(path.join(basePath, folder), { withFileTypes: true })
        .filter(e => e.isDirectory() && woPattern.test(e.name))
        .map(e => e.name);
      if (woFolders.length > 0) {
        return {
          found: true,
          folderPath: path.join(basePath, folder, woFolders[0]),
          folderName: woFolders[0],
          customerFolder: folder,
          searchedLocations,
        };
      }
    } catch {}
  }

  return { found: false, folderPath: null, folderName: null, customerFolder: null, searchedLocations };
}

/**
 * Get or create standardized folder structure for a work order
 */
export function getOrCreateOrderFolder(
  basePath: string,
  order: { orderNumber: string; customerName: string; description?: string | null },
  createIfMissing: boolean = false,
): { folderPath: string; customerFolder: string; woFolder: string; created: boolean } {
  const woNumber = extractWoNumber(order.orderNumber);
  const customerFolder = sanitizeFolderName(order.customerName);
  const description = order.description ? sanitizeFolderName(order.description).substring(0, 50) : '';
  const woFolder = description ? `WO${woNumber}_${description}` : `WO${woNumber}`;
  const customerPath = path.join(basePath, customerFolder);
  const orderPath = path.join(customerPath, woFolder);
  let created = false;

  if (createIfMissing && !fs.existsSync(orderPath)) {
    fs.mkdirSync(orderPath, { recursive: true });
    for (const categoryFolder of Object.values(FILE_CATEGORIES)) {
      const categoryPath = path.join(orderPath, categoryFolder);
      if (!fs.existsSync(categoryPath)) {
        fs.mkdirSync(categoryPath);
      }
    }
    created = true;
  }

  return { folderPath: orderPath, customerFolder, woFolder, created };
}

/**
 * Ensure a work order has a network folder, creating one if needed.
 * Used by auto-poll and other automated services.
 */
export async function ensureOrderFolder(orderId: string): Promise<{ folderPath: string; created: boolean } | null> {
  const settings = await prisma.systemSettings.findFirst();
  if (!settings?.networkDriveBasePath) return null;

  const order = await prisma.workOrder.findUnique({
    where: { id: orderId },
    select: {
      orderNumber: true,
      customerName: true,
      description: true,
      customer: { select: { networkDriveFolderPath: true } },
    },
  });
  if (!order) return null;

  // First try to find existing folder
  const woNumber = extractWoNumber(order.orderNumber);
  const existing = findWoFolder(
    settings.networkDriveBasePath,
    woNumber,
    order.customerName,
    order.customer?.networkDriveFolderPath,
  );
  if (existing.found && existing.folderPath) {
    return { folderPath: existing.folderPath, created: false };
  }

  // Create new folder
  const result = getOrCreateOrderFolder(settings.networkDriveBasePath, order, true);
  return { folderPath: result.folderPath, created: result.created };
}
