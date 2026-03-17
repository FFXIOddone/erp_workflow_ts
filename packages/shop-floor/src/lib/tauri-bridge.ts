// Browser-safe wrapper for Tauri invoke
// When running in browser (not Tauri), provides no-op fallbacks

function isTauri(): boolean {
  return !!(window as any).__TAURI_INTERNALS__;
}

export async function invoke<T = any>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T | null> {
  if (isTauri()) {
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
    return tauriInvoke<T>(cmd, args);
  }
  console.warn(`[Browser Mode] Tauri command "${cmd}" not available`);
  return null;
}

export { isTauri };
