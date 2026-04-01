import { describe, expect, it } from 'vitest';
import { matchThriveQueueJobToLogEntry, type ThriveJob, type ThriveJobLogEntry } from './thrive.js';

function makeQueueJob(overrides: Partial<ThriveJob> = {}): ThriveJob {
  return {
    jobGuid: 'queue-job-guid',
    jobName: '18x12_Driscolls_Garage_Sign_PRINTANDCUT',
    fileName: 'S:\\JIM DRISCOLL\\WO64379 GARAGE SIGN\\PRINT\\18x12 Driscolls Garage Sign_PRINTANDCUT.pdf',
    status: 'Ready to Print',
    statusCode: 8,
    createTime: '13:41:12',
    createDate: '2026-03-19',
    processStartTime: '13:41:17',
    printer: 'HP Latex 570-2',
    printMedia: 'GF 201 [Self-Adhesive Vinyl]',
    numCopies: 1,
    inkTotal: undefined,
    inkCoverage: undefined,
    customerName: 'JIM DRISCOLL',
    jobSize: '18.250 x 12.250',
    companyBrand: 'WILDE_SIGNS',
    jobDescription: 'GARAGE SIGN',
    workOrderNumber: '64379',
    ...overrides,
  };
}

function makeLogEntry(overrides: Partial<ThriveJobLogEntry> = {}): ThriveJobLogEntry {
  return {
    fileName: '18x12_Driscolls_Garage_Sign_PRINTANDCUT.PDF',
    customizedName: '',
    status: 'OK',
    printedTime: '03/23/2026 09:48',
    sizeWidth: 18.25,
    sizeHeight: 12.25,
    copies: 1,
    totalArea: 1.55,
    printer: 'HP Latex 570-2',
    media: 'GF 201 [Self-Adhesive Vinyl]',
    printMode: '300 dpi, 6p_CMYKcm_100',
    resolution: '300',
    ripTime: '00:00:05',
    printTime: '00:00:13',
    inkUsed: '',
    totalInk: '',
    cutId: '0UI2F62263N',
    machineId: 'thrive-rip2',
    sourceFilePath: undefined,
    ...overrides,
  };
}

describe('matchThriveQueueJobToLogEntry', () => {
  it('prefers the queue entry on the same printer so the WO-bearing source path is recovered', () => {
    const logEntry = makeLogEntry();
    const printJobs = [
      makeQueueJob({
        jobGuid: 'other-printer',
        fileName: 'S:\\OTHER CUSTOMER\\WO99999\\PRINT\\18x12 Driscolls Garage Sign_PRINTANDCUT.pdf',
        printer: 'HP Latex 570',
      }),
      makeQueueJob(),
    ];

    const match = matchThriveQueueJobToLogEntry(logEntry, printJobs);

    expect(match?.fileName).toBe(
      'S:\\JIM DRISCOLL\\WO64379 GARAGE SIGN\\PRINT\\18x12 Driscolls Garage Sign_PRINTANDCUT.pdf'
    );
  });

  it('returns null when there is no strong queue match for the JobLog entry', () => {
    const logEntry = makeLogEntry({ fileName: 'No_Match_PRINTANDCUT.PDF', printer: 'HP Latex 800 W' });
    const printJobs = [makeQueueJob()];

    const match = matchThriveQueueJobToLogEntry(logEntry, printJobs);

    expect(match).toBeNull();
  });
});
