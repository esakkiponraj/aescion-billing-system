import { useAuthStore } from '../stores/authStore';
import { useTenantStore } from '../stores/tenantStore';
import { ApiResponse } from '@aescion/types';

export const getApiBaseUrl = (): string => {
  const envUrl = (import.meta as any).env?.VITE_API_URL || (import.meta as any).env?.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    let clean = envUrl.trim().replace(/\/+$/, '');
    if (!clean.endsWith('/api/v1')) {
      clean = `${clean}/api/v1`;
    }
    return clean;
  }
  return '/api/v1';
};

export class ApiError extends Error {
  statusCode: number;
  errors?: any;

  constructor(message: string, statusCode: number, errors?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const authStore = useAuthStore.getState();
  const tenantStore = useTenantStore.getState();

  const baseUrl = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  const url =
    baseUrl.endsWith('/api/v1') && cleanEndpoint.startsWith('/api/v1')
      ? `${baseUrl}${cleanEndpoint.slice(7)}`
      : `${baseUrl}${cleanEndpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authStore.tokens?.accessToken) {
    headers['Authorization'] = `Bearer ${authStore.tokens.accessToken}`;
  }

  if (tenantStore.activeOrgId) {
    headers['X-Organization-Id'] = tenantStore.activeOrgId;
  }

  if (tenantStore.activeOutletId) {
    headers['X-Outlet-Id'] = tenantStore.activeOutletId;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (netErr: any) {
    throw new ApiError('Unable to connect to the server. Please check your network connection.', 0);
  }

  if (response.status === 401 && authStore.tokens?.refreshToken && !endpoint.includes('/auth/')) {
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then(() => apiRequest<T>(endpoint, options));
    }

    isRefreshing = true;

    try {
      const refreshUrl =
        baseUrl.endsWith('/api/v1')
          ? `${baseUrl}/auth/refresh`
          : `${baseUrl}/api/v1/auth/refresh`;

      const refreshRes = await fetch(refreshUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: authStore.tokens.refreshToken }),
      });

      if (!refreshRes.ok) {
        throw new Error('Refresh token invalid');
      }

      const refreshData = await refreshRes.json();
      const updatedData = refreshData.data || refreshData;

      authStore.setAuth({
        user: updatedData.user,
        tokens: updatedData.tokens,
        organizations: updatedData.organizations,
      });

      processQueue(null, updatedData.tokens.accessToken);
      isRefreshing = false;

      // Retry original request with new token
      return apiRequest<T>(endpoint, options);
    } catch (refreshErr) {
      processQueue(refreshErr, null);
      isRefreshing = false;
      authStore.clearAuth();
      tenantStore.clearTenant();
      window.location.href = '/login';
      throw new ApiError('Session expired. Please sign in again.', 401);
    }
  }

  let data: any;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const rawText = await response.text();
    if (!response.ok) {
      throw new ApiError(
        `Server error (${response.status}): ${response.statusText || 'Unable to complete request'}`,
        response.status,
      );
    }
    throw new ApiError(
      'Unable to connect to the backend server. Received unexpected non-JSON response.',
      502,
    );
  }

  if (!response.ok) {
    const errorMsg =
      data?.message || (typeof data === 'string' ? data : 'Authentication failed. Please try again.');
    throw new ApiError(errorMsg, response.status, data?.errors);
  }

  // If response is ApiResponse format
  if (data && typeof data === 'object' && 'data' in data && 'success' in data) {
    return data.data as T;
  }

  return data as T;
}
