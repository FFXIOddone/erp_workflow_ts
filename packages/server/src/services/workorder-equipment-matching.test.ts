import { describe, expect, it } from 'vitest';
import {
  buildWorkOrderThriveMatchContext,
  extractWorkOrderNumber,
  matchesWorkOrderNumber,
  matchesWorkOrderText,
} from './workorder-equipment-matching.js';
import type { ThriveCutJob, ThriveJob } from './thrive.js';

describe('buildWorkOrderThriveMatchContext', () => {
  it('matches work-order values through the shared matcher', () => {
    expect(matchesWorkOrderNumber('WO64449', '64449')).toBe(true);
    expect(matchesWorkOrderNumber('64449', 'WO64449')).toBe(true);
    expect(matchesWorkOrderNumber('WO64449', 'WO64449')).toBe(true);
    expect(matchesWorkOrderNumber(null, 'WO64449')).toBe(false);
    expect(extractWorkOrderNumber('\\\\server\\print\\WO64449_Center_Sign.pdf')).toBe('64449');
    expect(matchesWorkOrderText('\\\\server\\print\\WO64449_Center_Sign.pdf', 'WO64449')).toBe(true);
    expect(matchesWorkOrderText('Unrelated Job.pdf', 'WO64449')).toBe(false);
  });

  it('matches print and cut jobs using bare numbers, WO prefixes, parseJobInfo, and GUID cross references', () => {
    const matchingPrintJob: ThriveJob = {
      jobGuid: 'print-1',
      jobName: 'WO64449_Center_Sign_0DGPMDD2632',
      fileName: '\\\\server\\print\\WO64449_Center_Sign_0DGPMDD2632.pdf',
      cutId: '0DGPMDD2632',
      workOrderNumber: '64449',
      status: 'Ready',
      statusCode: 8,
      createTime: '08:00:00',
      createDate: '2026-04-06',
      printer: 'HP Latex',
      printMedia: 'Duratrans',
      numCopies: 2,
    };

    const otherPrintJob: ThriveJob = {
      jobGuid: 'print-2',
      jobName: 'WO99999_Unrelated_Job',
      fileName: '\\\\server\\print\\WO99999_Unrelated_Job.pdf',
      cutId: null,
      workOrderNumber: 'WO99999',
      status: 'Queued',
      statusCode: 0,
      createTime: '09:00:00',
      createDate: '2026-04-06',
      printer: 'HP Latex',
      printMedia: 'Vinyl',
      numCopies: 1,
    };

    const cutByGuid: ThriveCutJob = {
      jobName: 'Queued Cut',
      fileName: 'Queued Cut.zcc',
      device: 'Zund 1',
      printer: 'Zund 1',
      media: 'Vinyl',
      width: 12,
      height: 24,
      guid: 'print-1',
      workOrderNumber: 'WO99999',
    };

    const cutByName: ThriveCutJob = {
      jobName: 'WO64449_Center_Sign_0DGPMDD2632.zcc',
      fileName: 'WO64449_Center_Sign_0DGPMDD2632.zcc',
      device: 'Zund 1',
      printer: 'Zund 1',
      media: 'Vinyl',
      width: 12,
      height: 24,
      guid: 'cut-2',
      workOrderNumber: '99999',
    };

    const context = buildWorkOrderThriveMatchContext(
      'WO64449',
      [matchingPrintJob, otherPrintJob],
      [cutByGuid, cutByName],
    );

    expect(context.bareNumber).toBe('64449');
    expect(context.matchingPrintJobs).toHaveLength(1);
    expect(context.matchingPrintJobs[0].jobGuid).toBe('print-1');
    expect(context.matchingCutJobs).toHaveLength(2);
    expect(context.printJobGuids.has('print-1')).toBe(true);
    expect(context.printCutIdMap.get('0dgpmdd2632')).toBe(matchingPrintJob.jobName);
    expect(context.normalizedPrintNames.size).toBeGreaterThan(0);
  });

  it('keeps print-row echoes out of the cut list unless the cut row has a distinct identity', () => {
    const matchingPrintJob: ThriveJob = {
      jobGuid: 'print-1',
      jobName: 'WO64449_Center_Sign_0DGPMDD2632',
      fileName: '\\\\server\\print\\WO64449_Center_Sign_0DGPMDD2632.pdf',
      cutId: '0DGPMDD2632',
      workOrderNumber: '64449',
      status: 'Ready',
      statusCode: 8,
      createTime: '08:00:00',
      createDate: '2026-04-06',
      printer: 'HP Latex',
      printMedia: 'Duratrans',
      numCopies: 2,
    };

    const echoedCut: ThriveCutJob = {
      jobName: 'WO64449_Center_Sign_0DGPMDD2632.zcc',
      fileName: 'WO64449_Center_Sign_0DGPMDD2632.zcc',
      device: 'Zund 1',
      printer: 'Zund 1',
      media: 'Vinyl',
      width: 12,
      height: 24,
      guid: '',
      workOrderNumber: '64449',
    };

    const distinctCut: ThriveCutJob = {
      jobName: 'WO64449_Center_Sign_0DGPMDD2632_copy.zcc',
      fileName: 'WO64449_Center_Sign_0DGPMDD2632_copy.zcc',
      device: 'Zund 1',
      printer: 'Zund 1',
      media: 'Vinyl',
      width: 12,
      height: 24,
      guid: 'cut-echo-1',
      workOrderNumber: '64449',
    };

    const context = buildWorkOrderThriveMatchContext('WO64449', [matchingPrintJob], [echoedCut, distinctCut]);

    expect(context.matchingPrintJobs).toHaveLength(1);
    expect(context.matchingCutJobs).toHaveLength(1);
    expect(context.matchingCutJobs[0].guid).toBe('cut-echo-1');
  });
});
