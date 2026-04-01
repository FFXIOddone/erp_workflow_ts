import { existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');

function normalizePath(input) {
  return resolve(input).replace(/\\/g, '/').toLowerCase();
}

function git(args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function removeDirectory(targetPath, label) {
  if (!existsSync(targetPath)) {
    return false;
  }

  if (dryRun) {
    console.log(`[dry-run] remove ${label}: ${targetPath}`);
    return true;
  }

  rmSync(targetPath, { recursive: true, force: true });
  console.log(`removed ${label}: ${targetPath}`);
  return true;
}

function removeFile(targetPath, label) {
  if (!existsSync(targetPath)) {
    return false;
  }

  if (dryRun) {
    console.log(`[dry-run] remove ${label}: ${targetPath}`);
    return true;
  }

  rmSync(targetPath, { force: true });
  console.log(`removed ${label}: ${targetPath}`);
  return true;
}

const activeWorktrees = new Set();
const worktreeList = git(['worktree', 'list', '--porcelain']);

for (const line of worktreeList.split(/\r?\n/)) {
  if (!line.startsWith('worktree ')) {
    continue;
  }

  activeWorktrees.add(normalizePath(line.slice('worktree '.length)));
}

const deletions = [];

function queueDirectory(targetPath, label) {
  deletions.push(() => removeDirectory(targetPath, label));
}

function queueFile(targetPath, label) {
  deletions.push(() => removeFile(targetPath, label));
}

queueDirectory(join(repoRoot, 'node_modules'), 'root node_modules');
queueDirectory(join(repoRoot, 'target'), 'target build output');
queueDirectory(join(repoRoot, '.git-old'), 'git backup');
queueDirectory(join(repoRoot, 'logs'), 'workspace logs');
queueDirectory(join(repoRoot, 'tmp'), 'workspace temp files');
queueFile(join(repoRoot, 'packages', 'server', 'prisma', 'dev.db'), 'Prisma dev database');

const packagesDir = join(repoRoot, 'packages');
if (existsSync(packagesDir)) {
  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    queueDirectory(join(packagesDir, entry.name, 'node_modules'), `package node_modules (${entry.name})`);
  }
}

const claudeWorktreesDir = join(repoRoot, '.claude', 'worktrees');
if (existsSync(claudeWorktreesDir)) {
  for (const entry of readdirSync(claudeWorktreesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const targetPath = join(claudeWorktreesDir, entry.name);
    if (activeWorktrees.has(normalizePath(targetPath))) {
      console.log(`keeping active worktree: ${targetPath}`);
      continue;
    }

    queueDirectory(targetPath, `orphan worktree ${entry.name}`);
  }
}

let removedCount = 0;

for (const deletion of deletions) {
  if (deletion()) {
    removedCount += 1;
  }
}

console.log(`${dryRun ? 'Dry-run complete' : 'Cleanup complete'}: ${removedCount} directory targets ${dryRun ? 'would be' : 'were'} processed.`);
