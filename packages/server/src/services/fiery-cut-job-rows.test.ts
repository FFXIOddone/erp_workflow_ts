import { describe, expect, it } from 'vitest';
import {
  buildFieryCutJobRows,
  filterThriveCutJobsAgainstFieryJobs,
  type FieryJob,
} from './fiery.js';

describe('buildFieryCutJobRows', () => {
  it('only includes Fiery jobs with real ZCC files and a usable link', () => {
    const jobs: FieryJob[] = [
      {
        jobId: 'job-1',
        jobName: 'No Cut File',
        fileName: 'no-cut.jdf',
        timestamp: null,
        dimensions: { widthIn: 10, heightIn: 20 },
        media: {
          vutekMedia: 'Gloss Vinyl',
          brand: null,
          description: 'Gloss Vinyl',
          type: null,
        },
        inks: [],
        previewUrl: null,
        rtlUrl: null,
        hasZccCutFile: false,
        zccFileName: null,
        workOrderNumber: '64524',
        customerName: 'Pribusin',
        thriveFilePath: null,
        thriveJobMatch: true,
      },
      {
        jobId: 'job-2',
        jobName: 'Has Cut File But No Link',
        fileName: 'cut-but-no-link.jdf',
        timestamp: null,
        dimensions: { widthIn: 11.25, heightIn: 22.5 },
        media: {
          vutekMedia: 'Blockout',
          brand: null,
          description: 'Blockout',
          type: null,
        },
        inks: [],
        previewUrl: null,
        rtlUrl: null,
        hasZccCutFile: true,
        zccFileName: 'cut-but-no-link.zcc',
        workOrderNumber: null,
        customerName: null,
        thriveFilePath: null,
        thriveJobMatch: false,
      },
      {
        jobId: 'job-3',
        jobName: 'Linked Cut File',
        fileName: 'linked-cut.jdf',
        timestamp: null,
        dimensions: { widthIn: 24, heightIn: 36 },
        media: {
          vutekMedia: 'Duratrans',
          brand: null,
          description: 'Duratrans',
          type: null,
        },
        inks: [],
        previewUrl: null,
        rtlUrl: null,
        hasZccCutFile: true,
        zccFileName: 'linked-cut.zcc',
        workOrderNumber: '64524',
        customerName: 'Pribusin',
        thriveFilePath: null,
        thriveJobMatch: true,
      },
    ];

    const rows = buildFieryCutJobRows(jobs);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      jobName: 'Linked Cut File',
      fileName: 'linked-cut.zcc',
      workOrderNumber: '64524',
      device: 'Fiery ZCC',
      printer: 'Duratrans',
      media: 'Duratrans',
      width: 610,
      height: 914,
      guid: 'job-3',
      customerName: 'Pribusin',
      companyBrand: undefined,
    });
  });

  it('filters Thrive cut rows that are already represented by linked Fiery jobs', () => {
    const fieryJobs: FieryJob[] = [
      {
        jobId: 'job-3',
        jobName: 'Linked Cut File',
        fileName: 'linked-cut.jdf',
        timestamp: null,
        dimensions: { widthIn: 24, heightIn: 36 },
        media: {
          vutekMedia: 'Duratrans',
          brand: null,
          description: 'Duratrans',
          type: null,
        },
        inks: [],
        previewUrl: null,
        rtlUrl: null,
        hasZccCutFile: true,
        zccFileName: 'linked-cut.zcc',
        workOrderNumber: '64524',
        customerName: 'Pribusin',
        thriveFilePath: null,
        thriveJobMatch: true,
      },
    ];

    const cuts = [
      {
        jobName: 'Linked Cut File',
        fileName: 'linked-cut.zcc',
        guid: 'job-3',
        workOrderNumber: '64524',
      },
      {
        jobName: 'Unlinked Thrive Cut',
        fileName: 'unlinked-cut.zcc',
        guid: 'job-99',
        workOrderNumber: '99999',
      },
    ];

    const filtered = filterThriveCutJobsAgainstFieryJobs(cuts, fieryJobs);

    expect(filtered).toEqual([
      {
        jobName: 'Unlinked Thrive Cut',
        fileName: 'unlinked-cut.zcc',
        guid: 'job-99',
        workOrderNumber: '99999',
      },
    ]);
  });
});
