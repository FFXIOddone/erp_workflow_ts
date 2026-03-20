import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

async function analyzeZundStats() {
  // Test with either Zund — pass 'zund1' or 'zund2' as arg
  const zundId = process.argv[2] || 'zund2';
  const sources: Record<string, string> = {
    'zund1': '\\\\192.168.254.38\\ProgramData\\Zund\\02 Statistic database\\Statistic.db3',
    'zund2': '\\\\192.168.254.28\\Statistics\\Statistic.db3',
  };
  const source = sources[zundId] || sources['zund2'];
  const dest = path.join(os.tmpdir(), 'Statistic.db3');
  
  console.log('Copying Zund statistics database...');
  fs.copyFileSync(source, dest);
  
  const db = new Database(dest, { readonly: true });
  
  // Search for jobs that might have WO numbers in the name
  console.log('\n=== Looking for WO numbers in job names ===');
  const jobs = db.prepare(`
    SELECT JobID, JobName, ProductionStart, ProductionEnd, CopyDone, CopyTotal, Cutter
    FROM ProductionTimeJob 
    ORDER BY ProductionStart DESC 
    LIMIT 50
  `).all();
  
  for (const job of jobs as any[]) {
    const date = new Date(job.ProductionStart * 1000).toISOString().split('T')[0];
    console.log(`${date} | ${job.JobName.slice(0, 60)}`);
  }
  
  // Look for patterns like WO##### or just 5-digit numbers
  console.log('\n=== Jobs with WO patterns ===');
  const woJobs = db.prepare(`
    SELECT JobID, JobName, ProductionStart, CopyTotal
    FROM ProductionTimeJob 
    WHERE JobName LIKE '%WO%' OR JobName LIKE '%wo%'
    ORDER BY ProductionStart DESC 
    LIMIT 20
  `).all();
  console.log('Found', woJobs.length, 'jobs with WO in name');
  for (const job of woJobs as any[]) {
    console.log('-', (job as any).JobName.slice(0, 80));
  }
  
  // Look for 5-digit number patterns
  console.log('\n=== Recent jobs with 5-digit patterns ===');
  const recentJobs = db.prepare(`
    SELECT JobName FROM ProductionTimeJob 
    ORDER BY ProductionStart DESC 
    LIMIT 200
  `).all();
  
  const woPattern = /(\d{5})/;
  const matches = [];
  for (const job of recentJobs as any[]) {
    const match = job.JobName.match(woPattern);
    if (match) {
      matches.push({ name: job.JobName, wo: match[1] });
    }
  }
  console.log('Jobs with 5-digit numbers:', matches.length);
  for (const m of matches.slice(0, 10)) {
    console.log('-', m.wo, ':', m.name.slice(0, 50));
  }
  
  db.close();
}

analyzeZundStats().catch(console.error);
