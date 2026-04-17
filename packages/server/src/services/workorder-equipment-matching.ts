import { extractCutId, normalizeJobName } from './zund-match.js';
import { parseJobInfo, type ThriveCutJob, type ThriveJob } from './thrive.js';

export interface WorkOrderThriveMatchContext {
  bareNumber: string;
  matchingPrintJobs: ThriveJob[];
  matchingCutJobs: ThriveCutJob[];
  printJobGuids: Set<string>;
  normalizedPrintNames: Set<string>;
  printCutIdMap: Map<string, string>;
}

export function getBareWorkOrderNumber(orderNumber: string): string {
  return orderNumber.replace(/^WO/i, '');
}

export function matchesWorkOrderNumber(candidate: string | null | undefined, orderNumber: string): boolean {
  if (!candidate) return false;
  const bareNumber = getBareWorkOrderNumber(orderNumber);
  const normalizedCandidate = candidate.replace(/^WO/i, '');
  return (
    candidate === orderNumber ||
    candidate === bareNumber ||
    candidate === `WO${bareNumber}` ||
    normalizedCandidate === bareNumber
  );
}

export function extractWorkOrderNumber(text: string | null | undefined): string | null {
  if (!text) return null;
  return parseJobInfo(text).workOrderNumber;
}

export function matchesWorkOrderText(text: string | null | undefined, orderNumber: string): boolean {
  return matchesWorkOrderNumber(extractWorkOrderNumber(text), orderNumber);
}

function hasDistinctThriveCutIdentity(
  job: Pick<ThriveCutJob, 'guid' | 'jobName' | 'fileName'>,
  printCutIdMap: Map<string, string>,
): boolean {
  if (job.guid?.trim()) return true;

  const cutId = extractCutId(job.jobName) || extractCutId(job.fileName);
  if (!cutId) return false;

  return !printCutIdMap.has(cutId.toLowerCase());
}

export function buildWorkOrderThriveMatchContext(
  orderNumber: string,
  printJobs: ThriveJob[],
  cutJobs: ThriveCutJob[],
): WorkOrderThriveMatchContext {
  const bareNumber = getBareWorkOrderNumber(orderNumber);

  const matchingPrintJobs = printJobs.filter((job) => {
    if (matchesWorkOrderNumber(job.workOrderNumber, orderNumber)) return true;
    return (
      extractWorkOrderNumber(job.fileName) === bareNumber ||
      extractWorkOrderNumber(job.jobName) === bareNumber
    );
  });

  const printJobGuids = new Set<string>();
  const normalizedPrintNames = new Set<string>();
  const printCutIdMap = new Map<string, string>();

  for (const pj of matchingPrintJobs) {
    if (pj.jobGuid) printJobGuids.add(pj.jobGuid.toLowerCase());

    const normalizedName = normalizeJobName(pj.jobName);
    if (normalizedName.length >= 5) normalizedPrintNames.add(normalizedName);

    const normalizedFileName = normalizeJobName(pj.fileName);
    if (normalizedFileName.length >= 5) normalizedPrintNames.add(normalizedFileName);

    const cutId = extractCutId(pj.jobName) || extractCutId(pj.fileName);
    if (cutId) printCutIdMap.set(cutId.toLowerCase(), pj.jobName);
  }

  const matchingCutJobs = cutJobs.filter((job) => {
    const cutNormalizedName = normalizeJobName(job.jobName);
    const cutNormalizedFileName = normalizeJobName(job.fileName);
    const hasIdentity = hasDistinctThriveCutIdentity(job, printCutIdMap);
    const echoesPrintRow =
      !hasIdentity &&
      ((cutNormalizedName && normalizedPrintNames.has(cutNormalizedName)) ||
        (cutNormalizedFileName && normalizedPrintNames.has(cutNormalizedFileName)));

    if (echoesPrintRow) return false;

    if (matchesWorkOrderNumber(job.workOrderNumber, orderNumber)) return true;
    if (extractWorkOrderNumber(job.jobName) === bareNumber) return true;
    if (extractWorkOrderNumber(job.fileName) === bareNumber) return true;
    if (job.guid && printJobGuids.has(job.guid.toLowerCase())) return true;
    return false;
  });

  return {
    bareNumber,
    matchingPrintJobs,
    matchingCutJobs,
    printJobGuids,
    normalizedPrintNames,
    printCutIdMap,
  };
}
