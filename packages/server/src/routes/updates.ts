/**
 * Tauri Updater Endpoint
 *
 * Serves update manifests for the Shop Floor desktop app.
 * The Tauri updater plugin calls:
 *   GET /api/v1/updates/:target/:arch/:current_version
 *
 * Responds with a JSON manifest when an update is available,
 * or 204 No Content when the client is already up to date.
 *
 * Update bundles are stored in uploads/updates/ on the server.
 */

import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth.js';
import { UserRole } from '@erp/shared';

const router = Router();

// Where update artifacts live on the server (match UPLOAD_DIR pattern used elsewhere)
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const UPDATES_DIR = path.join(UPLOAD_DIR, 'updates');

interface UpdateManifest {
  version: string;
  notes: string;
  pub_date: string;
  platforms: Record<
    string,
    {
      signature: string;
      url: string;
    }
  >;
}

/**
 * GET /updates/status
 *
 * Returns info on the currently published update (if any).
 */
router.get('/status', async (_req: Request, res: Response) => {
  const manifestPath = path.join(UPDATES_DIR, 'latest.json');

  if (!fs.existsSync(manifestPath)) {
    return res.json({ hasUpdate: false });
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return res.json({
      hasUpdate: true,
      version: manifest.version,
      notes: manifest.notes,
      pub_date: manifest.pub_date,
      platforms: Object.keys(manifest.platforms),
    });
  } catch {
    return res.json({ hasUpdate: false });
  }
});

/**
 * Serve update bundles (MSI, NSIS exe, sig files)
 * GET /updates/download/:filename
 */
router.get('/download/:filename', async (req: Request, res: Response) => {
  const { filename } = req.params;
  const filePath = path.join(UPDATES_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  return res.download(filePath);
});

/**
 * POST /updates/publish
 *
 * Upload a new update manifest. Called from the build machine after
 * running `tauri build` with signing enabled.
 *
 * Body: { version, notes, platforms: { "windows-x86_64": { signature, url } } }
 */
router.post('/publish', authenticate, requireRole(UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const { version, notes, platforms } = req.body;

    if (!version || !platforms) {
      return res.status(400).json({ error: 'version and platforms required' });
    }

    // Ensure updates directory exists
    if (!fs.existsSync(UPDATES_DIR)) {
      fs.mkdirSync(UPDATES_DIR, { recursive: true });
    }

    const manifest: UpdateManifest = {
      version,
      notes: notes || `Update to v${version}`,
      pub_date: new Date().toISOString(),
      platforms,
    };

    // Write latest.json
    fs.writeFileSync(
      path.join(UPDATES_DIR, 'latest.json'),
      JSON.stringify(manifest, null, 2),
    );

    // Also archive by version
    fs.writeFileSync(
      path.join(UPDATES_DIR, `${version}.json`),
      JSON.stringify(manifest, null, 2),
    );

    console.log(`[Updates] Published update v${version}`);
    return res.json({ success: true, version });
  } catch (err: any) {
    console.error('[Updates] Publish error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /updates/:target/:current_version
 *
 * target  = "windows-x86_64" | "darwin-x86_64" | "darwin-aarch64" | "linux-x86_64"
 * current_version = semver like "1.0.0"
 *
 * Tauri v2's {{target}} template already includes the arch (e.g. "windows-x86_64"),
 * so we only need target + current_version.
 *
 * Returns 204 if up to date, otherwise returns JSON manifest.
 * NOTE: This wildcard route MUST be defined last to avoid catching /status, /download, /publish.
 */
router.get('/:target/:current_version', async (req: Request, res: Response) => {
  const { target, current_version } = req.params;

  try {
    // Read the latest update manifest
    const manifestPath = path.join(UPDATES_DIR, 'latest.json');

    if (!fs.existsSync(manifestPath)) {
      // No updates published yet
      return res.status(204).send();
    }

    const manifest: UpdateManifest = JSON.parse(
      fs.readFileSync(manifestPath, 'utf8'),
    );

    // Compare versions — simple semver comparison
    if (!isNewerVersion(manifest.version, current_version)) {
      return res.status(204).send();
    }

    // target already includes arch (e.g. "windows-x86_64")
    const platformKey = target;

    // Check if we have a bundle for this platform
    const platformData = manifest.platforms[platformKey];
    if (!platformData) {
      return res.status(204).send();
    }

    // Return the update manifest in Tauri's expected format
    return res.json({
      version: manifest.version,
      notes: manifest.notes,
      pub_date: manifest.pub_date,
      platforms: {
        [platformKey]: platformData,
      },
    });
  } catch (err) {
    console.error('[Updates] Error serving update manifest:', err);
    return res.status(204).send();
  }
});

// ── Helpers ──────────────────────────────────────────────────

/**
 * Returns true if `newVer` is greater than `oldVer`.
 * Simple semver comparison (major.minor.patch).
 */
function isNewerVersion(newVer: string, oldVer: string): boolean {
  const parseV = (v: string) =>
    v
      .replace(/^v/, '')
      .split('.')
      .map(Number);
  const [nMaj, nMin, nPat] = parseV(newVer);
  const [oMaj, oMin, oPat] = parseV(oldVer);
  if (nMaj !== oMaj) return nMaj > oMaj;
  if (nMin !== oMin) return nMin > oMin;
  return nPat > oPat;
}

export default router;
