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

function matchesWorkOrderNumber(candidate: string | null | undefined, orderNumber: string, bareNumber: string): boolean {
  if (!candidate) return false;
  const normalizedCandidate = candidate.replace(/^WO/i, '');
  return (
    candidate === orderNumber ||
    candidate === bareNumber ||
    candidate === `WO${bareNumber}` ||
    normalizedCandidate === bareNumber
  );
}

function parsedWorkOrderNumber(text: string | null | undefined): string | null {
  if (!text) return null;
  return parseJobInfo(text).workOrderNumber;
}

export function buildWorkOrderThriveMatchContext(
  orderNumber: string,
  printJobs: ThriveJob[],
  cutJobs: ThriveCutJob[],
): WorkOrderThriveMatchContext {
  const bareNumber = orderNumber.replace(/^WO/i, '');

  const matchingPrintJobs = printJobs.filter((job) => {
    if (matchesWorkOrderNumber(job.workOrderNumber, orderNumber, bareNumber)) return true;
    return (
      parsedWorkOrderNumber(job.fileName) === bareNumber ||
      parsedWorkOrderNumber(job.jobName) === bareNumber
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
    if (matchesWorkOrderNumber(job.workOrderNumber, orderNumber, bareNumber)) return true;
    if (parsedWorkOrderNumber(job.jobName) === bareNumber) return true;
    if (parsedWorkOrderNumber(job.fileName) === bareNumber) return true;
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
