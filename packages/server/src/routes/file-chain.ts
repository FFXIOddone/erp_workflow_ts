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
  traceFile,
  runAutoLinkingCycle,
} from '../services/file-chain.js';
import { logActivity, ActivityAction, EntityType } from '../lib/activity-logger.js';
import { broadcast } from '../ws/server.js';

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

  await logActivity({
    action: ActivityAction.CREATE,
    entityType: EntityType.WORK_ORDER,
    entityId: workOrderId,
    description: `Added file to chain: ${printFileName}`,
    userId: req.userId!,
    req,
  });

  broadcast({ type: 'FILE_CHAIN_UPDATED', payload: { workOrderId } });
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

  await logActivity({
    action: ActivityAction.UPDATE,
    entityType: EntityType.WORK_ORDER,
    entityId: link.workOrderId,
    description: `Manually linked cut file: ${cutFileName}`,
    userId: req.userId!,
    req,
  });

  broadcast({ type: 'FILE_CHAIN_UPDATED', payload: { workOrderId: link.workOrderId } });
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

  broadcast({ type: 'FILE_CHAIN_UPDATED', payload: { workOrderId: link.workOrderId } });
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

  await logActivity({
    action: ActivityAction.UPDATE,
    entityType: EntityType.WORK_ORDER,
    entityId: 'system',
    description: `File chain sync: ${result.linksCreated} created, ${result.linksUpdated} updated, ${result.errors.length} errors`,
    userId: req.userId!,
    req,
  });

  res.json({ success: true, data: result });
});

export default router;
