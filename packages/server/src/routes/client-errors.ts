/**
 * Client Error Reporting Endpoint
 * 
 * Shop Floor (and other) apps POST errors here so they're captured
 * in a central log file that can be tailed for debugging.
 * 
 * POST /api/v1/client-errors
 *   Body: { source, level, message, stack?, context?, url?, userAgent? }
 *   No auth required — errors may happen before/during login
 *   Rate limited — prevent log flooding
 */

import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import { authenticate, type AuthRequest } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.resolve(__dirname, '..', '..', '..', '..', 'logs');
const CLIENT_LOG = path.join(LOG_DIR, 'client-errors.log');

// Ensure logs directory
try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch { /* ok */ }

// Rate limit: 30 error reports per minute per IP
const errorReportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { success: false, error: 'Too many error reports, slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Truncate fields to prevent log inflation attacks
function truncate(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.slice(0, maxLen);
}

const router = Router();

router.post('/', errorReportLimiter, (req, res) => {
  const { source, level, message, stack, context, url, userAgent } = req.body || {};

  const entry = {
    timestamp: new Date().toISOString(),
    source: truncate(source, 100) || 'unknown',
    level: truncate(level, 20) || 'error',
    message: truncate(message, 2000) || 'No message',
    stack: stack ? truncate(stack, 5000) : undefined,
    context: context ? truncate(typeof context === 'object' ? JSON.stringify(context) : context, 2000) : undefined,
    clientUrl: url ? truncate(url, 500) : undefined,
    userAgent: truncate(userAgent, 300) || req.headers['user-agent']?.slice(0, 300),
    ip: req.ip,
  };

  const line = JSON.stringify(entry) + '\n';
  fs.appendFile(CLIENT_LOG, line, () => { /* fire and forget */ });

  // Also log to server console for visibility
  console.error(`[CLIENT ${entry.source}] ${entry.level}: ${entry.message}`);

  res.json({ success: true, logged: true });
});

// GET endpoint to read recent errors — requires admin auth
router.get('/', authenticate, (req: AuthRequest, res) => {
  const lines = (req.query.lines as string) || '50';
  const count = Math.min(parseInt(lines, 10) || 50, 500);

  try {
    if (!fs.existsSync(CLIENT_LOG)) {
      return res.json({ success: true, data: [] });
    }
    const content = fs.readFileSync(CLIENT_LOG, 'utf-8');
    const allLines = content.trim().split('\n').filter(Boolean);
    const recent = allLines.slice(-count).map(l => {
      try { return JSON.parse(l); } catch { return { raw: l }; }
    });
    res.json({ success: true, data: recent, total: allLines.length });
  } catch (err: any) {
    res.json({ success: true, data: [], error: err.message });
  }
});

export default router;
