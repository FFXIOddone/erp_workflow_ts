/**
 * Customer Name Analysis Script
 * Finds duplicates, ALL CAPS entries, and unusual formatting
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Analyzing customer names...\n');
  
  const allCustomers = await prisma.customer.findMany({
    select: { 
      id: true, 
      name: true, 
      companyName: true,
      email: true,
      phone: true,
      _count: { select: { workOrders: true, quotes: true } }
    },
    orderBy: { name: 'asc' },
  });
  
  console.log(`Total customers: ${allCustomers.length}\n`);
  
  // Find potential duplicates by normalizing names
  const nameMap = new Map<string, typeof allCustomers>();
  
  allCustomers.forEach(c => {
    // Normalize: lowercase, remove all non-alphanumeric
    const normalized = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!nameMap.has(normalized)) nameMap.set(normalized, []);
    nameMap.get(normalized)!.push(c);
  });
  
  console.log('=== POTENTIAL DUPLICATES ===');
  let dupCount = 0;
  for (const [key, customers] of nameMap.entries()) {
    if (customers.length > 1) {
      dupCount++;
      console.log('\n--- Duplicate Group ---');
      customers.forEach(c => {
        const orders = c._count.workOrders;
        const quotes = c._count.quotes;
        console.log(`  "${c.name}" (${orders} orders, ${quotes} quotes)`);
      });
    }
  }
  console.log(`\nTotal duplicate groups: ${dupCount}`);
  
  // Find names that are ALL CAPS
  const allCaps = allCustomers.filter(c => 
    c.name === c.name.toUpperCase() && 
    c.name.length > 3 &&
    /[A-Z]/.test(c.name) // Has at least one letter
  );
  console.log(`\n=== ALL CAPS NAMES: ${allCaps.length} ===`);
  
  // Find names with unusual characters
  const unusualChars = allCustomers.filter(c => 
    /[^\w\s\-\.\,\&\'\(\)\#\/]/.test(c.name)
  );
  console.log(`\n=== NAMES WITH UNUSUAL CHARACTERS: ${unusualChars.length} ===`);
  unusualChars.slice(0, 20).forEach(c => console.log(`  "${c.name}"`));
  
  // Find names with trailing/leading spaces
  const extraSpaces = allCustomers.filter(c => 
    c.name !== c.name.trim() || /\s{2,}/.test(c.name)
  );
  console.log(`\n=== NAMES WITH EXTRA SPACES: ${extraSpaces.length} ===`);
  extraSpaces.slice(0, 10).forEach(c => console.log(`  "${c.name}"`));
  
  // Find names with trailing punctuation
  const trailingPunct = allCustomers.filter(c => 
    /[\'\"\,\.]$/.test(c.name.trim())
  );
  console.log(`\n=== NAMES WITH TRAILING PUNCTUATION: ${trailingPunct.length} ===`);
  trailingPunct.forEach(c => console.log(`  "${c.name}"`));
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
