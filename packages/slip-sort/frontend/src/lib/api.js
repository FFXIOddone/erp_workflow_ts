/**
 * Centralized API client for the Packing Slip Manager frontend.
 * Wraps fetch() with consistent error handling, base URL configuration,
 * and response validation.
 */

const API_BASE = /** @type {any} */ (import.meta).env.VITE_API_URL || 'http://localhost:8000';

/**
 * Custom error class for API errors.
 */
export class ApiError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   * @param {any} [detail]
   */
  constructor(status, message, detail) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

/**
 * Make an API request with consistent error handling.
 * 
 * @param {string} path - API path (e.g., '/api/brands')
 * @param {RequestInit} [options] - Fetch options
 * @returns {Promise<any>} Parsed JSON response
 * @throws {ApiError} When the response is not ok
 * 
 * @example
 * // GET request
 * const brands = await apiFetch('/api/brands');
 * 
 * @example
 * // POST request
 * const result = await apiFetch('/api/brands', {
 *   method: 'POST',
 *   body: JSON.stringify({ name: 'Test' })
 * });
 */
export async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  
  /** @type {Record<string, string>} */
  const defaultHeaders = options.body instanceof FormData
    ? {}
    : { 'Content-Type': 'application/json' };

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  let response;
  try {
    response = await fetch(url, config);
  } catch (err) {
    throw new ApiError(0, `Network error: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!response.ok) {
    let detail;
    try {
      const errorBody = await response.json();
      detail = errorBody.detail || errorBody.message || errorBody;
    } catch {
      detail = await response.text().catch(() => 'Unknown error');
    }
    
    const message = typeof detail === 'string' ? detail : `Request failed with status ${response.status}`;
    throw new ApiError(response.status, message, detail);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

/**
 * Upload a file via multipart form data.
 * 
 * @param {string} path - API path
 * @param {File} file - File to upload
 * @param {string} [fieldName='file'] - Form field name
 * @param {Record<string, string>} [extraFields] - Additional form fields
 * @returns {Promise<any>} Parsed JSON response
 */
export async function apiUpload(path, file, fieldName = 'file', extraFields = {}) {
  const formData = new FormData();
  formData.append(fieldName, file);
  
  for (const [key, value] of Object.entries(extraFields)) {
    formData.append(key, value);
  }
  
  return apiFetch(path, {
    method: 'POST',
    body: formData,
  });
}

/**
 * Convenience methods for common HTTP methods.
 */
export const api = {
  /** @param {string} path @param {Record<string, any>} [params] */
  get: (path, params) => {
    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      }
      const qs = searchParams.toString();
      if (qs) path = `${path}?${qs}`;
    }
    return apiFetch(path);
  },
  
  /** @param {string} path @param {any} body */
  post: (path, body) => apiFetch(path, { method: 'POST', body: JSON.stringify(body) }),
  
  /** @param {string} path @param {any} body */
  put: (path, body) => apiFetch(path, { method: 'PUT', body: JSON.stringify(body) }),
  
  /** @param {string} path @param {any} [body] */
  patch: (path, body) => apiFetch(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  
  /** @param {string} path */
  delete: (path) => apiFetch(path, { method: 'DELETE' }),
  
  /** @param {string} path @param {File} file @param {string} [fieldName] */
  upload: (path, file, fieldName) => apiUpload(path, file, fieldName),
};

export default api;
