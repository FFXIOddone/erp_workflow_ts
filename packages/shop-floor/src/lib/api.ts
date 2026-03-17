/**
 * Lightweight API client for Shop Floor stations.
 * Uses the auth store token and config store URL.
 */

import { useAuthStore } from '../stores/auth';
import { useConfigStore } from '../stores/config';

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const { token } = useAuthStore.getState();
  const { config } = useConfigStore.getState();

  const url = `${config.apiUrl}${path}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    // Try JSON first, fall back to text for non-JSON responses (e.g. HTML error pages)
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || body.message || `API error ${res.status}`);
    }
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      `Server returned ${contentType || 'unknown content type'} instead of JSON. Check API URL in settings.`,
    );
  }

  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

export async function apiGet<T = any>(path: string): Promise<T> {
  return apiFetch<T>(path);
}

export async function apiPost<T = any>(
  path: string,
  body?: unknown,
): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function apiPut<T = any>(
  path: string,
  body?: unknown,
): Promise<T> {
  return apiFetch<T>(path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}
