/**
 * Microsoft OAuth2 Service
 * 
 * Handles the Authorization Code flow for Microsoft 365 email:
 * 1. Admin clicks "Connect Microsoft Email" → we generate auth URL
 * 2. Browser opens Microsoft login popup → user signs in
 * 3. Microsoft redirects back with auth code
 * 4. Server exchanges code for access + refresh tokens
 * 5. Tokens stored in DB → auto-refreshed when expired
 * 6. Email service uses the access token via XOAUTH2
 */

import * as msal from '@azure/msal-node';
import { prisma } from '../db/client.js';

// ─── Azure AD App Registration Config ───
// You must register an app at https://portal.azure.com → Azure Active Directory → App registrations
// Required API permissions: SMTP.Send (or Mail.Send for Graph API)
// Redirect URI: http://localhost:8001/api/microsoft-oauth/callback (or your production URL)
const MS_CLIENT_ID = process.env.MS_CLIENT_ID || '';
const MS_CLIENT_SECRET = process.env.MS_CLIENT_SECRET || '';
const MS_TENANT_ID = process.env.MS_TENANT_ID || 'common'; // 'common' for multi-tenant, or your tenant ID
const MS_REDIRECT_URI = process.env.MS_REDIRECT_URI || 'http://localhost:8001/api/microsoft-oauth/callback';

// Scopes needed for sending email via SMTP XOAUTH2
const SCOPES = [
  'https://outlook.office365.com/SMTP.Send',
  'offline_access', // Required to get a refresh token
];

const OAUTH_TOKEN_ID = 'microsoft-email'; // singleton DB row key

// ─── MSAL Confidential Client ───
let msalClient: msal.ConfidentialClientApplication | null = null;

function getMsalClient(): msal.ConfidentialClientApplication {
  if (!msalClient) {
    if (!MS_CLIENT_ID || !MS_CLIENT_SECRET) {
      throw new Error(
        'Microsoft OAuth not configured. Set MS_CLIENT_ID and MS_CLIENT_SECRET in .env.\n' +
        'Register an app at https://portal.azure.com → Azure AD → App registrations'
      );
    }

    msalClient = new msal.ConfidentialClientApplication({
      auth: {
        clientId: MS_CLIENT_ID,
        clientSecret: MS_CLIENT_SECRET,
        authority: `https://login.microsoftonline.com/${MS_TENANT_ID}`,
      },
    });
  }
  return msalClient;
}

/**
 * Check if Microsoft OAuth is configured (env vars present)
 */
export function isMicrosoftOAuthConfigured(): boolean {
  return !!(MS_CLIENT_ID && MS_CLIENT_SECRET);
}

/**
 * Generate the Microsoft login URL for the admin to visit
 */
export async function getAuthorizationUrl(): Promise<string> {
  const client = getMsalClient();
  const authUrl = await client.getAuthCodeUrl({
    scopes: SCOPES,
    redirectUri: MS_REDIRECT_URI,
    prompt: 'consent', // Always show consent screen to ensure we get refresh token
  });
  return authUrl;
}

/**
 * Exchange the authorization code for access + refresh tokens, and store in DB
 */
export async function handleAuthCallback(code: string, userId?: string): Promise<{
  email: string;
  expiresAt: Date;
}> {
  const client = getMsalClient();
  
  const result = await client.acquireTokenByCode({
    code,
    scopes: SCOPES,
    redirectUri: MS_REDIRECT_URI,
  });

  if (!result || !result.accessToken) {
    throw new Error('Microsoft OAuth: Failed to acquire tokens — no access token in response');
  }

  // The account email from the token claims
  const accountEmail = result.account?.username || result.account?.name || 'unknown';
  
  // MSAL doesn't directly expose the refresh token via the public API in newer versions.
  // We need to extract it from the token cache.
  const cache = client.getTokenCache();
  const cacheContent = cache.serialize();
  const cacheData = JSON.parse(cacheContent);
  
  // Find the refresh token in the cache
  let refreshToken = '';
  if (cacheData.RefreshToken) {
    const rtKeys = Object.keys(cacheData.RefreshToken);
    if (rtKeys.length > 0) {
      refreshToken = cacheData.RefreshToken[rtKeys[0]].secret;
    }
  }

  if (!refreshToken) {
    throw new Error(
      'Microsoft OAuth: No refresh token received. Make sure the app has offline_access permission and prompt=consent was used.'
    );
  }

  const expiresAt = result.expiresOn || new Date(Date.now() + 3600 * 1000);

  // Upsert into DB
  await prisma.oAuthToken.upsert({
    where: { id: OAUTH_TOKEN_ID },
    create: {
      id: OAUTH_TOKEN_ID,
      provider: 'microsoft',
      accessToken: result.accessToken,
      refreshToken,
      expiresAt,
      scope: SCOPES.join(' '),
      accountEmail,
      connectedBy: userId || null,
    },
    update: {
      accessToken: result.accessToken,
      refreshToken,
      expiresAt,
      scope: SCOPES.join(' '),
      accountEmail,
      connectedBy: userId || null,
    },
  });

  console.log('\n' + '='.repeat(60));
  console.log('  ✅ MICROSOFT EMAIL: OAuth connected!');
  console.log('     Account: %s', accountEmail);
  console.log('     Expires: %s', expiresAt.toISOString());
  console.log('='.repeat(60) + '\n');

  return { email: accountEmail, expiresAt };
}

/**
 * Get a valid access token for sending email.
 * Refreshes automatically if expired.
 * Returns null if not connected.
 */
export async function getValidAccessToken(): Promise<{
  accessToken: string;
  email: string;
} | null> {
  const record = await prisma.oAuthToken.findUnique({
    where: { id: OAUTH_TOKEN_ID },
  });

  if (!record) {
    return null; // Not connected
  }

  // If token is still valid (with 5-minute buffer), use it
  const bufferMs = 5 * 60 * 1000;
  if (record.expiresAt.getTime() > Date.now() + bufferMs) {
    return {
      accessToken: record.accessToken,
      email: record.accountEmail || '',
    };
  }

  // Token expired — refresh it
  console.log('📧 [Microsoft OAuth] Access token expired, refreshing...');
  
  try {
    const client = getMsalClient();
    
    // Use the refresh token to get a new access token
    const result = await client.acquireTokenByRefreshToken({
      refreshToken: record.refreshToken,
      scopes: SCOPES,
    });

    if (!result || !result.accessToken) {
      throw new Error('Token refresh returned no access token');
    }

    // Check if we got a new refresh token (rotation)
    const cache = client.getTokenCache();
    const cacheContent = cache.serialize();
    const cacheData = JSON.parse(cacheContent);
    let newRefreshToken = record.refreshToken;
    if (cacheData.RefreshToken) {
      const rtKeys = Object.keys(cacheData.RefreshToken);
      if (rtKeys.length > 0) {
        newRefreshToken = cacheData.RefreshToken[rtKeys[0]].secret;
      }
    }

    const newExpiresAt = result.expiresOn || new Date(Date.now() + 3600 * 1000);

    // Update DB with new tokens
    await prisma.oAuthToken.update({
      where: { id: OAUTH_TOKEN_ID },
      data: {
        accessToken: result.accessToken,
        refreshToken: newRefreshToken,
        expiresAt: newExpiresAt,
      },
    });

    console.log('📧 [Microsoft OAuth] Token refreshed successfully, expires %s', newExpiresAt.toISOString());

    return {
      accessToken: result.accessToken,
      email: record.accountEmail || '',
    };
  } catch (error: any) {
    console.error('\n' + '!'.repeat(60));
    console.error('!!!  MICROSOFT OAUTH TOKEN REFRESH FAILED  !!!');
    console.error('  Error: %s', error?.message);
    console.error('  The admin may need to re-connect Microsoft Email in Settings');
    console.error('!'.repeat(60) + '\n');
    
    // Don't delete the record — the admin can re-auth
    return null;
  }
}

/**
 * Get the current connection status
 */
export async function getConnectionStatus(): Promise<{
  connected: boolean;
  configured: boolean;
  email?: string;
  expiresAt?: Date;
  connectedBy?: string;
}> {
  const configured = isMicrosoftOAuthConfigured();

  if (!configured) {
    return { connected: false, configured: false };
  }

  const record = await prisma.oAuthToken.findUnique({
    where: { id: OAUTH_TOKEN_ID },
  });

  if (!record) {
    return { connected: false, configured: true };
  }

  return {
    connected: true,
    configured: true,
    email: record.accountEmail || undefined,
    expiresAt: record.expiresAt,
    connectedBy: record.connectedBy || undefined,
  };
}

/**
 * Disconnect Microsoft email (remove stored tokens)
 */
export async function disconnectMicrosoft(): Promise<void> {
  await prisma.oAuthToken.delete({
    where: { id: OAUTH_TOKEN_ID },
  }).catch(() => {
    // Already deleted, ignore
  });

  // Clear MSAL cache
  msalClient = null;

  console.log('📧 [Microsoft OAuth] Disconnected — tokens removed from DB');
}
