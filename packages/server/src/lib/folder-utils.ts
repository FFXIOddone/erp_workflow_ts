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

function isSearchableDirectory(name: string): boolean {
  return !name.startsWith('.') && !name.startsWith('$');
}

function searchWoFolderTree(startPath: string, woPattern: RegExp, maxDepth = 4): string | null {
  const normalizedStart = path.resolve(startPath);
  const startName = path.basename(normalizedStart);
  if (woPattern.test(startName)) {
    return normalizedStart;
  }

  const queue: Array<{ dir: string; depth: number }> = [{ dir: normalizedStart, depth: 0 }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.dir)) {
      continue;
    }
    visited.add(current.dir);

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current.dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || !isSearchableDirectory(entry.name)) {
        continue;
      }

      const childPath = path.join(current.dir, entry.name);
      if (woPattern.test(entry.name)) {
        return childPath;
      }

      if (current.depth + 1 <= maxDepth) {
        queue.push({ dir: childPath, depth: current.depth + 1 });
      }
    }
  }

  return null;
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSearchTerms(value: string): string[] {
  const terms = normalizeSearchText(value)
    .split(' ')
    .filter((term) => term.length >= 4);
  return Array.from(new Set(terms));
}

function matchesTerms(haystack: string, terms: string[]): boolean {
  if (terms.length === 0) {
    return false;
  }

  const normalizedHaystack = normalizeSearchText(haystack);
  const matchCount = terms.reduce((count, term) => (
    normalizedHaystack.includes(term) ? count + 1 : count
  ), 0);
  const requiredMatches = terms.length <= 2 ? terms.length : 2;

  return matchCount >= requiredMatches;
}

function searchTreeForMatch(
  startPath: string,
  matcher: (entryName: string, fullPath: string) => boolean,
  maxDepth = 4,
): string | null {
  const normalizedStart = path.resolve(startPath);
  const queue: Array<{ dir: string; depth: number }> = [{ dir: normalizedStart, depth: 0 }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.dir)) {
      continue;
    }
    visited.add(current.dir);

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current.dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!isSearchableDirectory(entry.name)) {
        continue;
      }

      const childPath = path.join(current.dir, entry.name);
      if (matcher(entry.name, childPath)) {
        return childPath;
      }

      if (entry.isDirectory() && current.depth + 1 <= maxDepth) {
        queue.push({ dir: childPath, depth: current.depth + 1 });
      }
    }
  }

  return null;
}

export interface ShipmentEvidenceResult {
  found: boolean;
  evidencePath: string | null;
  evidenceRoot: string | null;
  matchedBy: 'wo' | 'customer' | 'description' | null;
  searchedLocations: string[];
}

const SHIPMENT_ROUTE_CANDIDATES = [
  { label: 'SHIPPING/2024', relativePaths: [path.join('SHIPPING', '2024')] },
  { label: 'SHIPPING', relativePaths: ['SHIPPING'] },
  { label: 'FEDEX/FREIGHT', relativePaths: [path.join('FEDEX', 'FREIGHT'), 'FEDEX FREIGHT'] },
  { label: 'FEDEX/FedEx Invoices', relativePaths: [path.join('FEDEX', 'FedEx Invoices')] },
  { label: 'FEDEX', relativePaths: ['FEDEX'] },
  { label: 'PAMELA SHIPPING', relativePaths: ['PAMELA SHIPPING'] },
] as const;

function resolveShipmentRoots(basePath: string): Array<{ label: string; path: string }> {
  const resolvedBase = path.resolve(basePath);
  const roots: Array<{ label: string; path: string }> = [];
  const seen = new Set<string>();

  for (const candidate of SHIPMENT_ROUTE_CANDIDATES) {
    for (const relativePath of candidate.relativePaths) {
      const rootPath = path.resolve(path.join(resolvedBase, relativePath));
      if (seen.has(rootPath)) {
        continue;
      }
      if (!fs.existsSync(rootPath)) {
        continue;
      }
      try {
        if (!fs.statSync(rootPath).isDirectory()) {
          continue;
        }
      } catch {
        continue;
      }

      seen.add(rootPath);
      roots.push({ label: candidate.label, path: rootPath });
    }
  }

  return roots;
}

export function findShipmentEvidence(
  basePath: string,
  woNumber: string,
  customerName: string,
  description?: string | null,
): ShipmentEvidenceResult {
  const searchedLocations: string[] = [];
  const roots = resolveShipmentRoots(basePath);
  const woPattern = new RegExp(`WO[#\\s\\-]*${escapeRegExp(woNumber)}(?:\\D|$)`, 'i');
  const customerTerms = buildSearchTerms(customerName);
  const descriptionTerms = buildSearchTerms(description ?? '');
  const searchStrategies = [
    { matchedBy: 'wo' as const, matcher: (entryName: string, fullPath: string) => woPattern.test(entryName) || woPattern.test(fullPath) },
    {
      matchedBy: 'customer' as const,
      matcher: (entryName: string, fullPath: string) => matchesTerms(entryName, customerTerms) || matchesTerms(fullPath, customerTerms),
    },
    {
      matchedBy: 'description' as const,
      matcher: (entryName: string, fullPath: string) => matchesTerms(entryName, descriptionTerms) || matchesTerms(fullPath, descriptionTerms),
    },
  ];

  for (const strategy of searchStrategies) {
    if (strategy.matchedBy === 'customer' && customerTerms.length === 0) {
      continue;
    }
    if (strategy.matchedBy === 'description' && descriptionTerms.length === 0) {
      continue;
    }

    for (const root of roots) {
      searchedLocations.push(`${root.label}: ${root.path}`);
      const match = searchTreeForMatch(root.path, strategy.matcher, 5);
      if (match) {
        return {
          found: true,
          evidencePath: match,
          evidenceRoot: root.label,
          matchedBy: strategy.matchedBy,
          searchedLocations,
        };
      }
    }
  }

  return {
    found: false,
    evidencePath: null,
    evidenceRoot: null,
    matchedBy: null,
    searchedLocations,
  };
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
        const foundPath = searchWoFolderTree(overridePath, woPattern, 4);
        if (foundPath) {
          return {
            found: true,
            folderPath: foundPath,
            folderName: path.basename(foundPath),
            customerFolder: customerFolderOverride,
            searchedLocations,
          };
        }
      }
    } catch {}
  }

  // Strategy 1: Direct WO folder at the base path root
  searchedLocations.push(`Root scan: ${basePath}`);
  try {
    const rootMatch = searchWoFolderTree(basePath, woPattern, 1);
    if (rootMatch) {
      return {
        found: true,
        folderPath: rootMatch,
        folderName: path.basename(rootMatch),
        customerFolder: null,
        searchedLocations,
      };
    }
  } catch {}

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
      const foundPath = searchWoFolderTree(path.join(basePath, exactMatch), woPattern, 4);
      if (foundPath) {
        return {
          found: true,
          folderPath: foundPath,
          folderName: path.basename(foundPath),
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
      const foundPath = searchWoFolderTree(path.join(basePath, folder), woPattern, 4);
      if (foundPath) {
        return {
          found: true,
          folderPath: foundPath,
          folderName: path.basename(foundPath),
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
      const foundPath = searchWoFolderTree(path.join(basePath, folder), woPattern, 4);
      if (foundPath) {
        return {
          found: true,
          folderPath: foundPath,
          folderName: path.basename(foundPath),
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
