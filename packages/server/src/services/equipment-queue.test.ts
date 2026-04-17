import { describe, expect, it } from 'vitest';
import { buildThriveJobsResponse, buildThriveMachineResponse } from './equipment-queue.js';

describe('equipment queue builders', () => {
  it('builds the Thrive jobs response summary from the linked jobs', () => {
    const response = buildThriveJobsResponse(
      [{ id: 'print-1', status: 'Printing' }, { id: 'print-2', status: 'Printed' }],
      [{ id: 'cut-1' }, { id: 'cut-2' }],
      [
        { job: { id: 'job-1' }, workOrder: { id: 'wo-1', orderNumber: '64524', status: 'IN_PROGRESS', customerName: 'Jimmy Dean' } },
        { job: { id: 'job-2' } },
      ],
    );

    expect(response).toEqual({
      printJobs: [
        { job: { id: 'job-1' }, workOrder: { id: 'wo-1', orderNumber: '64524', status: 'IN_PROGRESS', customerName: 'Jimmy Dean' } },
        { job: { id: 'job-2' } },
      ],
      cutJobs: [{ id: 'cut-1' }, { id: 'cut-2' }],
      summary: {
        totalPrintJobs: 2,
        totalCutJobs: 2,
        linkedToWorkOrders: 1,
        queuedCount: 1,
        completedCount: 1,
      },
    });
  });

  it('builds the machine response and flattens linked jobs into print jobs', () => {
    const response = buildThriveMachineResponse(
      {
        id: 'machine-1',
        name: 'Thrive Flatbed',
        ip: '192.168.254.53',
        printers: [{ name: 'HP Scitex FB700' }, { name: 'HP Latex 570-2' }],
      },
      [{ id: 'job-1', status: 'Ready to Print' }, { id: 'job-2', status: 'Printed' }],
      [
        {
          job: { id: 'job-1', jobName: 'WO64524' },
          workOrder: {
            id: 'wo-1',
            orderNumber: '64524',
            title: 'Jimmy Dean Blades',
            status: 'IN_PROGRESS',
            customerName: 'Jimmy Dean',
          },
        },
      ],
      [{ id: 'cut-1' }],
    );

    expect(response).toEqual({
      machine: { id: 'machine-1', name: 'Thrive Flatbed', ip: '192.168.254.53' },
      printJobs: [
        {
          id: 'job-1',
          jobName: 'WO64524',
          workOrder: {
            id: 'wo-1',
            orderNumber: '64524',
            title: 'Jimmy Dean Blades',
            status: 'IN_PROGRESS',
            customerName: 'Jimmy Dean',
          },
        },
      ],
      cutJobs: [{ id: 'cut-1' }],
      summary: {
        totalPrintJobs: 2,
        totalCutJobs: 1,
        linkedToWorkOrders: 1,
        queuedCount: 1,
        completedCount: 1,
        printers: ['HP Scitex FB700', 'HP Latex 570-2'],
      },
    });
  });

  it('dedupes duplicate and stale Thrive rows when summarizing the live-data badges', () => {
    const response = buildThriveMachineResponse(
      {
        id: 'machine-1',
        name: 'Thrive Flatbed',
        ip: '192.168.254.53',
        printers: [{ name: 'HP Scitex FB700' }],
      },
      [
        { id: 'job-1', status: 'Ready to Print' },
        { id: 'job-1', status: 'Printed' },
        { id: 'job-2', status: 'Printed' },
      ],
      [
        {
          job: { id: 'job-1', status: 'Ready to Print' },
          workOrder: {
            id: 'wo-1',
            orderNumber: '64524',
            title: 'Jimmy Dean Blades',
            status: 'IN_PROGRESS',
            customerName: 'Jimmy Dean',
          },
        },
        {
          job: { id: 'job-1', status: 'Printed' },
          workOrder: {
            id: 'wo-1',
            orderNumber: '64524',
            title: 'Jimmy Dean Blades',
            status: 'IN_PROGRESS',
            customerName: 'Jimmy Dean',
          },
        },
        {
          job: { id: 'job-2', status: 'Printed' },
          workOrder: null,
        },
      ],
      [{ id: 'cut-1' }, { id: 'cut-1' }],
    );

    expect(response.summary).toEqual({
      totalPrintJobs: 2,
      totalCutJobs: 1,
      linkedToWorkOrders: 1,
      queuedCount: 1,
      completedCount: 1,
      printers: ['HP Scitex FB700'],
    });
  });
});
