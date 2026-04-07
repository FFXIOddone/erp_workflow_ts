import 'dotenv/config';
import 'express-async-errors';

// Validate environment FIRST before any other imports that might use env vars
import { validateEnv, getEnv } from './lib/env-validation.js';
validateEnv();

import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { API_BASE_PATH } from '@erp/shared';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { isOriginAllowed, parseAllowedOrigins } from './lib/origin-allowlist.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { prisma } from './db/client.js';
import { errorHandler } from './middleware/error-handler.js';
import { authRouter } from './routes/auth.js';
import { ordersRouter } from './routes/orders.js';
import { usersRouter } from './routes/users.js';
import { itemsRouter } from './routes/items.js';
import { inventoryRouter } from './routes/inventory.js';
import { templatesRouter } from './routes/templates.js';
import { customersRouter } from './routes/customers.js';
import { companiesRouter } from './routes/companies.js';
import { quotesRouter } from './routes/quotes.js';
import { salesRouter } from './routes/sales.js';
import woocommerceRouter from './routes/woocommerce.js';
import { quickbooksRouter } from './routes/quickbooks.js';
import { notificationsRouter } from './routes/notifications.js';
import { emailRouter } from './routes/email.js';
import { uploadsRouter } from './routes/uploads.js';
import { documentsRouter } from './routes/documents.js';
import { reportsRouter } from './routes/reports.js';
import { settingsRouter } from './routes/settings.js';
import { activityRouter } from './routes/activity.js';
import shipmentsRouter from './routes/shipments.js';
import jobCostsRouter from './routes/job-costs.js';
import materialsRouter from './routes/materials.js';
import interactionsRouter from './routes/interactions.js';
import qrcodeRouter from './routes/qrcode.js';
import photoUploadRouter from './routes/photo-upload.js';
import portalRouter from './routes/portal.js';
import schedulingRouter from './routes/scheduling.js';
import creditRouter from './routes/credit.js';
import { fileBrowserRouter } from './routes/file-browser.js';
import { bulkRouter } from './routes/bulk.js';
import adminPerfRouter from './routes/admin-perf.js';
import { alertsRouter, processAlertRules } from './routes/alerts.js';
import { auditLogRouter } from './routes/audit-log.js';
import { batchImportRouter } from './routes/batch-import.js';
import { dashboardStatsRouter } from './routes/dashboard-stats.js';
import { exportsRouter } from './routes/exports.js';
import { fedexRouter } from './routes/fedex.js';
import { searchRouter } from './routes/search.js';
import { importRouter } from './routes/import.js';
import { ripQueueRouter } from './routes/rip-queue.js';
import { productionListRouter } from './routes/production-list.js';
import fileChainRouter from './routes/file-chain.js';
import updatesRouter from './routes/updates.js';
import clientErrorsRouter from './routes/client-errors.js';
import { microsoftOAuthRouter } from './routes/microsoft-oauth.js';
import equipmentRouter from './routes/equipment.js';
import { equipmentWatchRouter } from './routes/equipment-watch.js';
import { routingRouter } from './routes/routing.js';
import { handleAuthCallback } from './services/microsoft-oauth.js';
import { syncRipJobStatuses } from './services/rip-queue.js';
import { processEquipmentWatchRules } from './services/equipment-watch.js';
import { runAutoLinkingCycle } from './services/file-chain.js';
import {
  backfillFedExShipmentTrackingFromDatabase,
  syncFedExShipmentExports,
  syncFedExShipmentRecords,
  syncFedExShipmentReports,
} from './services/fedex.js';
import { startFedExHourlyTrackingRefresh } from './services/fedex-tracking-refresh.js';
import { initEmailService } from './services/email.js';
import { processEmailQueue } from './services/email-automation.js';
import { setupWebSocket } from './ws/server.js';
import { apiRateLimiter } from './middleware/rate-limiter.js';
import { startQBAutoPoll } from './services/qb-auto-poll.js';

const env = getEnv();
const isProduction = process.env.NODE_ENV === 'production';
const app: Express = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      ...(isProduction ? { upgradeInsecureRequests: [] } : {}),
    },
  },
}));
const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // non-browser clients
    const allowedOrigins = parseAllowedOrigins(env.CORS_ORIGIN);
    if (isOriginAllowed(origin, allowedOrigins)) {
      return callback(null, true);
    }
    console.warn(`[CORS] Rejected origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
});
app.use((req: Request, res: Response, next: NextFunction) => {
  corsMiddleware(req, res, (error) => {
    if (error instanceof Error && error.message === 'Not allowed by CORS') {
      res.status(403).json({ success: false, error: 'Not allowed by CORS' });
      return;
    }
    next(error);
  });
});
if (isProduction || process.env.ENABLE_HTTP_REQUEST_LOGS === 'true') {
  app.use(morgan('dev'));
} else {
  console.log('🪵 HTTP request logging is disabled in development. Set ENABLE_HTTP_REQUEST_LOGS=true to re-enable morgan.');
}
app.use(express.json());

// Apply global API rate limiter to all API routes
app.use(API_BASE_PATH, apiRateLimiter);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Microsoft OAuth callback — MUST be outside authenticated routes
// because this is a browser redirect from Microsoft, not an API call
// Uses /api/ (not /api/v1/) to match the redirect URI registered in Azure AD
app.get('/api/microsoft-oauth/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const error = req.query.error as string;
  const errorDescription = req.query.error_description as string;

  if (error) {
    // Microsoft returned an error — show it in a self-closing popup page
    // Sanitize for safe HTML/JS embedding
    const safeError = (error || '').replace(/[<>"'&]/g, '');
    const safeDesc = (errorDescription || 'Unknown error').replace(/[<>"'&]/g, '').replace(/\+/g, ' ');
    const needsConsent = error === 'access_denied' || (errorDescription || '').includes('AADSTS65001') || (errorDescription || '').includes('consent');

    res.send(`
      <html><body style="font-family: system-ui, sans-serif; max-width: 500px; margin: 40px auto; padding: 20px;">
        <h2 style="color: #dc2626;">Microsoft Email Connection Failed</h2>
        <p><strong>${safeError}</strong>: ${safeDesc}</p>
        ${needsConsent ? '<p style="background: #fef3c7; padding: 12px; border-radius: 8px; border: 1px solid #f59e0b;"><strong>Admin consent required.</strong> An IT admin for your Microsoft 365 tenant must grant consent for SMTP.Send permission on this app. Go to Azure Portal → App registrations → API permissions → Grant admin consent.</p>' : ''}
        <p style="color: #6b7280;">You can close this window and try again after the issue is resolved.</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'MS_OAUTH_ERROR', error: ${JSON.stringify(safeError + ': ' + safeDesc)} }, '*');
            setTimeout(function() { window.close(); }, 5000);
          }
        </script>
      </body></html>
    `);
    return;
  }

  if (!code) {
    res.status(400).send('<html><body><h2>Missing authorization code</h2></body></html>');
    return;
  }

  try {
    const result = await handleAuthCallback(code);
    // Success — notify the opener window and close the popup
    res.send(`
      <html><body>
        <h2>\u2705 Microsoft Email Connected!</h2>
        <p>Account: <strong>${result.email}</strong></p>
        <p>This window will close automatically...</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'MS_OAUTH_SUCCESS', email: '${result.email}' }, '*');
            setTimeout(() => window.close(), 1500);
          }
        </script>
      </body></html>
    `);
  } catch (err: any) {
    console.error('Microsoft OAuth callback error:', err);
    res.send(`
      <html><body>
        <h2>Connection Failed</h2>
        <p>${err?.message || 'Unknown error during token exchange'}</p>
        <p>You can close this window and try again.</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'MS_OAUTH_ERROR', error: '${(err?.message || 'Unknown').replace(/'/g, "\\'")}'  }, '*');
            setTimeout(() => window.close(), 5000);
          }
        </script>
      </body></html>
    `);
  }
});

// API Routes
app.use(`${API_BASE_PATH}/auth`, authRouter);
app.use(`${API_BASE_PATH}/orders`, ordersRouter);
app.use(`${API_BASE_PATH}/users`, usersRouter);
app.use(`${API_BASE_PATH}/items`, itemsRouter);
app.use(`${API_BASE_PATH}/inventory`, inventoryRouter);
app.use(`${API_BASE_PATH}/templates`, templatesRouter);
app.use(`${API_BASE_PATH}/customers`, customersRouter);
app.use(`${API_BASE_PATH}/companies`, companiesRouter);
app.use(`${API_BASE_PATH}/quotes`, quotesRouter);
app.use(`${API_BASE_PATH}/sales`, salesRouter);
app.use(`${API_BASE_PATH}/woocommerce`, woocommerceRouter);
app.use(`${API_BASE_PATH}/quickbooks`, quickbooksRouter);
app.use(`${API_BASE_PATH}/notifications`, notificationsRouter);
app.use(`${API_BASE_PATH}/email`, emailRouter);
app.use(`${API_BASE_PATH}/uploads`, uploadsRouter);
app.use(`${API_BASE_PATH}/documents`, documentsRouter);
app.use(`${API_BASE_PATH}/reports`, reportsRouter);
app.use(`${API_BASE_PATH}/settings`, settingsRouter);
app.use(`${API_BASE_PATH}/activity`, activityRouter);
app.use(`${API_BASE_PATH}/shipments`, shipmentsRouter);
app.use(`${API_BASE_PATH}/job-costs`, jobCostsRouter);
app.use(`${API_BASE_PATH}/materials`, materialsRouter);
app.use(`${API_BASE_PATH}/interactions`, interactionsRouter);
app.use(`${API_BASE_PATH}/qrcode`, qrcodeRouter);
app.use(`${API_BASE_PATH}/photo-upload`, photoUploadRouter);
app.use(`${API_BASE_PATH}/portal`, portalRouter);
app.use(`${API_BASE_PATH}/scheduling`, schedulingRouter);
app.use(`${API_BASE_PATH}/credit`, creditRouter);
app.use(`${API_BASE_PATH}/file-browser`, fileBrowserRouter);
app.use(`${API_BASE_PATH}/bulk`, bulkRouter);
app.use(`${API_BASE_PATH}/admin/perf`, adminPerfRouter);
app.use(`${API_BASE_PATH}/alerts`, alertsRouter);
app.use(`${API_BASE_PATH}/audit-log`, auditLogRouter);
app.use(`${API_BASE_PATH}/batch-import`, batchImportRouter);
app.use(`${API_BASE_PATH}/dashboard-stats`, dashboardStatsRouter);
app.use(`${API_BASE_PATH}/exports`, exportsRouter);
app.use(`${API_BASE_PATH}/fedex`, fedexRouter);
app.use(`${API_BASE_PATH}/search`, searchRouter);
app.use(`${API_BASE_PATH}/import`, importRouter);
app.use(`${API_BASE_PATH}/rip-queue`, ripQueueRouter);
app.use(`${API_BASE_PATH}/production-list`, productionListRouter);
app.use(`${API_BASE_PATH}/file-chain`, fileChainRouter);
app.use(`${API_BASE_PATH}/updates`, updatesRouter);
app.use(`${API_BASE_PATH}/client-errors`, clientErrorsRouter);
app.use(`${API_BASE_PATH}/microsoft-oauth`, microsoftOAuthRouter);
app.use(`${API_BASE_PATH}/equipment`, equipmentRouter);
app.use(`${API_BASE_PATH}/equipment-watch`, equipmentWatchRouter);
app.use(`${API_BASE_PATH}/routing`, routingRouter);

// ─── Production Static File Serving ──────────────────────────────────────────
// In production, serve the built frontend apps directly from the Express server.
// This eliminates the need for separate Vite dev servers (saves ~500MB+ RAM).
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..', '..');

// ─── Shop Floor Dev Mode ─────────────────────────────────────────────────────
// Always serve shop-floor/dist so the Tauri exe can load it in dev mode
// (regardless of NODE_ENV). This enables rapid frontend iteration.
const shopFloorDist = path.join(WORKSPACE_ROOT, 'packages', 'shop-floor', 'dist');
try {
  if (fs.existsSync(shopFloorDist)) {
    app.use('/shop-floor', express.static(shopFloorDist));
    app.get('/shop-floor/*', (_req: Request, res: Response) => {
      res.sendFile(path.join(shopFloorDist, 'index.html'));
    });
    console.log('  ✓ Shop Floor (Dev) → /shop-floor');
  }
} catch { /* dist not built, skip */ }

if (isProduction) {
  console.log('📦 Production mode: serving static frontends');

  // Map of sub-paths → built frontend directories
  const frontendApps: Array<{ route: string; distPath: string; label: string }> = [
    { route: '/portal', distPath: path.join(WORKSPACE_ROOT, 'packages', 'portal', 'dist'), label: 'Portal' },
    { route: '/shop-floor', distPath: path.join(WORKSPACE_ROOT, 'packages', 'shop-floor', 'dist'), label: 'Shop Floor (Dev)' },
  ];

  // Serve each sub-app on its own route
  for (const app_config of frontendApps) {
    try {
      if (fs.existsSync(app_config.distPath)) {
        app.use(app_config.route, express.static(app_config.distPath));
        // SPA fallback: serve index.html for any unmatched route under this path
        app.get(`${app_config.route}/*`, (_req: Request, res: Response) => {
          res.sendFile(path.join(app_config.distPath, 'index.html'));
        });
        console.log(`  ✓ ${app_config.label} → ${app_config.route}`);
      }
    } catch { /* dist not built, skip */ }
  }

  // Main web app served at root (must be last)
  const webDist = path.join(WORKSPACE_ROOT, 'packages', 'web', 'dist');
  try {
    if (fs.existsSync(webDist)) {
      app.use(express.static(webDist));
      // SPA fallback for the main app — but don't catch API routes
      app.get('*', (req: Request, res: Response, next: NextFunction) => {
        if (req.path.startsWith('/api/') || req.path.startsWith('/ws')) {
          return next();
        }
        res.sendFile(path.join(webDist, 'index.html'));
      });
      console.log('  ✓ Web App → /');
    }
  } catch { /* dist not built, skip */ }
}

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Not Found' });
});

// Error handler
app.use(errorHandler);

// Setup WebSocket
setupWebSocket(wss);

// Start server
const PORT = parseInt(process.env.SERVER_PORT ?? '8001', 10);
const HOST = process.env.SERVER_HOST ?? '0.0.0.0';
const enableDevBackgroundJobs = process.env.ENABLE_DEV_BACKGROUND_JOBS === 'true';
const enableHeavyBackgroundJobs = isProduction || enableDevBackgroundJobs;
const ALERT_RULES_INTERVAL_MS = 5 * 60 * 1000;
const RIP_QUEUE_SYNC_INTERVAL_MS = isProduction ? 60 * 1000 : 3 * 60 * 1000;
const FILE_CHAIN_SYNC_INTERVAL_MS = isProduction ? 2 * 60 * 1000 : 5 * 60 * 1000;
const EQUIPMENT_WATCH_INTERVAL_MS = isProduction ? 60 * 1000 : 3 * 60 * 1000;
const FEDEX_SYNC_INTERVAL_MS = isProduction ? 60 * 1000 : 5 * 60 * 1000;
const ZUND_CACHE_WARMER_INTERVAL_MS = isProduction ? 45_000 : 3 * 60 * 1000;
const ZUND_WATCHER_INTERVAL_MS = isProduction ? 20_000 : 90_000;
const ZUND_BACKGROUND_START_DELAY_MS = isProduction ? 0 : 30_000;

function createSingleFlightTask(task: () => Promise<void>) {
  let inFlight = false;

  return async () => {
    if (inFlight) {
      return;
    }

    inFlight = true;
    try {
      await task();
    } finally {
      inFlight = false;
    }
  };
}

async function start(): Promise<void> {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected');

    // Initialize email service
    // await initEmailService();

    // Start email queue processor (runs every 60 seconds)
    // const EMAIL_QUEUE_INTERVAL = parseInt(process.env.EMAIL_QUEUE_INTERVAL ?? '60000', 10);
    // setInterval(async () => {
    //   try {
    //     const result = await processEmailQueue();
    //     if (result.sent > 0 || result.failed > 0) {
    //       console.log(`📧 Email queue: ${result.sent} sent, ${result.failed} failed`);
    //     }
    //   } catch (error) {
    //     console.error('❌ Email queue error:', error);
    //   }
    // }, EMAIL_QUEUE_INTERVAL);
    // console.log(`📧 Email queue processor started (interval: ${EMAIL_QUEUE_INTERVAL / 1000}s)`);

    // Process alert rules every 5 minutes
    const runAlertRules = createSingleFlightTask(async () => {
      try {
        await processAlertRules();
      } catch (error) {
        console.error('❌ Alert rules error:', error);
      }
    });
    setInterval(() => {
      void runAlertRules();
    }, ALERT_RULES_INTERVAL_MS);
    console.log(`🔔 Alert rules processor started (interval: ${ALERT_RULES_INTERVAL_MS / 1000}s)`);

    if (enableHeavyBackgroundJobs) {
      // RIP Queue — auto-sync Thrive statuses every 60 seconds
      const runRipQueueSync = createSingleFlightTask(async () => {
        try {
          const updates = await syncRipJobStatuses();
          if (updates.length > 0) {
            console.log(`🖨️ RIP sync: ${updates.length} job(s) updated`);
          }
        } catch (error) {
          // Thrive shares may be offline — don't spam logs
          if (String(error).includes('ENOENT') || String(error).includes('ECONNREFUSED')) return;
          console.error('❌ RIP sync error:', error);
        }
      });
      setInterval(() => {
        void runRipQueueSync();
      }, RIP_QUEUE_SYNC_INTERVAL_MS);
      console.log(`🖨️ RIP queue Thrive sync started (interval: ${RIP_QUEUE_SYNC_INTERVAL_MS / 1000}s)`);

      // File Chain — auto-link print files to cut files every 2 minutes
      const runFileChainSync = createSingleFlightTask(async () => {
        try {
          const result = await runAutoLinkingCycle();
          const total = result.linksCreated + result.linksUpdated;
          if (total > 0) {
            console.log(`🔗 File chain sync: ${result.linksCreated} created, ${result.linksUpdated} updated${result.errors.length ? `, ${result.errors.length} errors` : ''}`);
          }
        } catch (error) {
          if (String(error).includes('ENOENT') || String(error).includes('ECONNREFUSED')) return;
          console.error('❌ File chain sync error:', error);
        }
      });
      setInterval(() => {
        void runFileChainSync();
      }, FILE_CHAIN_SYNC_INTERVAL_MS);
      console.log(`🔗 File chain auto-linking started (interval: ${FILE_CHAIN_SYNC_INTERVAL_MS / 1000}s)`);

      // Equipment watch rules — check every 60 seconds for scheduled alerts
      const runEquipmentWatchRules = createSingleFlightTask(async () => {
        try {
          const result = await processEquipmentWatchRules();
          if (result.sent > 0) {
            console.log(`⚡ Equipment watch: ${result.evaluated} evaluated, ${result.sent} emails sent`);
          }
        } catch (error) {
          console.error('❌ Equipment watch rules error:', error);
        }
      });
      setInterval(() => {
        void runEquipmentWatchRules();
      }, EQUIPMENT_WATCH_INTERVAL_MS);
      console.log(`⚡ Equipment watch rules processor started (interval: ${EQUIPMENT_WATCH_INTERVAL_MS / 1000}s)`);

      const runFedExSync = createSingleFlightTask(async () => {
        try {
          const logResult = await syncFedExShipmentRecords();
          if (logResult.status === 'synced' && (logResult.imported > 0 || logResult.updated > 0)) {
            console.log(
              `📦 FedEx XML sync: ${logResult.imported} imported, ${logResult.updated} updated from ${logResult.sourceFileName}`
            );
          }
          const reportResult = await syncFedExShipmentReports();
          if (reportResult.status === 'synced' && (reportResult.imported > 0 || reportResult.updated > 0)) {
            console.log(
              `📦 FedEx report sync: ${reportResult.imported} imported, ${reportResult.updated} updated from ${reportResult.sourceFileName}`
            );
          }
          const exportResult = await syncFedExShipmentExports();
          if (exportResult.status === 'synced' && (exportResult.imported > 0 || exportResult.updated > 0)) {
            console.log(
              `📦 FedEx export sync: ${exportResult.imported} imported, ${exportResult.updated} updated from ${exportResult.sourceFileName}`
            );
          }
          const databaseBackfillResult = await backfillFedExShipmentTrackingFromDatabase();
          if (
            databaseBackfillResult.status === 'synced' &&
            (databaseBackfillResult.updatedRecords > 0 || databaseBackfillResult.updatedShipments > 0)
          ) {
            console.log(
              `📦 FedEx database backfill: ${databaseBackfillResult.linkedRecords} linked, ${databaseBackfillResult.updatedRecords} records updated, ${databaseBackfillResult.updatedShipments} shipment rows updated`
            );
          }
        } catch (error) {
          if (
            String(error).includes('ENOENT') ||
            String(error).includes('EACCES') ||
            String(error).includes('EPERM') ||
            String(error).includes('ECONNREFUSED')
          ) {
            return;
          }
          console.error('❌ FedEx sync error:', error);
        }
      });
      setInterval(() => {
        void runFedExSync();
      }, FEDEX_SYNC_INTERVAL_MS);
      console.log(`📦 FedEx sync started (interval: ${FEDEX_SYNC_INTERVAL_MS / 1000}s)`);

      startFedExHourlyTrackingRefresh();
      console.log('📦 FedEx hourly tracking refresh started (on the hour)');

      const startZundBackgroundServices = async () => {
        const { startZundLiveCacheWarmer } = await import('./services/zund-live.js');
        startZundLiveCacheWarmer(ZUND_CACHE_WARMER_INTERVAL_MS);

        const { startZundWatcher } = await import('./services/zund-watcher.js');
        startZundWatcher(ZUND_WATCHER_INTERVAL_MS);
      };

      if (ZUND_BACKGROUND_START_DELAY_MS > 0) {
        setTimeout(() => {
          void startZundBackgroundServices();
        }, ZUND_BACKGROUND_START_DELAY_MS);
        console.log(`👁️ Zund background services will start after ${ZUND_BACKGROUND_START_DELAY_MS / 1000}s`);
      } else {
        await startZundBackgroundServices();
      }
    } else {
      console.log('⏸️ Heavy background sync is disabled in development. Set ENABLE_DEV_BACKGROUND_JOBS=true to re-enable RIP, file-chain, equipment-watch, and Zund polling.');
    }

    server.listen(PORT, HOST, () => {
      console.log(`🚀 Server running at http://${HOST}:${PORT}`);
      console.log(`📡 WebSocket server running at ws://${HOST}:${PORT}`);
      console.log(`📚 API available at ${API_BASE_PATH}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// ====== Crash Protection ======
// Catch unhandled promise rejections (e.g. failed DB queries, network errors)
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️  Unhandled Promise Rejection — server staying alive:');
  console.error('   Reason:', reason);
  // Don't exit — let the server keep running
});

// Catch uncaught exceptions (e.g. null references, type errors in callbacks)
process.on('uncaughtException', (error) => {
  console.error('⚠️  Uncaught Exception — server staying alive:');
  console.error('   Error:', error.message);
  console.error('   Stack:', error.stack);
  // Don't exit — the Express error handler will catch most things,
  // but this is a safety net for errors outside request handlers
  // (timers, WebSocket handlers, background tasks, etc.)
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await prisma.$disconnect();
  server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 SIGTERM received, shutting down...');
  await prisma.$disconnect();
  server.close();
  process.exit(0);
});

start();
