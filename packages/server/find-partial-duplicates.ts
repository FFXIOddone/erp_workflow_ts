/**
 * Find Partial Match Duplicates
 * 
 * Finds customers where one name might be a shortened version of another
 * (e.g., "A.W.O.L" and "A.W.O.L Custom Tattooing Inc.")
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
 * Normalize name for comparison - remove punctuation, extra spaces, lowercase
 */
function normalizeForComparison(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove all punctuation
    .replace(/\s+/g, ' ')    // Normalize spaces
    .trim();
}

/**
 * Check if one normalized name starts with another (potential partial match)
 */
function isPotentialPartialMatch(name1: string, name2: string): boolean {
  const norm1 = normalizeForComparison(name1);
  const norm2 = normalizeForComparison(name2);
  
  // Skip if they're the same
  if (norm1 === norm2) return false;
  
  // Skip very short names (3 chars or less) - too many false positives
  const shorter = norm1.length < norm2.length ? norm1 : norm2;
  if (shorter.length <= 3) return false;
  
  // Check if one starts with the other
  if (norm1.startsWith(norm2) || norm2.startsWith(norm1)) {
    return true;
  }
  
  // Check if the shorter one appears as the first word(s) of the longer one
  const words1 = norm1.split(' ');
  const words2 = norm2.split(' ');
  
  const shorterWords = words1.length < words2.length ? words1 : words2;
  const longerWords = words1.length < words2.length ? words2 : words1;
  
  // Check if all words of shorter appear at start of longer
  if (shorterWords.length >= 1 && shorterWords.length < longerWords.length) {
    const matches = shorterWords.every((word, i) => longerWords[i] === word);
    if (matches) return true;
  }
  
  return false;
}

interface PotentialDuplicate {
  customer1: CustomerWithCount;
  customer2: CustomerWithCount;
  similarity: string;
}

async function main() {
  console.log('🔍 Finding Partial Match Duplicates');
  console.log('====================================\n');

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

  const potentialDuplicates: PotentialDuplicate[] = [];
  const checkedPairs = new Set<string>();

  // Compare each customer with every other customer
  for (let i = 0; i < customers.length; i++) {
    for (let j = i + 1; j < customers.length; j++) {
      const c1 = customers[i];
      const c2 = customers[j];
      
      // Create a unique key for this pair
      const pairKey = [c1.id, c2.id].sort().join('-');
      if (checkedPairs.has(pairKey)) continue;
      checkedPairs.add(pairKey);
      
      if (isPotentialPartialMatch(c1.name, c2.name)) {
        potentialDuplicates.push({
          customer1: c1,
          customer2: c2,
          similarity: `"${normalizeForComparison(c1.name)}" ~ "${normalizeForComparison(c2.name)}"`,
        });
      }
    }
    
    // Progress indicator
    if (i % 500 === 0) {
      process.stdout.write(`\rChecking customer ${i + 1}/${customers.length}...`);
    }
  }

  console.log(`\r\nFound ${potentialDuplicates.length} potential partial matches\n`);

  // Sort by the shorter name (more likely to be the abbreviated version)
  potentialDuplicates.sort((a, b) => {
    const aMin = Math.min(a.customer1.name.length, a.customer2.name.length);
    const bMin = Math.min(b.customer1.name.length, b.customer2.name.length);
    return aMin - bMin;
  });

  // Display results grouped by similarity
  console.log('='.repeat(80));
  console.log('POTENTIAL PARTIAL DUPLICATES');
  console.log('='.repeat(80));
  
  for (const dup of potentialDuplicates) {
    const c1 = dup.customer1;
    const c2 = dup.customer2;
    
    console.log(`\n📌 POTENTIAL MATCH:`);
    console.log(`   1: "${c1.name}"`);
    console.log(`      Orders: ${c1._count.workOrders}, Quotes: ${c1._count.quotes}`);
    if (c1.address) console.log(`      Address: ${c1.address}, ${c1.city || ''} ${c1.state || ''}`);
    if (c1.phone) console.log(`      Phone: ${c1.phone}`);
    if (c1.email) console.log(`      Email: ${c1.email}`);
    
    console.log(`   2: "${c2.name}"`);
    console.log(`      Orders: ${c2._count.workOrders}, Quotes: ${c2._count.quotes}`);
    if (c2.address) console.log(`      Address: ${c2.address}, ${c2.city || ''} ${c2.state || ''}`);
    if (c2.phone) console.log(`      Phone: ${c2.phone}`);
    if (c2.email) console.log(`      Email: ${c2.email}`);
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
