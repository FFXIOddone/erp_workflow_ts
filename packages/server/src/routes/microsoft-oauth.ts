/**
 * Microsoft OAuth2 Routes
 * 
 * Handles the browser-based OAuth flow for connecting Microsoft 365 email.
 * Admin-only endpoints.
 */

import { Router, type Response } from 'express';
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth.js';
import { UserRole } from '@erp/shared';
import {
  isMicrosoftOAuthConfigured,
  getAuthorizationUrl,
  handleAuthCallback,
  getConnectionStatus,
  disconnectMicrosoft,
} from '../services/microsoft-oauth.js';

export const microsoftOAuthRouter = Router();

// All routes require authentication
microsoftOAuthRouter.use(authenticate);

/**
 * GET /microsoft-oauth/status
 * Check if Microsoft email is connected, configured, etc.
 */
microsoftOAuthRouter.get('/status', requireRole(UserRole.ADMIN), async (_req: AuthRequest, res: Response) => {
  const status = await getConnectionStatus();
  res.json({ success: true, data: status });
});

/**
 * GET /microsoft-oauth/auth-url
 * Generate the Microsoft login URL. Frontend opens this in a popup.
 */
microsoftOAuthRouter.get('/auth-url', requireRole(UserRole.ADMIN), async (_req: AuthRequest, res: Response) => {
  if (!isMicrosoftOAuthConfigured()) {
    res.status(400).json({
      success: false,
      error: 'Microsoft OAuth not configured. Set MS_CLIENT_ID, MS_CLIENT_SECRET, and MS_TENANT_ID in the server .env file.',
    });
    return;
  }

  const url = await getAuthorizationUrl();
  res.json({ success: true, data: { url } });
});

/**
 * POST /microsoft-oauth/disconnect
 * Remove stored tokens and disconnect Microsoft email
 */
microsoftOAuthRouter.post('/disconnect', requireRole(UserRole.ADMIN), async (_req: AuthRequest, res: Response) => {
  await disconnectMicrosoft();
  res.json({ success: true, message: 'Microsoft email disconnected' });
});

export default microsoftOAuthRouter;
