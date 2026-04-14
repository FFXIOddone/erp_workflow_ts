import { Router, type NextFunction, type RequestHandler, type Response } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { BadRequestError } from '../middleware/error-handler.js';
import {
  getFedExSyncStatus,
  listFedExShipmentRecords,
  listFedExShipmentSummaries,
  resolveFedExLogFile,
  syncFedExShipmentRecords,
} from '../services/fedex.js';
import {
  fetchFedExStatusPreview,
  isFedExApiConfigured,
  syncFedExTrackingForShipment,
} from '../services/fedex-api.js';
import {
  runFedExTrackingFullReconciliationCycle,
  runFedExAmbiguousTrackingRepairCycle,
  runFedExTrackingRefreshCycle,
} from '../services/fedex-tracking-refresh.js';

export const fedexRouter = Router();

// eslint-disable-next-line @typescript-eslint/no-misused-promises
fedexRouter.use((req, res, next) => {
  void authenticate(req as AuthRequest, res, next).catch(next);
});

type FedExSyncRequestBody = {
  date?: unknown;
  filePath?: unknown;
  dryRun?: unknown;
};

type FedExTrackPreviewBody = {
  trackingNumber?: unknown;
  force?: unknown;
};

type FedExShipmentRefreshBody = {
  force?: unknown;
};

function parseDateValue(value: unknown): Date | null {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getLocalDayRange(date = new Date()): { fromDate: Date; toDate: Date } {
  const fromDate = new Date(date);
  fromDate.setHours(0, 0, 0, 0);

  const toDate = new Date(date);
  toDate.setHours(23, 59, 59, 999);

  return { fromDate, toDate };
}

function resolveFedExRecordFilters(req: AuthRequest): {
  page: number;
  pageSize: number;
  search: string | undefined;
  trackingNumber: string | undefined;
  fromDate: Date;
  toDate: Date;
} {
  const page = req.query.page ? Number(req.query.page) : 1;
  const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 25;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const trackingNumber =
    typeof req.query.trackingNumber === 'string' ? req.query.trackingNumber.trim() : '';
  const fromDate = parseDateValue(req.query.fromDate);
  const toDate = parseDateValue(req.query.toDate);

  if (fromDate && toDate) {
    return {
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 25,
      search: search || undefined,
      trackingNumber: trackingNumber || undefined,
      fromDate,
      toDate,
    };
  }

  const todayRange = getLocalDayRange();
  return {
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 25,
    search: search || undefined,
    trackingNumber: trackingNumber || undefined,
    fromDate: fromDate ?? todayRange.fromDate,
    toDate: toDate ?? todayRange.toDate,
  };
}

function wrapAsync(
  handler: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    void handler(req as AuthRequest, res, next).catch(next);
  };
}

// GET /fedex/status - Resolve today's log file and report the last sync summary
fedexRouter.get('/status', wrapAsync(async (_req: AuthRequest, res: Response) => {
  const resolved = await resolveFedExLogFile();
  const syncStatus = getFedExSyncStatus();
  const recordCount = resolved
    ? await listFedExShipmentRecords({
        fromDate: resolved.sourceFileDate,
        toDate: resolved.sourceFileDate,
        pageSize: 1,
      }).then((result) => result.total)
    : 0;

  res.json({
    success: true,
    data: {
      rootPaths: syncStatus.logRoots,
      currentLog: resolved
        ? {
            fileName: resolved.fileName,
            filePath: resolved.filePath,
            sourceFileDate: resolved.sourceFileDate,
            matchedBy: resolved.matchedBy,
            recordCount,
          }
        : null,
      lastSync: syncStatus.lastSync,
    },
  });
}));

async function handleFedExRecordList(req: AuthRequest, res: Response): Promise<void> {
  const data = await listFedExShipmentRecords(resolveFedExRecordFilters(req));

  res.json({
    success: true,
    data,
  });
}

async function handleFedExShipmentSummaryList(req: AuthRequest, res: Response): Promise<void> {
  const data = await listFedExShipmentSummaries(resolveFedExRecordFilters(req));

  res.json({
    success: true,
    data,
  });
}

// GET /fedex/shipments - Browse grouped FedEx shipment summaries (defaults to today)
fedexRouter.get('/shipments', wrapAsync(handleFedExShipmentSummaryList));

// GET /fedex/records - Browse raw FedEx import records
fedexRouter.get('/records', wrapAsync(handleFedExRecordList));

// POST /fedex/sync - Force a sync from the current day's log file
fedexRouter.post('/sync', wrapAsync(async (req: AuthRequest, res: Response) => {
  const body = (req.body ?? {}) as FedExSyncRequestBody;
  const date = parseDateValue(body.date);
  const filePath = typeof body.filePath === 'string' ? body.filePath : undefined;
  const dryRun = body.dryRun === true;

  if (body.date !== undefined && body.date !== null && !date) {
    throw BadRequestError('date must be a valid ISO date string');
  }

  if (body.filePath !== undefined && body.filePath !== null && typeof filePath !== 'string') {
    throw BadRequestError('filePath must be a string');
  }

  const result = await syncFedExShipmentRecords({
    date: date ?? undefined,
    filePath,
    dryRun,
  });

  res.json({
    success: true,
    data: result,
  });
}));

// GET /fedex/api-status - Report whether FedEx API credentials are configured
fedexRouter.get('/api-status', wrapAsync(async (_req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      configured: isFedExApiConfigured(),
    },
  });
}));

// POST /fedex/track-preview - Fetch live FedEx status by tracking number (no DB writes)
fedexRouter.post('/track-preview', wrapAsync(async (req: AuthRequest, res: Response) => {
  const body = (req.body ?? {}) as FedExTrackPreviewBody;
  const trackingNumber = typeof body.trackingNumber === 'string' ? body.trackingNumber.trim() : '';
  const force = body.force === true;

  if (!trackingNumber) {
    throw BadRequestError('trackingNumber is required');
  }

  const preview = await fetchFedExStatusPreview(trackingNumber, { force });

  res.json({
    success: true,
    data: preview,
  });
}));

// POST /fedex/shipments/:shipmentId/refresh - Force a shipment status refresh from FedEx API
fedexRouter.post('/shipments/:shipmentId/refresh', wrapAsync(async (req: AuthRequest, res: Response) => {
  const { shipmentId } = req.params;
  if (!shipmentId) {
    throw BadRequestError('shipmentId is required');
  }

  const body = (req.body ?? {}) as FedExShipmentRefreshBody;
  const force = body.force === true;
  const result = await syncFedExTrackingForShipment(shipmentId, { force });

  res.json({
    success: true,
    data: result,
  });
}));

// POST /fedex/tracking/refresh-all - Full reconciliation for every tracked shipment (including delivered)
fedexRouter.post('/tracking/refresh-all', wrapAsync(async (_req: AuthRequest, res: Response) => {
  const result = await runFedExTrackingFullReconciliationCycle();

  res.json({
    success: true,
    data: result,
  });
}));

// POST /fedex/tracking/refresh-hourly-scope - Run the same scoped refresh used by the hourly scheduler
fedexRouter.post('/tracking/refresh-hourly-scope', wrapAsync(async (_req: AuthRequest, res: Response) => {
  const result = await runFedExTrackingRefreshCycle();

  res.json({
    success: true,
    data: result,
  });
}));

// POST /fedex/tracking/repair-ambiguous - Repair ambiguous FedEx reference-style tracking rows
fedexRouter.post('/tracking/repair-ambiguous', wrapAsync(async (_req: AuthRequest, res: Response) => {
  const result = await runFedExAmbiguousTrackingRepairCycle();

  res.json({
    success: true,
    data: result,
  });
}));
