/**
 * File Chain Routes
 * 
 * API endpoints for the print-to-cut file linking system.
 * Exposes CRUD for PrintCutLink records, file tracing,
 * dashboard stats, and manual linking.
 */

import { Router } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { NotFoundError, BadRequestError } from '../middleware/error-handler.js';
import {
  getOrderFileChain,
  getOrderFileChainSummary,
  queryPrintCutLinks,
  getFileChainDashboard,
  createPrintCutLink,
  manuallyLinkCutFile,
  updatePrintCutLinkStatus,
  confirmPrintCutLink,
  dismissPrintCutLink,
  traceFile,
  runAutoLinkingCycle,
  queryFileChainLogs,
} from '../services/file-chain.js';
import { getZundWatcherStatus } from '../services/zund-watcher.js';
import { logActivity, ActivityAction, EntityType } from '../lib/activity-logger.js';
import { buildRouteActivityPayload } from '../lib/route-activity.js';
import { broadcast } from '../ws/server.js';
import { buildRouteBroadcastPayload } from '../lib/route-broadcast.js';

const router = Router();
router.use(authenticate);

// ─── Dashboard ─────────────────────────────────────────

/**
 * GET /file-chain/dashboard
 * Overall file chain monitoring dashboard
 */
router.get('/dashboard', async (_req: AuthRequest, res) => {
  const dashboard = await getFileChainDashboard();
  res.json({ success: true, data: dashboard });
});

// ─── Query Links ──────────────────────────────────────

/**
 * GET /file-chain/links
 * Query print-cut links with filters
 */
router.get('/links', async (req: AuthRequest, res) => {
  const filters = {
    workOrderId: req.query.workOrderId as string,
    status: req.query.status as string | string[],
    linkConfidence: req.query.linkConfidence as string,
    cutFileSource: req.query.cutFileSource as string,
    hasUnlinkedCut: req.query.hasUnlinkedCut === 'true' ? true : req.query.hasUnlinkedCut === 'false' ? false : undefined,
    fromDate: req.query.fromDate as string,
    toDate: req.query.toDate as string,
    search: req.query.search as string,
    page: req.query.page ? parseInt(req.query.page as string) : undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
  };

  const result = await queryPrintCutLinks(filters);
  res.json({ success: true, data: result });
});

// ─── Order File Chain ─────────────────────────────────

/**
 * GET /file-chain/orders/:orderId
 * Get the complete file chain for a work order
 */
router.get('/orders/:orderId', async (req: AuthRequest, res) => {
  const links = await getOrderFileChain(req.params.orderId);
  res.json({ success: true, data: links });
});

/**
 * GET /file-chain/orders/:orderId/summary
 * Get a summary of the file chain for a work order
 */
router.get('/orders/:orderId/summary', async (req: AuthRequest, res) => {
  const summary = await getOrderFileChainSummary(req.params.orderId);
  if (!summary) throw NotFoundError('Work order not found');
  res.json({ success: true, data: summary });
});

// ─── Create Link ──────────────────────────────────────

/**
 * POST /file-chain/links
 * Create a new print-cut link (usually when sending a file to RIP)
 */
router.post('/links', async (req: AuthRequest, res) => {
  const { workOrderId, printFileName, printFilePath, printFileSize, ripJobId, status } = req.body;

  if (!workOrderId || !printFileName || !printFilePath) {
    throw BadRequestError('workOrderId, printFileName, and printFilePath are required');
  }

  const link = await createPrintCutLink({
    workOrderId,
    printFileName,
    printFilePath,
    printFileSize,
    ripJobId,
    status,
  });

  await logActivity(
    buildRouteActivityPayload({
      action: ActivityAction.CREATE,
      entityType: EntityType.WORK_ORDER,
      entityId: workOrderId,
      entityName: printFileName,
      description: `Added file to chain: ${printFileName}`,
      userId: req.user!.id,
      req,
    }),
  );

  broadcast(buildRouteBroadcastPayload({ type: 'FILE_CHAIN_UPDATED', payload: { workOrderId } }));
  res.status(201).json({ success: true, data: link });
});

// ─── Manual Link ──────────────────────────────────────

/**
 * PUT /file-chain/links/:id/cut-file
 * Manually link a cut file to an existing print chain
 */
router.put('/links/:id/cut-file', async (req: AuthRequest, res) => {
  const { cutFileName, cutFilePath, cutFileSource } = req.body;

  if (!cutFileName || !cutFilePath || !cutFileSource) {
    throw BadRequestError('cutFileName, cutFilePath, and cutFileSource are required');
  }

  const link = await manuallyLinkCutFile({
    printCutLinkId: req.params.id,
    cutFileName,
    cutFilePath,
    cutFileSource,
    userId: req.userId!,
  });

  await logActivity(
    buildRouteActivityPayload({
      action: ActivityAction.UPDATE,
      entityType: EntityType.WORK_ORDER,
      entityId: link.workOrderId,
      entityName: cutFileName,
      description: `Manually linked cut file: ${cutFileName}`,
      userId: req.user!.id,
      req,
    }),
  );

  broadcast(buildRouteBroadcastPayload({ type: 'FILE_CHAIN_UPDATED', payload: { workOrderId: link.workOrderId } }));
  res.json({ success: true, data: link });
});

// ─── Confirm / Dismiss ────────────────────────────────

/**
 * PUT /file-chain/links/:id/confirm
 * Confirm an auto-linked cut file suggestion
 */
router.put('/links/:id/confirm', async (req: AuthRequest, res) => {
  const link = await confirmPrintCutLink(req.params.id, req.userId!);

  await logActivity(
    buildRouteActivityPayload({
      action: ActivityAction.UPDATE,
      entityType: EntityType.WORK_ORDER,
      entityId: link.workOrderId,
      entityName: link.cutFileName ?? undefined,
      description: `Confirmed file chain link: ${link.cutFileName}`,
      userId: req.user!.id,
      req,
    }),
  );

  broadcast(buildRouteBroadcastPayload({ type: 'FILE_CHAIN_UPDATED', payload: { workOrderId: link.workOrderId } }));
  res.json({ success: true, data: link });
});

/**
 * PUT /file-chain/links/:id/dismiss
 * Dismiss an auto-linked cut file suggestion
 */
router.put('/links/:id/dismiss', async (req: AuthRequest, res) => {
  const link = await dismissPrintCutLink(req.params.id, req.userId!);

  await logActivity(
    buildRouteActivityPayload({
      action: ActivityAction.UPDATE,
      entityType: EntityType.WORK_ORDER,
      entityId: link.workOrderId,
      entityName: link.cutFileName ?? undefined,
      description: `Dismissed file chain link suggestion`,
      userId: req.user!.id,
      req,
    }),
  );

  broadcast(buildRouteBroadcastPayload({ type: 'FILE_CHAIN_UPDATED', payload: { workOrderId: link.workOrderId } }));
  res.json({ success: true, data: link });
});

// ─── Status Update ────────────────────────────────────

/**
 * PUT /file-chain/links/:id/status
 * Update the status of a print-cut link
 */
router.put('/links/:id/status', async (req: AuthRequest, res) => {
  const { status, ...extra } = req.body;

  if (!status) {
    throw BadRequestError('status is required');
  }

  const link = await updatePrintCutLinkStatus(req.params.id, status, extra);

  broadcast(buildRouteBroadcastPayload({ type: 'FILE_CHAIN_UPDATED', payload: { workOrderId: link.workOrderId } }));
  res.json({ success: true, data: link });
});

// ─── File Trace ───────────────────────────────────────

/**
 * GET /file-chain/trace?fileName=...
 * Trace a file through the entire production chain
 */
router.get('/trace', async (req: AuthRequest, res) => {
  const fileName = req.query.fileName as string;
  if (!fileName) throw BadRequestError('fileName query parameter is required');

  const result = await traceFile(fileName);
  res.json({ success: true, data: result });
});

// ─── Manual Sync ──────────────────────────────────────

/**
 * POST /file-chain/sync
 * Manually trigger the auto-linking cycle
 */
router.post('/sync', async (req: AuthRequest, res) => {
  const result = await runAutoLinkingCycle();

  await logActivity(
    buildRouteActivityPayload({
      action: ActivityAction.UPDATE,
      entityType: EntityType.WORK_ORDER,
      entityId: 'system',
      entityName: 'File Chain Sync',
      description: `File chain sync: ${result.linksCreated} created, ${result.linksUpdated} updated, ${result.errors.length} errors`,
      userId: req.user!.id,
      req,
    }),
  );

  res.json({ success: true, data: result });
});

// ─── Logs ────────────────────────────────────────────

/**
 * GET /file-chain/logs
 * Query structured pipeline logs for debugging
 */
router.get('/logs', async (req: AuthRequest, res) => {
  const { source, event, level, cutId, workOrderId, fromDate, toDate, limit, page } = req.query;
  const logs = await queryFileChainLogs({
    source: source as string | undefined,
    event: event as string | undefined,
    level: level as string | undefined,
    cutId: cutId as string | undefined,
    workOrderId: workOrderId as string | undefined,
    fromDate: fromDate ? new Date(fromDate as string) : undefined,
    toDate: toDate ? new Date(toDate as string) : undefined,
    limit: limit ? parseInt(limit as string, 10) : undefined,
    page: page ? parseInt(page as string, 10) : undefined,
  });
  res.json({ success: true, data: logs });
});

// ─── Watcher Status ───────────────────────────────────

/**
 * GET /file-chain/watcher-status
 * Current state of the Zund queue watcher
 */
router.get('/watcher-status', async (_req: AuthRequest, res) => {
  const status = getZundWatcherStatus();
  res.json({ success: true, data: status });
});

export default router;
