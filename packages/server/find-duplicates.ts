import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Normalize a name for grouping ────────────────────────────
// This strips store numbers, PO numbers, suffixes, and brackets
// to find the "base company name"
function normalizeName(name: string): string {
  return name
    .replace(/\(.*?\)/g, '')        // Remove (PO#123), (Store 45), etc.
    .replace(/\[.*?\]/g, '')        // Remove [anything]
    .replace(/#\s*\d+/g, '')        // Remove #123 store numbers
    .replace(/\bPO\s*#?\s*\d+/gi, '') // Remove PO numbers
    .replace(/\bstore\s*#?\s*\d+/gi, '') // Remove "Store 123"
    .replace(/\bloc\w*\s*#?\s*\d+/gi, '') // Remove "Location 123"
    .replace(/\b(inc|llc|ltd|corp|co|company|enterprises|group)\b\.?/gi, '')
    .replace(/[^a-zA-Z0-9\s&'-]/g, '') // Keep letters, numbers, &, ', -
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// ─── Levenshtein distance ──────────────────────────────────────
function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) matrix[i] = [i];
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

function similarity(a: string, b: string): number {
  if (a === b) return 100;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 100;
  return Math.round((1 - levenshtein(a, b) / maxLen) * 100);
}

interface NameEntry {
  name: string;
  source: 'company' | 'wo_customer';
  normalized: string;
  orderCount?: number;
  id?: string;
}

interface DupeGroup {
  normalized: string;
  entries: NameEntry[];
  isFranchise: boolean; // true if these are intentional separate locations
}

// Detect if a name looks like a franchise location (has a store/location number)
function isFranchiseLocation(name: string): boolean {
  return /\s#\s*\d+/.test(name) || /\bstore\s*#?\s*\d+/i.test(name) || /\bloc\w*\s*#?\s*\d+/i.test(name);
}

async function main() {
  // Get all companies
  const companies = await prisma.company.findMany({
    select: { id: true, name: true, isActive: true },
    orderBy: { name: 'asc' },
  });

  // Get all distinct WO customerNames with counts
  const woNames = await prisma.workOrder.groupBy({
    by: ['customerName'],
    _count: { id: true },
    orderBy: { customerName: 'asc' },
  });

  console.log(`\n📊 Database Summary:`);
  console.log(`   Companies on file: ${companies.length}`);
  console.log(`   Distinct WO customer names: ${woNames.length}`);

  // Build unified list of all names
  const allEntries: NameEntry[] = [];
  const companyNames = new Set(companies.map(c => c.name));

  for (const c of companies) {
    allEntries.push({
      id: c.id,
      name: c.name,
      source: 'company',
      normalized: normalizeName(c.name),
    });
  }

  for (const w of woNames) {
    if (!companyNames.has(w.customerName)) {
      allEntries.push({
        name: w.customerName,
        source: 'wo_customer',
        normalized: normalizeName(w.customerName),
        orderCount: w._count.id,
      });
    }
  }

  // ─── PHASE 1: Group by normalized name ────────────────────
  const groups = new Map<string, NameEntry[]>();
  for (const entry of allEntries) {
    if (!entry.normalized || entry.normalized.length < 2) continue;
    const key = entry.normalized;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }

  // ─── PHASE 2: Find fuzzy matches between group keys ──────
  const groupKeys = [...groups.keys()];
  const mergedGroups = new Map<string, Set<string>>(); // canonical -> all keys that match

  for (let i = 0; i < groupKeys.length; i++) {
    const keyA = groupKeys[i];
    if (keyA.length < 3) continue;
    
    for (let j = i + 1; j < groupKeys.length; j++) {
      const keyB = groupKeys[j];
      if (keyB.length < 3) continue;
      
      // Skip if length difference is too large (can't be 80% similar)
      const lenDiff = Math.abs(keyA.length - keyB.length);
      const maxLen = Math.max(keyA.length, keyB.length);
      if (lenDiff / maxLen > 0.2) continue;
      
      const sim = similarity(keyA, keyB);
      if (sim >= 80) {
        // Merge into same group - use the longer/more complete key as canonical
        const canonical = keyA.length >= keyB.length ? keyA : keyB;
        const other = canonical === keyA ? keyB : keyA;
        
        if (!mergedGroups.has(canonical)) mergedGroups.set(canonical, new Set([canonical]));
        if (!mergedGroups.has(other)) {
          mergedGroups.get(canonical)!.add(other);
        } else {
          // Merge two existing groups
          const existingCanonical = [...mergedGroups.entries()].find(([_, v]) => v.has(other));
          if (existingCanonical && existingCanonical[0] !== canonical) {
            for (const k of existingCanonical[1]) {
              mergedGroups.get(canonical)!.add(k);
            }
            mergedGroups.delete(existingCanonical[0]);
          } else {
            mergedGroups.get(canonical)!.add(other);
          }
        }
      }
    }
  }

  // ─── Build final duplicate groups ─────────────────────────
  const dupeGroups: DupeGroup[] = [];

  // First: exact normalized matches (multiple names -> same normalized form)
  for (const [normalized, entries] of groups) {
    if (entries.length > 1) {
      // Check if ALL entries look like franchise locations
      const allFranchise = entries.every(e => isFranchiseLocation(e.name));
      
      if (!allFranchise) {
        // These are real duplicates (not just store #123 vs store #456)
        dupeGroups.push({ normalized, entries, isFranchise: false });
      }
    }
  }

  // Second: fuzzy normalized matches
  for (const [canonical, relatedKeys] of mergedGroups) {
    if (relatedKeys.size <= 1) continue;
    
    const allEntries: NameEntry[] = [];
    let allFranchise = true;
    
    for (const key of relatedKeys) {
      const entries = groups.get(key) || [];
      allEntries.push(...entries);
      if (entries.some(e => !isFranchiseLocation(e.name))) {
        allFranchise = false;
      }
    }
    
    if (allEntries.length > 1 && !allFranchise) {
      // Check if this group is already covered by an exact match group
      const alreadyCovered = dupeGroups.some(dg => 
        dg.entries.some(e => allEntries.some(ae => ae.name === e.name))
      );
      if (!alreadyCovered) {
        dupeGroups.push({ normalized: canonical, entries: allEntries, isFranchise: false });
      }
    }
  }

  // ─── Also find WO names that don't match ANY company ──────
  const unmatchedWO: { name: string; count: number; bestMatch?: string; bestScore?: number }[] = [];

  for (const w of woNames) {
    if (companyNames.has(w.customerName)) continue;
    
    const woNorm = normalizeName(w.customerName);
    let bestMatch = '';
    let bestScore = 0;
    
    for (const c of companies) {
      const compNorm = normalizeName(c.name);
      
      // Check exact normalized match first
      if (woNorm === compNorm) {
        bestScore = 100;
        bestMatch = c.name;
        break;
      }
      
      // Skip if length difference is too large
      const lenDiff = Math.abs(woNorm.length - compNorm.length);
      const maxLen = Math.max(woNorm.length, compNorm.length);
      if (maxLen > 0 && lenDiff / maxLen > 0.3) continue;
      
      const sim = similarity(woNorm, compNorm);
      if (sim > bestScore) {
        bestScore = sim;
        bestMatch = c.name;
      }
    }
    
    if (bestScore < 80) {
      unmatchedWO.push({
        name: w.customerName,
        count: w._count.id,
        bestMatch: bestScore > 50 ? bestMatch : undefined,
        bestScore: bestScore > 50 ? bestScore : undefined,
      });
    }
  }

  // ─── Classify groups ───────────────────────────────────────
  // "Case-only" = Company exists, WO name is just upper/lower case variant
  // "Real dupes" = two companies, or names that differ beyond just case
  const caseOnlyMatches: DupeGroup[] = [];
  const realDupes: DupeGroup[] = [];

  for (const group of dupeGroups) {
    const companyEntries = group.entries.filter(e => e.source === 'company');
    const woEntries = group.entries.filter(e => e.source === 'wo_customer');

    // Case-only: exactly 1 company + WO names that differ only by case
    if (companyEntries.length === 1 && woEntries.length >= 1) {
      const compName = companyEntries[0].name;
      const allCaseOnly = woEntries.every(
        w => w.name.toLowerCase() === compName.toLowerCase()
      );
      if (allCaseOnly) {
        caseOnlyMatches.push(group);
        continue;
      }
    }
    realDupes.push(group);
  }

  // Sort real dupes: company-vs-company first, then by entry count
  realDupes.sort((a, b) => {
    const aHasMultiCompany = a.entries.filter(e => e.source === 'company').length > 1 ? 1 : 0;
    const bHasMultiCompany = b.entries.filter(e => e.source === 'company').length > 1 ? 1 : 0;
    if (bHasMultiCompany !== aHasMultiCompany) return bHasMultiCompany - aHasMultiCompany;
    return b.entries.length - a.entries.length;
  });

  // Franchise summary
  const franchiseCompanies = new Map<string, number>();
  for (const [normalized, entries] of groups) {
    if (entries.length > 1 && entries.every(e => isFranchiseLocation(e.name) && e.source === 'company')) {
      franchiseCompanies.set(normalized, entries.length);
    }
  }

  // ─── Write output to file ────────────────────────────────
  const lines: string[] = [];
  const w = (s: string) => lines.push(s);

  w(`DUPLICATE CUSTOMER REPORT`);
  w(`Generated: ${new Date().toLocaleString()}`);
  w(`Companies on file: ${companies.length}`);
  w(`Distinct WO customer names: ${woNames.length}`);
  w(``);

  // ─── SECTION 1: REAL DUPLICATES ──────────────────────────
  w(`═══════════════════════════════════════════════════════════`);
  w(`  SECTION 1: REAL DUPLICATES (${realDupes.length} groups)`);
  w(`  These need your review. Mark: O = merge, X = don't merge`);
  w(`═══════════════════════════════════════════════════════════`);
  w(``);

  for (let i = 0; i < realDupes.length; i++) {
    const group = realDupes[i];
    const companyEntries = group.entries.filter(e => e.source === 'company');
    const woEntries = group.entries.filter(e => e.source === 'wo_customer');

    w(`── Group ${i + 1} ──`);
    for (const e of companyEntries) {
      w(`   [ ] COMPANY: "${e.name}"`);
    }
    for (const e of woEntries) {
      w(`   [ ] WO NAME: "${e.name}" (${e.orderCount} orders)`);
    }
    w(``);
  }

  // ─── SECTION 2: CASE-ONLY MATCHES (auto-linkable) ────────
  w(`═══════════════════════════════════════════════════════════`);
  w(`  SECTION 2: CASE-ONLY MATCHES (${caseOnlyMatches.length} — will auto-link)`);
  w(`  WO names that are just ALL CAPS versions of existing companies.`);
  w(`  These will be auto-linked to the company (no action needed).`);
  w(`═══════════════════════════════════════════════════════════`);
  w(``);

  for (const group of caseOnlyMatches) {
    const company = group.entries.find(e => e.source === 'company')!;
    const wos = group.entries.filter(e => e.source === 'wo_customer');
    const totalOrders = wos.reduce((sum, wo) => sum + (wo.orderCount || 0), 0);
    w(`  "${company.name}" ← ${totalOrders} orders`);
  }
  w(``);

  // ─── SECTION 3: UNMATCHED WO NAMES ──────────────────────
  w(`═══════════════════════════════════════════════════════════`);
  w(`  SECTION 3: WO NAMES WITH NO COMPANY MATCH (${unmatchedWO.length})`);
  w(`  These WO customer names don't match any company on file.`);
  w(`═══════════════════════════════════════════════════════════`);
  w(``);

  for (const u of unmatchedWO) {
    let line = `  • "${u.name}" (${u.count} orders)`;
    if (u.bestMatch) {
      line += ` — closest: "${u.bestMatch}" (${u.bestScore}%)`;
    }
    w(line);
  }
  w(``);

  // ─── SECTION 4: FRANCHISE SUMMARY ───────────────────────
  if (franchiseCompanies.size > 0) {
    w(`═══════════════════════════════════════════════════════════`);
    w(`  SECTION 4: FRANCHISE LOCATIONS (${franchiseCompanies.size} brands — kept separate)`);
    w(`═══════════════════════════════════════════════════════════`);
    w(``);
    for (const [norm, count] of [...franchiseCompanies.entries()].sort((a, b) => b[1] - a[1])) {
      w(`  • ${norm}: ${count} locations`);
    }
    w(``);
  }

  // ─── Write to file ───────────────────────────────────────
  const fs = await import('fs');
  const outputPath = './duplicate-report.txt';
  fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');

  console.log(`\n✅ Report written to: ${outputPath}`);
  console.log(`   Section 1: ${realDupes.length} real duplicate groups (NEED REVIEW)`);
  console.log(`   Section 2: ${caseOnlyMatches.length} case-only matches (auto-linkable)`);
  console.log(`   Section 3: ${unmatchedWO.length} unmatched WO names`);
  console.log(`   Section 4: ${franchiseCompanies.size} franchise brands\n`);

  await prisma.$disconnect();
}

main().catch(console.error);
