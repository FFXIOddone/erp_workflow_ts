/**
 * Organize Franchise/Multi-Location Companies
 * 
 * Finds companies with numbered locations (e.g., "Biggby Coffee #118")
 * and organizes them under a parent company using CustomerHierarchy.
 * 
 * Patterns detected:
 * - "Company Name #123" - Store number
 * - "Company Name - Location" - Named location
 * - "Company Name (City)" - City-based location
 */

import { PrismaClient, CustomerRelationType } from '@prisma/client';

const prisma = new PrismaClient();

interface CustomerInfo {
  id: string;
  name: string;
  orderCount: number;
}

interface FranchiseGroup {
  baseName: string;
  parentName: string;  // The clean parent company name
  locations: CustomerInfo[];
  hasExistingParent: boolean;
  existingParentId?: string;
}

// Known franchise/multi-location companies and their correct parent names
const KNOWN_FRANCHISES: Record<string, string> = {
  // === FOUND IN DATABASE ===
  'biggby coffee': 'Biggby Coffee',
  'biggby': 'Biggby Coffee',
  'norwex': 'Norwex',                       // MLM cleaning products
  'inner workings': 'InnerWorkings',        // Marketing/print company
  'prairie farms': 'Prairie Farms Dairy',   // Dairy company
  'city of muskegon': 'City of Muskegon',   // Government - merge depts
  
  // === COMMON FRANCHISES (for future imports) ===
  'kwikfill': 'Kwik Fill',
  'kwik fill': 'Kwik Fill',
  'country fair': 'Country Fair',
  'countryfair': 'Country Fair',
  'stop and go': 'Stop and Go',
  'stop n go': 'Stop and Go',
  'stopngo': 'Stop and Go',
  'marathon': 'Marathon',
  'shell': 'Shell',
  'bp': 'BP',
  'circle k': 'Circle K',
  'speedway': 'Speedway',
  'pilot': 'Pilot',
  'loves': "Love's Travel Stops",
  "love's": "Love's Travel Stops",
  'ta': 'TravelCenters of America',
  'petro': 'Petro Stopping Centers',
  'flying j': 'Flying J',
  'sheetz': 'Sheetz',
  'wawa': 'Wawa',
  'racetrac': 'RaceTrac',
  'quiktrip': 'QuikTrip',
  'qt': 'QuikTrip',
  'caseys': "Casey's General Stores",
  "casey's": "Casey's General Stores",
  'kum and go': 'Kum & Go',
  'kum & go': 'Kum & Go',
  'holiday': 'Holiday Stationstores',
  'maverik': 'Maverik',
  'cumberland farms': 'Cumberland Farms',
  'mapco': 'MAPCO',
  'ampm': 'ampm',
  'am pm': 'ampm',
  'amoco': 'Amoco',
  'chevron': 'Chevron',
  'citgo': 'CITGO',
  'conoco': 'Conoco',
  'exxon': 'Exxon',
  'mobil': 'Mobil',
  'phillips 66': 'Phillips 66',
  'sinclair': 'Sinclair',
  'sunoco': 'Sunoco',
  'texaco': 'Texaco',
  'valero': 'Valero',
  'getgo': 'GetGo',
  'get go': 'GetGo',
  'giant eagle': 'Giant Eagle',
  'kroger': 'Kroger',
  'meijer': 'Meijer',
  'walmart': 'Walmart',
  'sams club': "Sam's Club",
  "sam's club": "Sam's Club",
  'costco': 'Costco',
  'allegra': 'Allegra Network',
  'allegra printing': 'Allegra Network',
  'minuteman press': 'Minuteman Press',
  'fastsigns': 'FASTSIGNS',
  'signarama': 'Signarama',
  'signs now': 'Signs Now',
  'canteen': 'Canteen',
  'canteen services': 'Canteen',
};

// Patterns that indicate a location suffix
const LOCATION_PATTERNS = [
  /^(.+?)\s*#\s*(\d+)\s*$/i,                    // "Company #123"
  /^(.+?)\s*-\s*#\s*(\d+)\s*$/i,                // "Company - #123"
  /^(.+?)\s*store\s*#?\s*(\d+)\s*$/i,           // "Company Store 123" or "Company Store #123"
  /^(.+?)\s*location\s*#?\s*(\d+)\s*$/i,        // "Company Location 123"
  /^(.+?)\s*unit\s*#?\s*(\d+)\s*$/i,            // "Company Unit 123"
];

// Additional patterns for named locations (only match if base name is in KNOWN_FRANCHISES)
const NAMED_LOCATION_PATTERNS = [
  /^(.+?)\s*-\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*$/,  // "Company - Grand Rapids"
  /^(.+?)\s*\(([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\)\s*$/,  // "Company (Grand Rapids)"
];

// Exclude these patterns - they look like locations but aren't
const EXCLUDE_PATTERNS = [
  /^tri-/i,           // "Tri-State X" are different companies
  /^pro-/i,           // "Pro-X" are different companies  
  /^all-/i,           // "All-X" are different companies
  /^bi-/i,            // "Bi-X" are different companies
  /^multi-/i,         // "Multi-X" are different companies
];

function normalizeBaseName(name: string): string {
  return name.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

function extractBaseAndLocation(customerName: string): { baseName: string; locationId: string } | null {
  // First check exclusion patterns
  for (const pattern of EXCLUDE_PATTERNS) {
    if (pattern.test(customerName)) {
      return null;
    }
  }

  // Check numbered location patterns (always valid)
  for (const pattern of LOCATION_PATTERNS) {
    const match = customerName.match(pattern);
    if (match) {
      const baseName = match[1].trim();
      // Require base name to be at least 3 characters
      if (baseName.length >= 3) {
        return {
          baseName: baseName,
          locationId: match[2].trim(),
        };
      }
    }
  }

  // Check named location patterns (only for known franchises)
  for (const pattern of NAMED_LOCATION_PATTERNS) {
    const match = customerName.match(pattern);
    if (match) {
      const baseName = match[1].trim();
      const normalizedBase = normalizeBaseName(baseName);
      
      // Only accept named locations for known franchise companies
      if (KNOWN_FRANCHISES[normalizedBase]) {
        return {
          baseName: baseName,
          locationId: match[2].trim(),
        };
      }
    }
  }

  return null;
}

function getCorrectParentName(baseName: string): string {
  const normalized = normalizeBaseName(baseName);
  return KNOWN_FRANCHISES[normalized] || baseName;
}

async function main() {
  console.log('🏪 Organizing Franchise/Multi-Location Companies');
  console.log('='.repeat(60) + '\n');

  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }

  // Get all customers with order counts
  const customers = await prisma.customer.findMany({
    select: {
      id: true,
      name: true,
      _count: {
        select: { workOrders: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  console.log(`Total customers: ${customers.length}\n`);

  // Group by base company name
  const franchiseGroups = new Map<string, FranchiseGroup>();

  for (const customer of customers) {
    const extracted = extractBaseAndLocation(customer.name);
    if (!extracted) continue;

    const normalizedBase = normalizeBaseName(extracted.baseName);
    const parentName = getCorrectParentName(extracted.baseName);

    if (!franchiseGroups.has(normalizedBase)) {
      franchiseGroups.set(normalizedBase, {
        baseName: normalizedBase,
        parentName: parentName,
        locations: [],
        hasExistingParent: false,
      });
    }

    franchiseGroups.get(normalizedBase)!.locations.push({
      id: customer.id,
      name: customer.name,
      orderCount: customer._count.workOrders,
    });
  }

  // Filter to only groups with 2+ locations
  const multiLocationGroups: FranchiseGroup[] = [];
  for (const [baseName, group] of franchiseGroups) {
    if (group.locations.length >= 2) {
      // Check if a parent company already exists
      const existingParent = customers.find(c => {
        const norm = normalizeBaseName(c.name);
        return norm === baseName && !extractBaseAndLocation(c.name);
      });

      if (existingParent) {
        group.hasExistingParent = true;
        group.existingParentId = existingParent.id;
      }

      multiLocationGroups.push(group);
    }
  }

  console.log(`Found ${multiLocationGroups.length} multi-location companies:\n`);

  // Sort by location count (most locations first)
  multiLocationGroups.sort((a, b) => b.locations.length - a.locations.length);

  let totalLocationsLinked = 0;
  let parentsCreated = 0;
  let hierarchiesCreated = 0;

  for (const group of multiLocationGroups) {
    const totalOrders = group.locations.reduce((sum, loc) => sum + loc.orderCount, 0);
    
    console.log(`\n📍 ${group.parentName} (${group.locations.length} locations, ${totalOrders} total orders)`);
    
    if (group.hasExistingParent) {
      console.log(`   ✅ Parent exists: "${group.parentName}"`);
    } else {
      console.log(`   ➕ Need to create parent: "${group.parentName}"`);
    }

    // List locations
    for (const loc of group.locations.slice(0, 10)) {
      console.log(`      - "${loc.name}" (${loc.orderCount} orders)`);
    }
    if (group.locations.length > 10) {
      console.log(`      ... and ${group.locations.length - 10} more locations`);
    }

    if (!dryRun) {
      // Create or get parent customer
      let parentId: string;

      if (group.hasExistingParent && group.existingParentId) {
        parentId = group.existingParentId;
      } else {
        // Create new parent company
        const parent = await prisma.customer.create({
          data: {
            name: group.parentName,
            notes: `Parent company for ${group.locations.length} locations`,
          },
        });
        parentId = parent.id;
        parentsCreated++;
        console.log(`   ✅ Created parent company: "${group.parentName}"`);
      }

      // Create hierarchy relationships
      for (const loc of group.locations) {
        // Check if hierarchy already exists
        const existing = await prisma.customerHierarchy.findUnique({
          where: {
            parentCustomerId_childCustomerId: {
              parentCustomerId: parentId,
              childCustomerId: loc.id,
            },
          },
        });

        if (!existing) {
          await prisma.customerHierarchy.create({
            data: {
              parentCustomerId: parentId,
              childCustomerId: loc.id,
              relationType: CustomerRelationType.FRANCHISE,
              inheritPricing: true,
              inheritTerms: true,
            },
          });
          hierarchiesCreated++;
        }
      }

      totalLocationsLinked += group.locations.length;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Multi-location companies found: ${multiLocationGroups.length}`);
  console.log(`Total locations: ${multiLocationGroups.reduce((sum, g) => sum + g.locations.length, 0)}`);
  console.log(`Parent companies created: ${parentsCreated}`);
  console.log(`Hierarchy relationships created: ${hierarchiesCreated}`);

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
