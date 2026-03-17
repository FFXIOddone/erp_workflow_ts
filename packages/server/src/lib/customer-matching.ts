/**
 * Customer Matching Utility
 * 
 * Resolves a customer name (from order entry, WooCommerce, etc.)
 * to a customerId by fuzzy-matching against the Customer table.
 */
import { prisma } from '../db/client.js';

function normalize(s: string): string {
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripSuffix(name: string): string {
  return name
    .replace(/\s+PO\s*#?\s*\d+.*$/i, '')
    .replace(/\s+PO['']?S?\s+\d+.*$/i, '')
    .replace(/\s*\([^)]*\)\s*/g, '')
    .replace(/\s*#\d+$/i, '')
    .replace(/;\s*.+$/i, '')
    .trim();
}

/**
 * Try to find a matching customer ID for the given customer name.
 * Uses progressively looser matching strategies:
 * 1. Exact case-insensitive match on name or companyName
 * 2. Match after stripping PO numbers, franchise codes, etc.
 * 3. Contains match (one name contains the other)
 * 
 * Returns the customer ID if found, null otherwise.
 */
export async function resolveCustomerId(customerName: string): Promise<string | null> {
  if (!customerName || customerName.trim().length === 0) return null;

  const norm = normalize(customerName);
  
  // Strategy 1: Case-insensitive exact match on name or companyName
  const exactMatch = await prisma.customer.findFirst({
    where: {
      OR: [
        { name: { equals: customerName, mode: 'insensitive' } },
        { companyName: { equals: customerName, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  });
  if (exactMatch) return exactMatch.id;

  // Strategy 2: Try with suffixes stripped (PO numbers, franchise codes, etc.)
  const stripped = stripSuffix(customerName);
  if (stripped !== customerName && stripped.length >= 3) {
    const strippedMatch = await prisma.customer.findFirst({
      where: {
        OR: [
          { name: { equals: stripped, mode: 'insensitive' } },
          { companyName: { equals: stripped, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    if (strippedMatch) return strippedMatch.id;
  }

  // Strategy 3: Contains match — customer name contains the search term or vice versa
  // Only do this for names with 4+ chars to avoid false matches
  if (norm.length >= 4) {
    const containsMatch = await prisma.customer.findFirst({
      where: {
        OR: [
          { name: { contains: customerName, mode: 'insensitive' } },
          { companyName: { contains: customerName, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    if (containsMatch) return containsMatch.id;
    
    // Also try with stripped name
    if (stripped !== customerName && stripped.length >= 4) {
      const strippedContains = await prisma.customer.findFirst({
        where: {
          OR: [
            { name: { contains: stripped, mode: 'insensitive' } },
            { companyName: { contains: stripped, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      if (strippedContains) return strippedContains.id;
    }
  }

  return null;
}
