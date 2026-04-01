import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

type SourceType = 'plan' | 'audit' | 'gap-analysis';

type SelectedTask = {
  taskId: string;
  summary: string;
  sourceType: SourceType;
  sourcePath: string;
  section?: string;
  status: string;
  line: number;
  lineText: string;
};

type SelectionResult = {
  selected: SelectedTask | null;
  dirtyWorktree: {
    status: 'verify-separately';
    files: string[];
    note: string;
  };
  searchedSources: string[];
};

const repoRoot = process.cwd();
const plansDir = join(repoRoot, 'docs', 'superpowers', 'plans');
const auditFiles = [
  join(repoRoot, 'docs', 'COMPREHENSIVE_AUDIT.md'),
  join(repoRoot, 'docs', 'TEST_FINDINGS.md'),
  join(repoRoot, 'docs', 'SECURITY_NEXT_STEPS.md'),
  join(repoRoot, 'docs', 'SECURITY_AUDIT_REPORT.md'),
];
const gapAnalysisPath = join(repoRoot, 'docs', 'ERP_GAP_ANALYSIS.md');

function rel(filePath: string): string {
  return relative(repoRoot, filePath).replace(/\\/g, '/');
}

function readLines(filePath: string): string[] {
  return readFileSync(filePath, 'utf8').split(/\r?\n/);
}

function listMarkdownFiles(dirPath: string): string[] {
  if (!existsSync(dirPath)) {
    return [];
  }

  const files: string[] = [];

  for (const entry of readdirSync(dirPath)) {
    const fullPath = join(dirPath, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...listMarkdownFiles(fullPath));
      continue;
    }

    if (stats.isFile() && fullPath.toLowerCase().endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files.sort((left, right) => basename(right).localeCompare(basename(left)));
}

function cleanHeading(text: string): string {
  return text
    .replace(/^#+\s*/, '')
    .replace(/\b(?:NOT STARTED|AVAILABLE|IN PROGRESS|COMPLETE|BLOCKED)\b/gi, '')
    .replace(/[^\w\s:/.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeStatusCell(text: string): string {
  return text.replace(/[^\x20-\x7E]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function currentSection(lines: string[], index: number): string | undefined {
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    if (/^#{1,6}\s+/.test(lines[cursor])) {
      return cleanHeading(lines[cursor]);
    }
  }

  return undefined;
}

function parsePlanTask(filePath: string): SelectedTask | null {
  const lines = readLines(filePath);

  for (let index = 0; index < lines.length; index += 1) {
    const match = /^- \[ \] (.+)$/.exec(lines[index]);
    if (!match) {
      continue;
    }

    return {
      taskId: `PLAN:${basename(filePath, '.md')}`,
      summary: match[1].trim(),
      sourceType: 'plan',
      sourcePath: rel(filePath),
      section: currentSection(lines, index),
      status: 'UNCHECKED',
      line: index + 1,
      lineText: lines[index].trim(),
    };
  }

  return null;
}

function parseAuditTask(filePath: string): SelectedTask | null {
  const lines = readLines(filePath);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const headingStatus = /NOT STARTED|AVAILABLE/i.test(line) && /^#{1,6}\s+/.test(line);

    if (headingStatus) {
      const summary = cleanHeading(line);
      const taskMatch = summary.match(/^([A-Za-z0-9.-]+)/);
      return {
        taskId: taskMatch?.[1] ? `${basename(filePath, '.md')}:${taskMatch[1]}` : `AUDIT:${basename(filePath, '.md')}:${index + 1}`,
        summary,
        sourceType: 'audit',
        sourcePath: rel(filePath),
        section: currentSection(lines, index),
        status: /AVAILABLE/i.test(line) ? 'AVAILABLE' : 'NOT STARTED',
        line: index + 1,
        lineText: line.trim(),
      };
    }

    const tableMatch = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/.exec(line);
    if (!tableMatch || tableMatch[1].trim() === '---') {
      continue;
    }

    const status = normalizeStatusCell(tableMatch[3]);
    if (!/AVAILABLE|NOT STARTED/i.test(status)) {
      continue;
    }

    return {
      taskId: tableMatch[1].trim(),
      summary: tableMatch[2].trim(),
      sourceType: 'audit',
      sourcePath: rel(filePath),
      section: currentSection(lines, index),
      status,
      line: index + 1,
      lineText: line.trim(),
    };
  }

  return null;
}

function parseGapTask(filePath: string): SelectedTask | null {
  const lines = readLines(filePath);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const tableMatch = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/.exec(line);

    if (!tableMatch || tableMatch[1].trim() === '---') {
      continue;
    }

    const status = normalizeStatusCell(tableMatch[3]);
    if (!/AVAILABLE|NOT STARTED/i.test(status)) {
      continue;
    }

    return {
      taskId: tableMatch[1].trim(),
      summary: tableMatch[2].trim(),
      sourceType: 'gap-analysis',
      sourcePath: rel(filePath),
      section: currentSection(lines, index),
      status,
      line: index + 1,
      lineText: line.trim(),
    };
  }

  return null;
}

function getDirtyWorktree(): SelectionResult['dirtyWorktree'] {
  return {
    status: 'verify-separately',
    files: [],
    note: 'Run `git status --short` in the shell before claiming work. Child-process access is not guaranteed in every runtime.',
  };
}

function selectNextTask(): SelectionResult {
  const searchedSources: string[] = [];

  for (const filePath of listMarkdownFiles(plansDir)) {
    searchedSources.push(rel(filePath));
    const task = parsePlanTask(filePath);
    if (task) {
      return { selected: task, dirtyWorktree: getDirtyWorktree(), searchedSources };
    }
  }

  for (const filePath of auditFiles) {
    if (!existsSync(filePath)) {
      continue;
    }

    searchedSources.push(rel(filePath));
    const task = parseAuditTask(filePath);
    if (task) {
      return { selected: task, dirtyWorktree: getDirtyWorktree(), searchedSources };
    }
  }

  if (existsSync(gapAnalysisPath)) {
    searchedSources.push(rel(gapAnalysisPath));
    const task = parseGapTask(gapAnalysisPath);
    if (task) {
      return { selected: task, dirtyWorktree: getDirtyWorktree(), searchedSources };
    }
  }

  return {
    selected: null,
    dirtyWorktree: getDirtyWorktree(),
    searchedSources,
  };
}

function printText(result: SelectionResult): void {
  if (!result.selected) {
    console.log('No available task found.');
    console.log(`Dirty worktree: ${result.dirtyWorktree.status}`);
    console.log(result.dirtyWorktree.note);
    return;
  }

  const { selected } = result;

  console.log(`Task ID: ${selected.taskId}`);
  console.log(`Summary: ${selected.summary}`);
  console.log(`Source: ${selected.sourceType} (${selected.sourcePath}:${selected.line})`);
  console.log(`Status: ${selected.status}`);
  if (selected.section) {
    console.log(`Section: ${selected.section}`);
  }
  console.log(`Dirty worktree: ${result.dirtyWorktree.status}`);
  console.log(result.dirtyWorktree.note);
}

const result = selectNextTask();

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(result, null, 2));
} else {
  printText(result);
}
