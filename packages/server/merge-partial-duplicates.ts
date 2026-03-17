/**
 * Merge Partial Duplicates Script
 * 
 * Focuses on clear duplicates where:
 * - One name is the other + INC/LLC/Company/Corp suffix
 * - Same base business name with minor variations
 * 
 * Does NOT merge:
 * - Different departments/locations (City of X vs City of X - Traffic Dept)
 * - Different numbered locations (Biggby #118 vs #1184)
 * - Parent/child organizations (Muskegon County vs Muskegon County Road Commission)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CustomerWithCount {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  paymentTerms: string | null;
  _count: {
    workOrders: number;
    quotes: number;
  };
}

// Suffixes that indicate a legal entity name vs short name
const LEGAL_SUFFIXES = [
  ' inc', ' llc', ' l.l.c', ' ltd', ' lp', ' l.p', ' llp', ' l.l.p',
  ' corp', ' corporation', ' company', ' co.', ' co',
  ' enterprises', ' enterprise', ' group', ' services', ' service',
  ' limited', ' pllc', ' p.c.', ' pc', ' pa', ' p.a.',
];

// Known correct company name formats (for brand consistency)
const KNOWN_CORRECT_NAMES: Record<string, string> = {
  'bucees': "Buc-ee's, Ltd.",          // Famous Texas gas station chain
  'bucees ltd': "Buc-ee's, Ltd.",
  'fedex freight': 'FedEx Freight',
  'fedex freight inc': 'FedEx Freight',
  'pepsico': 'PepsiCo, Inc.',
  'pepsico inc': 'PepsiCo, Inc.',
  'meijer': 'Meijer, Inc.',
  'meijer inc': 'Meijer, Inc.',
  'herman miller': 'Herman Miller, Inc.',  // Now MillerKnoll but this was their name
  'herman miller inc': 'Herman Miller, Inc.',
  'ht hackney': 'H.T. Hackney Co.',
  'ht hackney co': 'H.T. Hackney Co.',
  'ginos bbq': "Gino's BBQ, Inc.",
  'ginos bbq inc': "Gino's BBQ, Inc.",
  'rubis energy bermuda': 'RUBiS Energy Bermuda Limited',
  'rubis energy bermuda limited': 'RUBiS Energy Bermuda Limited',
};

function normalizeForComparison(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function removeLegalSuffix(normalizedName: string): string {
  let result = normalizedName;
  for (const suffix of LEGAL_SUFFIXES) {
    const normalizedSuffix = suffix.replace(/[^\w\s]/g, '').trim();
    if (result.endsWith(' ' + normalizedSuffix)) {
      result = result.slice(0, -(normalizedSuffix.length + 1)).trim();
    }
  }
  return result;
}

interface DuplicatePair {
  shorter: CustomerWithCount;
  longer: CustomerWithCount;
  shorterNorm: string;
  longerNorm: string;
  reason: string;
}

async function main() {
  console.log('🔍 Finding Clear Duplicate Pairs for Merging');
  console.log('=============================================\n');

  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }

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
  }) as CustomerWithCount[];

  console.log(`Total customers: ${customers.length}\n`);

  // Build normalized name map
  const normalizedMap = new Map<string, CustomerWithCount[]>();
  const customerNorms = new Map<string, string>();
  
  for (const c of customers) {
    const norm = normalizeForComparison(c.name);
    customerNorms.set(c.id, norm);
    
    if (!normalizedMap.has(norm)) {
      normalizedMap.set(norm, []);
    }
    normalizedMap.get(norm)!.push(c);
  }

  // Build base name map (without legal suffixes)
  const baseNameMap = new Map<string, CustomerWithCount[]>();
  
  for (const c of customers) {
    const norm = customerNorms.get(c.id)!;
    const baseName = removeLegalSuffix(norm);
    
    if (!baseNameMap.has(baseName)) {
      baseNameMap.set(baseName, []);
    }
    baseNameMap.get(baseName)!.push(c);
  }

  const duplicatePairs: DuplicatePair[] = [];
  const processedIds = new Set<string>();

  // Find pairs where one is base name and other is base name + legal suffix
  for (const [baseName, group] of baseNameMap) {
    if (group.length < 2) continue;
    if (baseName.length < 4) continue; // Skip very short base names
    
    // Sort by name length (shorter first)
    group.sort((a, b) => a.name.length - b.name.length);
    
    // Check each pair
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const shorter = group[i];
        const longer = group[j];
        
        if (processedIds.has(shorter.id) || processedIds.has(longer.id)) continue;
        
        const shorterNorm = customerNorms.get(shorter.id)!;
        const longerNorm = customerNorms.get(longer.id)!;
        
        // Skip if they're exactly the same (already handled)
        if (shorterNorm === longerNorm) continue;
        
        // The longer one should start with the shorter one
        if (!longerNorm.startsWith(shorterNorm)) continue;
        
        // The extra part should be a legal suffix or minor addition
        const extra = longerNorm.slice(shorterNorm.length).trim();
        
        // Check if extra is a legal suffix
        const isLegalSuffix = LEGAL_SUFFIXES.some(s => {
          const normSuffix = s.replace(/[^\w\s]/g, '').trim();
          return extra === normSuffix;
        });
        
        // Also allow "s" at the end (singular vs plural)
        const isPluralization = extra === 's';
        
        if (isLegalSuffix || isPluralization) {
          duplicatePairs.push({
            shorter,
            longer,
            shorterNorm,
            longerNorm,
            reason: isPluralization ? 'Singular/Plural' : 'Legal Suffix'
          });
          processedIds.add(shorter.id);
          processedIds.add(longer.id);
        }
      }
    }
  }

  console.log(`Found ${duplicatePairs.length} clear duplicate pairs\n`);
  console.log('='.repeat(80));

  let mergedCount = 0;
  let ordersTransferred = 0;
  let quotesTransferred = 0;

  for (const pair of duplicatePairs) {
    const { shorter, longer, reason, shorterNorm } = pair;
    
    // Check if we have a known correct name for this company
    const knownName = KNOWN_CORRECT_NAMES[shorterNorm] || KNOWN_CORRECT_NAMES[pair.longerNorm];
    
    // Determine which to keep:
    // 1. If we have a known correct name, use that
    // 2. Otherwise prefer the one with more orders
    // 3. If equal, prefer the longer (more formal) name
    let keep: CustomerWithCount;
    let merge: CustomerWithCount;
    let finalName: string | null = null;
    
    if (knownName) {
      // We have a known correct name - pick the one with more orders as "keep"
      if (shorter._count.workOrders >= longer._count.workOrders) {
        keep = shorter;
        merge = longer;
      } else {
        keep = longer;
        merge = shorter;
      }
      finalName = knownName;
    } else if (shorter._count.workOrders > longer._count.workOrders) {
      keep = shorter;
      merge = longer;
    } else if (longer._count.workOrders > shorter._count.workOrders) {
      keep = longer;
      merge = shorter;
    } else {
      // Equal orders, prefer longer (more formal) name
      keep = longer;
      merge = shorter;
    }

    console.log(`\n📌 ${reason}: "${shorter.name}" ↔ "${longer.name}"`);
    if (finalName) {
      console.log(`   Keep:  "${keep.name}" → RENAME TO "${finalName}" (${keep._count.workOrders} orders)`);
    } else {
      console.log(`   Keep:  "${keep.name}" (${keep._count.workOrders} orders)`);
    }
    console.log(`   Merge: "${merge.name}" (${merge._count.workOrders} orders)`);

    if (!dryRun) {
      // Transfer orders
      if (merge._count.workOrders > 0) {
        const result = await prisma.workOrder.updateMany({
          where: { customerId: merge.id },
          data: { customerId: keep.id },
        });
        ordersTransferred += result.count;
      }

      // Transfer quotes
      if (merge._count.quotes > 0) {
        const result = await prisma.quote.updateMany({
          where: { customerId: merge.id },
          data: { customerId: keep.id },
        });
        quotesTransferred += result.count;
      }

      // Merge data from merge into keep
      const updates: Record<string, string> = {};
      if (finalName) updates.name = finalName;  // Apply correct name
      if (!keep.email && merge.email) updates.email = merge.email;
      if (!keep.phone && merge.phone) updates.phone = merge.phone;
      if (!keep.address && merge.address) updates.address = merge.address;
      if (!keep.city && merge.city) updates.city = merge.city;
      if (!keep.state && merge.state) updates.state = merge.state;
      if (!keep.notes && merge.notes) updates.notes = merge.notes;
      if (!keep.paymentTerms && merge.paymentTerms) updates.paymentTerms = merge.paymentTerms;

      if (Object.keys(updates).length > 0) {
        await prisma.customer.update({
          where: { id: keep.id },
          data: updates,
        });
      }

      // Delete the merged customer
      await prisma.customer.delete({
        where: { id: merge.id },
      });
      
      mergedCount++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Duplicate pairs found: ${duplicatePairs.length}`);
  console.log(`Customers merged: ${mergedCount}`);
  console.log(`Orders transferred: ${ordersTransferred}`);
  console.log(`Quotes transferred: ${quotesTransferred}`);
  
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
