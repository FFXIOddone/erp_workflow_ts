import { access } from 'node:fs/promises';
import { withTimeout } from '../lib/with-timeout.js';

const DEFAULT_REACHABILITY_TIMEOUT_MS = 3000;

export async function probeRemotePathAccessible(
  path: string,
  label: string,
  timeoutMs: number = DEFAULT_REACHABILITY_TIMEOUT_MS,
): Promise<boolean> {
  try {
    await withTimeout(access(path), timeoutMs, label);
    return true;
  } catch {
    return false;
  }
}
