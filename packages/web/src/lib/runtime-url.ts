import { API_BASE_PATH } from '@erp/shared';

const ERP_SERVER_PORT = '8001';

function hasWindowLocation(): boolean {
  return typeof window !== 'undefined' && typeof window.location !== 'undefined';
}

function isProxyDevSession(location: Location): boolean {
  return Boolean(location.port) && location.port !== ERP_SERVER_PORT;
}

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function ensureWebSocketPath(rawUrl: string): string {
  return rawUrl.endsWith('/ws') ? rawUrl : `${trimTrailingSlash(rawUrl)}/ws`;
}

export function getApiBaseUrl(): string {
  if (!hasWindowLocation()) {
    const configuredApiUrl = import.meta.env.VITE_API_URL;
    return configuredApiUrl
      ? `${trimTrailingSlash(configuredApiUrl)}${API_BASE_PATH}`
      : API_BASE_PATH;
  }

  const { location } = window;

  // When Vite serves the app on a dev port, keep API traffic same-origin so
  // the local proxy works for LAN devices too.
  if (isProxyDevSession(location)) {
    return API_BASE_PATH;
  }

  // In the browser, always call back to the same host that served the page.
  // This avoids stale localhost/IP build-time values breaking other machines.
  return `${location.origin}${API_BASE_PATH}`;
}

export function getWebSocketUrl(): string {
  const wsProtocol =
    hasWindowLocation() && window.location.protocol === 'https:' ? 'wss:' : 'ws:';

  if (!hasWindowLocation()) {
    return ensureWebSocketPath(
      import.meta.env.VITE_WS_URL ?? `${wsProtocol}//localhost:${ERP_SERVER_PORT}`
    );
  }

  const { location } = window;

  if (isProxyDevSession(location)) {
    return `${wsProtocol}//${location.hostname}:${ERP_SERVER_PORT}/ws`;
  }

  // Mirror the current browser host so WS upgrades work whether users open the
  // app through localhost, LAN IP, or machine name.
  return `${wsProtocol}//${location.host}/ws`;
}
