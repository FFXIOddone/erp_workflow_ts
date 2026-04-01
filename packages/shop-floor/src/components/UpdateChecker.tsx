/**
 * UpdateChecker — checks the ERP server for app updates on launch
 * and periodically, then uses the Tauri updater plugin to download
 * and install them. Falls back to a manual download link if needed.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Download, X, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { useConfigStore } from '../stores/config';
import { isTauri } from '../lib/tauri-bridge';
import toast from 'react-hot-toast';

interface UpdateInfo {
  version: string;
  notes: string;
  pub_date: string;
  downloadUrl?: string;
}

type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'installing' | 'error' | 'up-to-date';

// Check every 30 minutes
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

export function UpdateChecker() {
  const { config } = useConfigStore();
  const [state, setState] = useState<UpdateState>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState('');
  const currentVersion = useRef('');
  const stateRef = useRef<UpdateState>('idle');
  const checkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Get current app version
  useEffect(() => {
    if (isTauri()) {
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke<string>('get_app_version')
          .then((v) => {
            if (v) currentVersion.current = v;
          })
          .catch(() => {});
      });
    }
  }, []);

  const checkForUpdate = useCallback(async () => {
    if (!isTauri()) return;
    if (stateRef.current === 'downloading' || stateRef.current === 'installing') return;

    setState('checking');
    setError('');

    try {
      // Step 1: Check our server API for update status (uses the user's configured API URL)
      const apiUrl = config.apiUrl.replace(/\/+$/, '');
      // apiUrl looks like "http://host:8001/api/v1"
      const statusUrl = `${apiUrl}/updates/status`;

      const resp = await fetch(statusUrl, { signal: AbortSignal.timeout(10000) });
      if (!resp.ok) {
        setState('idle');
        return;
      }

      const data = await resp.json();

      if (!data.hasUpdate) {
        setState('up-to-date');
        setTimeout(() => setState('idle'), 3000);
        return;
      }

      // Compare versions
      const serverVersion = data.version;
      const myVersion = currentVersion.current;

      if (!myVersion || !isNewerVersion(serverVersion, myVersion)) {
        setState('up-to-date');
        setTimeout(() => setState('idle'), 3000);
        return;
      }

      // We have an update available
      setUpdateInfo({
        version: serverVersion,
        notes: data.notes || `Update to v${serverVersion}`,
        pub_date: data.pub_date || new Date().toISOString(),
        downloadUrl: `${apiUrl}/updates/download/shop-floor-${serverVersion}-x64-setup.exe`,
      });
      setState('available');
      setDismissed(false);
    } catch (err: any) {
      console.warn('[UpdateChecker] Check failed:', err.message);
      setState('idle');
    }
  }, [config.apiUrl]);

  // Check on mount and periodically
  useEffect(() => {
    // Initial check after a short delay (let app settle)
    const initialTimer = setTimeout(() => {
      checkForUpdate();
    }, 5000);

    // Periodic checks
    checkTimerRef.current = setInterval(() => {
      checkForUpdate();
    }, CHECK_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimer);
      if (checkTimerRef.current) clearInterval(checkTimerRef.current);
    };
  }, [checkForUpdate]);

  const doUpdate = useCallback(async () => {
    if (!updateInfo) return;

    setState('downloading');
    setProgress(0);

    try {
      // Try the Tauri updater plugin first (uses compiled endpoint from tauri.conf.json)
      const { check } = await import('@tauri-apps/plugin-updater');
      const { relaunch } = await import('@tauri-apps/plugin-process');

      const update = await check();

      if (update) {
        let downloaded = 0;
        let contentLength = 0;

        await update.downloadAndInstall((event) => {
          switch (event.event) {
            case 'Started':
              contentLength = (event.data as any).contentLength || 0;
              setState('downloading');
              break;
            case 'Progress':
              downloaded += (event.data as any).chunkLength || 0;
              if (contentLength > 0) {
                setProgress(Math.round((downloaded / contentLength) * 100));
              }
              break;
            case 'Finished':
              setState('installing');
              break;
          }
        });

        toast.success('Update installed! Restarting...');
        await relaunch();
        return;
      }
    } catch (err: any) {
      console.warn('[UpdateChecker] Tauri updater failed, falling back to manual download:', err.message);
    }

    // Fallback: open the download URL in the system browser
    try {
      if (updateInfo.downloadUrl) {
        const { open } = await import('@tauri-apps/plugin-shell');
        await open(updateInfo.downloadUrl);
        toast.success('Download started — run the installer when complete to update.');
        setState('idle');
        setDismissed(true);
      }
    } catch (err: any) {
      setError(`Update failed: ${err.message}`);
      setState('error');
    }
  }, [updateInfo]);

  // Don't render in browser mode
  if (!isTauri()) return null;

  // Nothing to show
  if (dismissed || (state !== 'available' && state !== 'downloading' && state !== 'installing' && state !== 'error')) {
    return null;
  }

  return (
    <div className="bg-indigo-600 text-white px-4 py-2 flex items-center gap-3 text-sm shadow-sm">
      {state === 'available' && (
        <>
          <Download className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">
            <strong>Update available:</strong> v{updateInfo?.version}
            {updateInfo?.notes && updateInfo.notes !== `Update to v${updateInfo.version}` && (
              <span className="opacity-80 ml-2">— {updateInfo.notes}</span>
            )}
          </span>
          <button
            onClick={doUpdate}
            className="px-3 py-1 bg-white text-indigo-700 rounded font-medium hover:bg-indigo-50 transition-colors"
          >
            Update Now
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </>
      )}

      {state === 'downloading' && (
        <>
          <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" />
          <span className="flex-1">
            Downloading update v{updateInfo?.version}...
            {progress > 0 && <span className="ml-2 font-mono">{progress}%</span>}
          </span>
          <div className="w-32 h-2 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </>
      )}

      {state === 'installing' && (
        <>
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>Installing update... app will restart shortly.</span>
        </>
      )}

      {state === 'error' && (
        <>
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={() => checkForUpdate()}
            className="px-3 py-1 bg-white/20 rounded hover:bg-white/30 transition-colors"
          >
            Retry
          </button>
          <button
            onClick={() => { setState('idle'); setDismissed(true); }}
            className="p-1 hover:bg-white/20 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}

/** Simple semver comparison: returns true if newVer > oldVer */
function isNewerVersion(newVer: string, oldVer: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
  const [nMaj, nMin, nPat] = parse(newVer);
  const [oMaj, oMin, oPat] = parse(oldVer);
  if (nMaj !== oMaj) return nMaj > oMaj;
  if (nMin !== oMin) return nMin > oMin;
  return nPat > oPat;
}
