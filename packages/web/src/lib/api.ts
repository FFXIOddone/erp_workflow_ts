import axios, { AxiosRequestConfig } from 'axios';
import { 
  type ApiSuccessResponse, 
  type ApiErrorResponse,
  type PaginatedResponse 
} from '@erp/shared';
import { getApiBaseUrl } from './runtime-url';

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Guard against multiple 401 redirects firing simultaneously
let isRedirectingToLogin = false;

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isRedirectingToLogin) {
      isRedirectingToLogin = true;
      console.warn(
        '%c[AUTH] 401 Unauthorized — token is invalid/expired. Redirecting to /login...',
        'color: red; font-weight: bold; font-size: 14px;'
      );
      console.warn('[AUTH] Clearing stored auth state and forcing full page reload');

      // Clear persisted auth from localStorage
      localStorage.removeItem('erp-auth');

      // Remove auth header to stop further requests from sending stale token
      delete api.defaults.headers.common['Authorization'];

      // Force full page reload to /login — this resets ALL in-memory state
      window.location.replace('/login');

      // Return a never-resolving promise to prevent TanStack Query / React
      // from processing this error and rendering error state before the
      // browser finishes navigating away
      return new Promise(() => {});
    }

    // For non-401 errors, log them visibly and reject normally
    if (error.response) {
      console.error(
        `[API] ${error.response.status} ${error.config?.method?.toUpperCase()} ${error.config?.url}:`,
        error.response.data?.error || error.response.data?.message || error.response.statusText
      );
    } else if (error.request) {
      console.error('[API] No response received (network error or server down):', error.config?.url);
    }

    return Promise.reject(error);
  }
);

// ============ Type-Safe API Helpers ============

/**
 * Type-safe GET request
 * @example
 * const orders = await apiGet<WorkOrder[]>('/orders');
 */
export async function apiGet<T>(
  url: string, 
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await api.get<ApiSuccessResponse<T>>(url, config);
  return response.data.data;
}

/**
 * Type-safe GET with pagination
 * @example
 * const result = await apiGetPaginated<WorkOrder>('/orders', { page: 1, pageSize: 20 });
 */
export async function apiGetPaginated<T>(
  url: string,
  params?: { page?: number; pageSize?: number; [key: string]: unknown }
): Promise<PaginatedResponse<T>> {
  const response = await api.get<ApiSuccessResponse<PaginatedResponse<T>>>(url, { params });
  return response.data.data;
}

/**
 * Type-safe POST request
 * @example
 * const newOrder = await apiPost<WorkOrder, CreateOrderInput>('/orders', orderData);
 */
export async function apiPost<TResponse, TRequest = unknown>(
  url: string,
  data?: TRequest,
  config?: AxiosRequestConfig
): Promise<TResponse> {
  const response = await api.post<ApiSuccessResponse<TResponse>>(url, data, config);
  return response.data.data;
}

/**
 * Type-safe PUT request
 * @example
 * const updated = await apiPut<WorkOrder, UpdateOrderInput>('/orders/123', updateData);
 */
export async function apiPut<TResponse, TRequest = unknown>(
  url: string,
  data?: TRequest,
  config?: AxiosRequestConfig
): Promise<TResponse> {
  const response = await api.put<ApiSuccessResponse<TResponse>>(url, data, config);
  return response.data.data;
}

/**
 * Type-safe PATCH request
 * @example
 * const patched = await apiPatch<WorkOrder, Partial<UpdateOrderInput>>('/orders/123', patchData);
 */
export async function apiPatch<TResponse, TRequest = unknown>(
  url: string,
  data?: TRequest,
  config?: AxiosRequestConfig
): Promise<TResponse> {
  const response = await api.patch<ApiSuccessResponse<TResponse>>(url, data, config);
  return response.data.data;
}

/**
 * Type-safe DELETE request
 * @example
 * await apiDelete('/orders/123');
 */
export async function apiDelete<TResponse = void>(
  url: string,
  config?: AxiosRequestConfig
): Promise<TResponse> {
  const response = await api.delete<ApiSuccessResponse<TResponse>>(url, config);
  return response.data.data;
}

/**
 * Extract error message from API error response
 */
export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorResponse | undefined;
    return data?.error ?? data?.message ?? error.message ?? 'An unexpected error occurred';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}
