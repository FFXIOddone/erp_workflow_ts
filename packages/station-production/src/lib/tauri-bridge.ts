// Browser-safe wrapper for Tauri invoke
function isTauri(): boolean {
  return !!(window as any).__TAURI_INTERNALS__;
}

export async function invoke(cmd: string, args?: Record<string, unknown>): Promise<any> {
  if (isTauri()) {
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
    return tauriInvoke(cmd, args);
  }
  console.warn(`[Browser Mode] Tauri command "${cmd}" not available`);
  return null;
}
