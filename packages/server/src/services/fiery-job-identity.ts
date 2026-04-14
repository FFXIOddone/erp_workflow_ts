export interface FieryWorkOrderContext {
  workOrderNumber: string | null;
  customerName: string | null;
}

/**
 * Normalize a Fiery job/file name for matching.
 * Keeps the Fiery-specific suffix stripping in one place so both
 * the Fiery export parser and the RIP queue repair path use the same rules.
 */
export function normalizeFieryJobName(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/\.[^.]+$/g, '')
    .replace(/\.rtl(_\d+)?$/i, '')
    .replace(/_P\d+_T\d+_\d+_\d+$/i, '')
    .replace(/~\d+(_p\d+)?(_r\d+)?(_c\d+)?$/i, '')
    .replace(/[&()[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Normalize a work order number so Fiery and RIP paths can compare the same value.
 */
export function normalizeFieryWorkOrderNumber(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/^wo/i, '')
    .replace(/[^0-9]/g, '');
}

/**
 * Extract the work-order and customer metadata from a Thrive-style file path.
 * This keeps the path parsing logic shared across Fiery enrichment and repair flows.
 */
export function extractFieryWorkOrderContext(filePath: string): FieryWorkOrderContext {
  const woMatch = filePath.match(/WO(\d{4,5})/i);
  const workOrderNumber = woMatch ? `WO${woMatch[1]}` : null;

  const customerMatch = filePath.match(
    /(?:Company Files|[A-Z]:)\\(?:Safari\\)?([^\\]+)\\(?:\d{4}\\)?WO\d/i
  );
  const customerName = customerMatch ? customerMatch[1] : null;

  return { workOrderNumber, customerName };
}

/**
 * Build the first search terms used to crawl the file server for a source file.
 * Centralized here so the Fiery parser and repair paths use the same job-name cleanup.
 */
export function buildFierySearchTerms(jobName: string | null | undefined): string[] {
  return (jobName ?? '')
    .replace(/\.rtl.*$/i, '')
    .replace(/_P\d+_T\d+_\d+_\d+$/i, '')
    .replace(/[-_]/g, ' ')
    .split(' ')
    .filter((term) => term.length > 4)
    .slice(0, 2);
}
