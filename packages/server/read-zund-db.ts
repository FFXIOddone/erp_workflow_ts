/**
 * Read Zund Statistics Database
 */
import Database from 'better-sqlite3';

const db = new Database('./zund-stats.db3', { readonly: true });

// Get tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
console.log('Tables:', tables.map(t => t.name));

// Get recent jobs
console.log('\n--- Recent 15 Cut Jobs ---');
const recentJobs = db.prepare(`
  SELECT 
    JobID, 
    JobName, 
    datetime(ProductionStart, 'unixepoch', 'localtime') as StartTime,
    datetime(ProductionEnd, 'unixepoch', 'localtime') as EndTime,
    CopyDone,
    CopyTotal,
    Material,
    MaterialThickness
  FROM ProductionTimeJob 
  ORDER BY ProductionStart DESC 
  LIMIT 15
`).all();

for (const job of recentJobs as any[]) {
  console.log(`\n  ${job.JobName}`);
  console.log(`    Time: ${job.StartTime} → ${job.EndTime}`);
  console.log(`    Copies: ${job.CopyDone}/${job.CopyTotal}`);
}

// Job names that might have WO numbers
console.log('\n--- Jobs with potential WO numbers (last 100) ---');
const woJobs = db.prepare(`
  SELECT JobName, datetime(ProductionStart, 'unixepoch', 'localtime') as StartTime
  FROM ProductionTimeJob 
  WHERE JobName LIKE '%WO%' OR JobName LIKE '%64%' OR JobName LIKE '%63%'
  ORDER BY ProductionStart DESC 
  LIMIT 20
`).all();

for (const job of woJobs as any[]) {
  console.log(`  ${job.StartTime}: ${job.JobName}`);
}

// Total row counts
const jobCount = db.prepare('SELECT COUNT(*) as cnt FROM ProductionTimeJob').get() as { cnt: number };
const timeCount = db.prepare('SELECT COUNT(*) as cnt FROM ProductionTimes').get() as { cnt: number };
console.log(`\n--- Summary ---`);
console.log(`Total cut jobs: ${jobCount.cnt}`);
console.log(`Total time records: ${timeCount.cnt}`);

db.close();
