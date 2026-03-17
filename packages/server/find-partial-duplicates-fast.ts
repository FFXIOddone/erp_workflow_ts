/**
 * Find Partial Match Duplicates - Optimized Version
 * 
 * Finds customers where one name might be a shortened version of another
 * Uses prefix grouping for faster matching
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
  _count: {
    workOrders: number;
    quotes: number;
  };
}

/**
 * Normalize name for comparison
 */
function normalizeForComparison(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Get first N words as a prefix key
 */
function getPrefix(normalizedName: string, wordCount: number): string {
  return normalizedName.split(' ').slice(0, wordCount).join(' ');
}

interface PotentialDuplicate {
  customer1: CustomerWithCount;
  customer2: CustomerWithCount;
  norm1: string;
  norm2: string;
}

async function main() {
  console.log('🔍 Finding Partial Match Duplicates (Optimized)');
  console.log('================================================\n');

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

  // Build a map of normalized names to customers
  const normalizedMap = new Map<string, CustomerWithCount[]>();
  const customerNorms = new Map<string, string>(); // id -> normalized name
  
  for (const c of customers) {
    const norm = normalizeForComparison(c.name);
    customerNorms.set(c.id, norm);
    
    if (!normalizedMap.has(norm)) {
      normalizedMap.set(norm, []);
    }
    normalizedMap.get(norm)!.push(c);
  }

  // Group by first word for faster prefix matching
  const prefixGroups = new Map<string, CustomerWithCount[]>();
  
  for (const c of customers) {
    const norm = customerNorms.get(c.id)!;
    const firstWord = norm.split(' ')[0];
    if (firstWord.length < 2) continue; // Skip very short first words
    
    if (!prefixGroups.has(firstWord)) {
      prefixGroups.set(firstWord, []);
    }
    prefixGroups.get(firstWord)!.push(c);
  }

  console.log(`Prefix groups: ${prefixGroups.size}\n`);

  const potentialDuplicates: PotentialDuplicate[] = [];
  const checkedPairs = new Set<string>();

  // Only compare within prefix groups
  let groupsChecked = 0;
  for (const [prefix, group] of prefixGroups) {
    if (group.length < 2) continue; // Need at least 2 to compare
    
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const c1 = group[i];
        const c2 = group[j];
        
        const pairKey = [c1.id, c2.id].sort().join('-');
        if (checkedPairs.has(pairKey)) continue;
        checkedPairs.add(pairKey);
        
        const norm1 = customerNorms.get(c1.id)!;
        const norm2 = customerNorms.get(c2.id)!;
        
        // Skip if same normalized name (already handled by exact duplicate merge)
        if (norm1 === norm2) continue;
        
        // Check if one starts with the other
        if (norm1.startsWith(norm2) || norm2.startsWith(norm1)) {
          potentialDuplicates.push({ customer1: c1, customer2: c2, norm1, norm2 });
        }
      }
    }
    
    groupsChecked++;
    if (groupsChecked % 100 === 0) {
      process.stdout.write(`\rChecking prefix group ${groupsChecked}/${prefixGroups.size}...`);
    }
  }

  console.log(`\r\nFound ${potentialDuplicates.length} potential partial matches\n`);

  // Sort by shorter name length (abbreviated ones first)
  potentialDuplicates.sort((a, b) => {
    const aMin = Math.min(a.norm1.length, a.norm2.length);
    const bMin = Math.min(b.norm1.length, b.norm2.length);
    return aMin - bMin;
  });

  // Display results
  console.log('='.repeat(80));
  console.log('POTENTIAL PARTIAL DUPLICATES');
  console.log('='.repeat(80));
  
  for (const dup of potentialDuplicates) {
    const c1 = dup.customer1;
    const c2 = dup.customer2;
    
    console.log(`\n📌 POTENTIAL MATCH:`);
    console.log(`   1: "${c1.name}"`);
    console.log(`      Normalized: "${dup.norm1}"`);
    console.log(`      Orders: ${c1._count.workOrders}, Quotes: ${c1._count.quotes}`);
    if (c1.address) console.log(`      Address: ${c1.address}, ${c1.city || ''} ${c1.state || ''}`);
    if (c1.phone) console.log(`      Phone: ${c1.phone}`);
    
    console.log(`   2: "${c2.name}"`);
    console.log(`      Normalized: "${dup.norm2}"`);
    console.log(`      Orders: ${c2._count.workOrders}, Quotes: ${c2._count.quotes}`);
    if (c2.address) console.log(`      Address: ${c2.address}, ${c2.city || ''} ${c2.state || ''}`);
    if (c2.phone) console.log(`      Phone: ${c2.phone}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log(`TOTAL: ${potentialDuplicates.length} potential partial matches found`);
  console.log('='.repeat(80));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Error:', e);
  prisma.$disconnect();
  process.exit(1);
});
