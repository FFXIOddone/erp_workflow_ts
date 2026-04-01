import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type EventKind = 'run' | 'blocker' | 'milestone';

type Args = Record<string, string | boolean | undefined>;

const repoRoot = process.cwd();
const autonomyDir = join(repoRoot, 'docs', 'autonomy');
const runLogPath = join(autonomyDir, 'RUN_LOG.md');
const blockersPath = join(autonomyDir, 'BLOCKERS.md');
const milestonesPath = join(autonomyDir, 'MILESTONES.md');

function parseArgs(argv: string[]): Args {
  const args: Args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

function required(args: Args, key: string): string {
  const value = args[key];
  if (!value || typeof value !== 'string') {
    throw new Error(`Missing required argument --${key}`);
  }
  return value;
}

function text(value: string | undefined): string {
  return (value ?? '').replace(/\r?\n/g, ' <br> ').replace(/\|/g, '\\|').trim();
}

function insertAfterMarker(filePath: string, marker: string, row: string): void {
  const content = readFileSync(filePath, 'utf8');
  if (!content.includes(marker)) {
    throw new Error(`Marker ${marker} not found in ${filePath}`);
  }

  const updated = content.replace(marker, `${row}\n${marker}`);
  writeFileSync(filePath, updated);
}

function recordRun(args: Args): void {
  const row = `| ${text(required(args, 'timestamp'))} | ${text(required(args, 'task-id'))} | ${text(required(args, 'source'))} | ${text(required(args, 'summary'))} | ${text(args.validation as string | undefined)} | ${text(args.commit as string | undefined)} | ${text(args.outcome as string | undefined)} | ${text(args.notes as string | undefined)} |`;
  insertAfterMarker(runLogPath, '<!-- RUN_LOG_ROWS -->', row);
  console.log(`Recorded run event in ${runLogPath}`);
}

function recordBlocker(args: Args): void {
  const resolved = args.resolved === true || args.resolved === 'true';

  if (resolved) {
    const row = `| ${text(required(args, 'timestamp'))} | ${text(required(args, 'task-id'))} | ${text(required(args, 'source'))} | ${text(required(args, 'blocker'))} | ${text(required(args, 'resolution'))} | ${text(args.notes as string | undefined)} |`;
    insertAfterMarker(blockersPath, '<!-- BLOCKER_RESOLVED_ROWS -->', row);
    console.log(`Recorded resolved blocker in ${blockersPath}`);
    return;
  }

  const row = `| ${text(required(args, 'timestamp'))} | ${text(required(args, 'task-id'))} | ${text(required(args, 'source'))} | ${text(required(args, 'blocker'))} | ${text(required(args, 'needs'))} | ${text(args.status as string | undefined)} | ${text(args.notes as string | undefined)} |`;
  insertAfterMarker(blockersPath, '<!-- BLOCKER_OPEN_ROWS -->', row);
  console.log(`Recorded open blocker in ${blockersPath}`);
}

function recordMilestone(args: Args): void {
  const row = `| ${text(required(args, 'timestamp'))} | ${text(required(args, 'task-id'))} | ${text(required(args, 'summary'))} | ${text(args.evidence as string | undefined)} |`;
  insertAfterMarker(milestonesPath, '<!-- MILESTONE_ROWS -->', row);
  console.log(`Recorded milestone in ${milestonesPath}`);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const kind = required(args, 'kind') as EventKind;

  if (!args.timestamp) {
    args.timestamp = new Date().toISOString();
  }

  switch (kind) {
    case 'run':
      recordRun(args);
      return;
    case 'blocker':
      recordBlocker(args);
      return;
    case 'milestone':
      recordMilestone(args);
      return;
    default:
      throw new Error(`Unsupported kind: ${kind}`);
  }
}

main();
