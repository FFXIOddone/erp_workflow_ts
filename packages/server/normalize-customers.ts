/**
 * Customer Name Normalization Script
 * 
 * This script:
 * 1. Normalizes customer names to Title Case (preserving abbreviations)
 * 2. Removes trailing apostrophes and unnecessary punctuation
 * 3. Fixes double spaces
 * 4. Merges duplicate customers (transfers orders/quotes to the surviving customer)
 * 5. Validates known company name formats
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Known company name formats (correct casing/symbols)
const KNOWN_COMPANY_FORMATS: Record<string, string> = {
  '7-eleven': '7-Eleven',
  '7 eleven': '7-Eleven',
  'seven eleven': '7-Eleven',
  'make-a-wish': 'Make-A-Wish',
  'make a wish': 'Make-A-Wish',
  'coca-cola': 'Coca-Cola',
  'coca cola': 'Coca-Cola',
  'chick-fil-a': 'Chick-fil-A',
  'chick fil a': 'Chick-fil-A',
  'wal-mart': 'Walmart',
  'walmart': 'Walmart',
  'mcdonald\'s': 'McDonald\'s',
  'mcdonalds': 'McDonald\'s',
  't-mobile': 'T-Mobile',
  't mobile': 'T-Mobile',
  'at&t': 'AT&T',
  'at & t': 'AT&T',
  'cvs': 'CVS',
  'ups': 'UPS',
  'dhl': 'DHL',
  'ibm': 'IBM',
  'aaa': 'AAA',
  'ymca': 'YMCA',
  'ywca': 'YWCA',
  'kfc': 'KFC',
  'bmw': 'BMW',
  'bp': 'BP',
  'gm': 'GM',
  'ge': 'GE',
  'nfl': 'NFL',
  'nba': 'NBA',
  'mlb': 'MLB',
  'nhl': 'NHL',
  'espn': 'ESPN',
  'hbo': 'HBO',
  'cbs': 'CBS',
  'nbc': 'NBC',
  'abc': 'ABC',
  'fox': 'Fox',
  're/max': 'RE/MAX',
  'remax': 'RE/MAX',
  're max': 'RE/MAX',
  'o\'reilly': "O'Reilly",
  'oreilly': "O'Reilly",
  'meijer': 'Meijer',
  'kroger': 'Kroger',
  'speedway': 'Speedway',
  'verizon': 'Verizon',
  'sprint': 'Sprint',
};

// Words that should remain ALL CAPS
const KEEP_UPPERCASE = new Set([
  'LLC', 'INC', 'CO', 'LTD', 'LP', 'LLP', 'PC', 'PA', 'PLLC', 'DBA',
  'USA', 'US', 'MI', 'OH', 'IN', 'IL', 'TX', 'CA', 'NY', 'FL', 'PA', 'GA', 'NC', 'SC',
  'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'AT', 'OF', 'THE', 'AND', 'OR', 'FOR', 'BY', 'IN', 'ON', 'TO', 'A', 'AN', // These get lowercase except at start
  'TV', 'AM', 'PM', 'FM', 'AC', 'DC', 'HQ', 'HR', 'IT', 'PR', 'VIP',
  'CEO', 'CFO', 'COO', 'CTO', 'VP', 'EVP', 'SVP',
  'MD', 'PHD', 'DDS', 'DMD', 'DO', 'RN', 'CPA', 'ESQ',
  'NE', 'NW', 'SE', 'SW', 'N', 'S', 'E', 'W',
  'PO', 'BOX',
  'BBQ',
]);

// Words that should be lowercase (unless at start of name)
const LOWERCASE_WORDS = new Set([
  'of', 'the', 'and', 'or', 'for', 'by', 'in', 'on', 'to', 'a', 'an', 'at',
  'de', 'la', 'el', 'los', 'las', 'del', 'van', 'von', 'der', 'den',
]);

// Suffixes that indicate legitimate trailing periods
const VALID_SUFFIXES = new Set([
  'INC.', 'CO.', 'LTD.', 'CORP.', 'LLC.', 'L.L.C.', 'P.C.', 'P.A.',
  'JR.', 'SR.', 'DR.', 'MR.', 'MRS.', 'MS.', 'ST.', 'AVE.', 'BLVD.',
]);

interface CustomerWithRelations {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  paymentTerms: string | null;
  notes: string | null;
  _count: {
    workOrders: number;
    quotes: number;
  };
}

interface NormalizationResult {
  original: string;
  normalized: string;
  changes: string[];
}

/**
 * Normalize a single customer name
 */
function normalizeName(name: string): NormalizationResult {
  const changes: string[] = [];
  let result = name;

  // 1. Fix double/multiple spaces
  const spacesFixed = result.replace(/\s{2,}/g, ' ');
  if (spacesFixed !== result) {
    changes.push('Fixed multiple spaces');
    result = spacesFixed;
  }

  // 2. Trim whitespace
  const trimmed = result.trim();
  if (trimmed !== result) {
    changes.push('Trimmed whitespace');
    result = trimmed;
  }

  // 3. Remove trailing apostrophes (but not legitimate ones like McDonald's)
  // Only remove if it's at the very end and not part of a possessive/contraction
  if (result.endsWith("'") && !result.match(/\w's$/i)) {
    result = result.slice(0, -1);
    changes.push("Removed trailing apostrophe");
  }

  // 4. Remove trailing curly quotes
  if (result.endsWith('\u201C') || result.endsWith('\u201D') || result.endsWith('\u2019')) {
    result = result.slice(0, -1);
    changes.push("Removed trailing quote");
  }

  // 5. Check for known company formats first
  const lowerName = result.toLowerCase().replace(/[^\w\s-]/g, '');
  for (const [pattern, correct] of Object.entries(KNOWN_COMPANY_FORMATS)) {
    if (lowerName === pattern || lowerName.startsWith(pattern + ' ') || lowerName.endsWith(' ' + pattern)) {
      // Replace the matching portion with correct format
      const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const before = result;
      result = result.replace(regex, correct);
      if (before !== result) {
        changes.push(`Applied known format: ${correct}`);
      }
    }
  }

  // 6. Apply Title Case to ALL CAPS names
  if (result === result.toUpperCase() && result.length > 3) {
    result = toTitleCase(result);
    changes.push('Converted from ALL CAPS to Title Case');
  }

  // 7. Check for invalid trailing periods (not Inc., Co., etc.)
  if (result.endsWith('.')) {
    const lastWord = result.split(/\s+/).pop()?.toUpperCase() || '';
    if (!VALID_SUFFIXES.has(lastWord)) {
      result = result.slice(0, -1);
      changes.push('Removed invalid trailing period');
    }
  }

  // 8. Normalize special characters
  // Replace fancy quotes with standard ones
  result = result.replace(/[\u2018\u2019]/g, "'");
  result = result.replace(/[\u201C\u201D]/g, '"');

  // 9. Handle registered trademark symbol (keep it for authentic company names)
  // MAKE-A-WISH® MICHIGAN -> Make-A-Wish® Michigan
  // This is handled by the Title Case conversion

  return {
    original: name,
    normalized: result,
    changes,
  };
}

/**
 * Convert string to Title Case while preserving abbreviations
 */
function toTitleCase(str: string): string {
  const words = str.split(/(\s+|-)/); // Split on spaces and hyphens, keeping delimiters
  
  return words.map((word, index) => {
    // Keep delimiters as-is
    if (word.match(/^[\s-]+$/)) {
      return word;
    }

    const upperWord = word.toUpperCase();
    
    // Keep ALL CAPS abbreviations
    if (KEEP_UPPERCASE.has(upperWord)) {
      // But make sure to use the right casing
      if (['OF', 'THE', 'AND', 'OR', 'FOR', 'BY', 'IN', 'ON', 'TO', 'A', 'AN', 'AT'].includes(upperWord)) {
        // These should be lowercase unless at start
        return index === 0 ? capitalize(word) : word.toLowerCase();
      }
      return upperWord;
    }

    // Handle possessives (McDonald's, O'Reilly)
    if (word.includes("'")) {
      const parts = word.split("'");
      return parts.map((part, i) => {
        if (i === 0) return capitalize(part);
        if (part.toLowerCase() === 's') return "'s";
        return "'" + capitalize(part);
      }).join('');
    }

    // Handle Mc/Mac prefixes (McDonald, MacArthur)
    if (word.toLowerCase().startsWith('mc') && word.length > 2) {
      return 'Mc' + capitalize(word.slice(2));
    }
    if (word.toLowerCase().startsWith('mac') && word.length > 3) {
      // Be careful - not all "Mac" words are names (machine, etc.)
      // Only apply if the next char is uppercase or the whole word was uppercase
      return 'Mac' + capitalize(word.slice(3));
    }

    // Regular title case
    return capitalize(word);
  }).join('');
}

/**
 * Capitalize first letter, lowercase rest
 */
function capitalize(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Create a normalized key for duplicate detection
 */
function createNormalizedKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove all non-alphanumeric
    .replace(/\s+/g, ' ')    // Normalize spaces
    .trim();
}

/**
 * Find and group duplicate customers
 */
async function findDuplicates(): Promise<Map<string, CustomerWithRelations[]>> {
  const customers = await prisma.customer.findMany({
    include: {
      _count: {
        select: {
          workOrders: true,
          quotes: true,
        },
      },
    },
  });

  const groups = new Map<string, CustomerWithRelations[]>();
  
  for (const customer of customers) {
    const key = createNormalizedKey(customer.name);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(customer as CustomerWithRelations);
  }

  // Filter to only groups with more than one customer
  const duplicates = new Map<string, CustomerWithRelations[]>();
  for (const [key, group] of groups) {
    if (group.length > 1) {
      duplicates.set(key, group);
    }
  }

  return duplicates;
}

/**
 * Select the best customer to keep (one with most orders, then most data)
 */
function selectPrimaryCustomer(customers: CustomerWithRelations[]): CustomerWithRelations {
  return customers.sort((a, b) => {
    // First, prefer customer with orders
    const ordersCompare = b._count.workOrders - a._count.workOrders;
    if (ordersCompare !== 0) return ordersCompare;
    
    // Then prefer customer with quotes
    const quotesCompare = b._count.quotes - a._count.quotes;
    if (quotesCompare !== 0) return quotesCompare;
    
    // Then prefer customer with more complete data
    const aDataScore = [a.email, a.phone, a.address, a.city, a.state, a.zip].filter(Boolean).length;
    const bDataScore = [b.email, b.phone, b.address, b.city, b.state, b.zip].filter(Boolean).length;
    return bDataScore - aDataScore;
  })[0];
}

interface MergeStats {
  duplicatesProcessed: number;
  customersMerged: number;
  ordersTransferred: number;
  quotesTransferred: number;
}

interface NormalizationStats {
  totalCustomers: number;
  customersNormalized: number;
  changesApplied: number;
}

async function main() {
  console.log('🔧 Customer Name Normalization Script');
  console.log('=====================================\n');

  const dryRun = process.argv.includes('--dry-run');
  const mergeOnly = process.argv.includes('--merge-only');
  const normalizeOnly = process.argv.includes('--normalize-only');
  
  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }

  // Get all customers
  const customers = await prisma.customer.findMany({
    include: {
      _count: {
        select: {
          workOrders: true,
          quotes: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  console.log(`📊 Total customers: ${customers.length}\n`);

  // =====================================
  // PHASE 1: Merge Duplicates
  // =====================================
  const mergeStats: MergeStats = {
    duplicatesProcessed: 0,
    customersMerged: 0,
    ordersTransferred: 0,
    quotesTransferred: 0,
  };

  if (!normalizeOnly) {
    console.log('📦 PHASE 1: Merging Duplicate Customers');
    console.log('----------------------------------------\n');

    const duplicates = await findDuplicates();
    console.log(`Found ${duplicates.size} duplicate groups\n`);

    for (const [key, group] of duplicates) {
      const primary = selectPrimaryCustomer(group);
      const others = group.filter(c => c.id !== primary.id);

      console.log(`\n📌 Group: "${key}"`);
      console.log(`   Primary: "${primary.name}" (${primary._count.workOrders} orders, ${primary._count.quotes} quotes)`);
      
      for (const other of others) {
        console.log(`   Merge:   "${other.name}" (${other._count.workOrders} orders, ${other._count.quotes} quotes)`);
        
        if (!dryRun) {
          // Transfer orders
          if (other._count.workOrders > 0) {
            const result = await prisma.workOrder.updateMany({
              where: { customerId: other.id },
              data: { customerId: primary.id },
            });
            mergeStats.ordersTransferred += result.count;
          }

          // Transfer quotes
          if (other._count.quotes > 0) {
            const result = await prisma.quote.updateMany({
              where: { customerId: other.id },
              data: { customerId: primary.id },
            });
            mergeStats.quotesTransferred += result.count;
          }

          // Merge notes if other has notes and primary doesn't
          if (other.notes && !primary.notes) {
            await prisma.customer.update({
              where: { id: primary.id },
              data: { notes: other.notes },
            });
          }

          // Fill in missing data from duplicate
          const updates: Record<string, string> = {};
          if (!primary.email && other.email) updates.email = other.email;
          if (!primary.phone && other.phone) updates.phone = other.phone;
          if (!primary.address && other.address) updates.address = other.address;
          if (!primary.city && other.city) updates.city = other.city;
          if (!primary.state && other.state) updates.state = other.state;
          if (!primary.zip && other.zip) updates.zip = other.zip;
          if (!primary.paymentTerms && other.paymentTerms) updates.paymentTerms = other.paymentTerms;

          if (Object.keys(updates).length > 0) {
            await prisma.customer.update({
              where: { id: primary.id },
              data: updates,
            });
          }

          // Delete the duplicate
          await prisma.customer.delete({
            where: { id: other.id },
          });
          
          mergeStats.customersMerged++;
        }
      }
      
      mergeStats.duplicatesProcessed++;
    }

    console.log('\n📊 Merge Statistics:');
    console.log(`   Duplicate groups processed: ${mergeStats.duplicatesProcessed}`);
    console.log(`   Customers merged/deleted: ${mergeStats.customersMerged}`);
    console.log(`   Orders transferred: ${mergeStats.ordersTransferred}`);
    console.log(`   Quotes transferred: ${mergeStats.quotesTransferred}`);
  }

  // =====================================
  // PHASE 2: Normalize Names
  // =====================================
  const normStats: NormalizationStats = {
    totalCustomers: 0,
    customersNormalized: 0,
    changesApplied: 0,
  };

  if (!mergeOnly) {
    console.log('\n\n✏️  PHASE 2: Normalizing Customer Names');
    console.log('----------------------------------------\n');

    // Re-fetch customers after merge
    const currentCustomers = await prisma.customer.findMany({
      orderBy: { name: 'asc' },
    });

    normStats.totalCustomers = currentCustomers.length;

    const normalizations: Array<{ id: string; original: string; normalized: string; changes: string[] }> = [];

    for (const customer of currentCustomers) {
      const result = normalizeName(customer.name);
      
      if (result.changes.length > 0) {
        normalizations.push({
          id: customer.id,
          original: result.original,
          normalized: result.normalized,
          changes: result.changes,
        });
      }
    }

    console.log(`Customers requiring normalization: ${normalizations.length}\n`);

    // Show sample of changes
    const sampleSize = Math.min(50, normalizations.length);
    console.log(`Sample of ${sampleSize} normalizations:\n`);
    
    for (let i = 0; i < sampleSize; i++) {
      const norm = normalizations[i];
      console.log(`  "${norm.original}"`);
      console.log(`  → "${norm.normalized}"`);
      console.log(`    Changes: ${norm.changes.join(', ')}\n`);
    }

    if (normalizations.length > sampleSize) {
      console.log(`  ... and ${normalizations.length - sampleSize} more\n`);
    }

    // Apply changes
    if (!dryRun) {
      console.log('\nApplying normalizations...');
      
      for (const norm of normalizations) {
        await prisma.customer.update({
          where: { id: norm.id },
          data: { name: norm.normalized },
        });
        normStats.customersNormalized++;
        normStats.changesApplied += norm.changes.length;
      }
    }

    console.log('\n📊 Normalization Statistics:');
    console.log(`   Total customers: ${normStats.totalCustomers}`);
    console.log(`   Customers normalized: ${normStats.customersNormalized}`);
    console.log(`   Total changes applied: ${normStats.changesApplied}`);
  }

  // =====================================
  // Summary
  // =====================================
  console.log('\n\n✅ SUMMARY');
  console.log('==========');
  
  if (!normalizeOnly) {
    console.log(`Duplicates merged: ${mergeStats.customersMerged}`);
    console.log(`Orders transferred: ${mergeStats.ordersTransferred}`);
    console.log(`Quotes transferred: ${mergeStats.quotesTransferred}`);
  }
  
  if (!mergeOnly) {
    console.log(`Names normalized: ${normStats.customersNormalized}`);
  }

  if (dryRun) {
    console.log('\n⚠️  This was a DRY RUN - no changes were made.');
    console.log('Run without --dry-run to apply changes.');
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Error:', e);
  prisma.$disconnect();
  process.exit(1);
});
