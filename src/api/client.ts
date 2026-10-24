import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse, AuthResponse } from '../models';

// Dev: Vite proxies /api to the gateway. Prod: nginx does the same.
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || '/api';

const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';

export const tokens = {
  get access() { return localStorage.getItem(ACCESS_KEY); },
  get refresh() { return localStorage.getItem(REFRESH_KEY); },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

const client = axios.create({
  baseURL: API_BASE_URL,
  // Axios has no timeout by default; a stuck request would hang the UI forever.
  // Long calls (AI evaluation, AI synonyms) override this per request.
  timeout: 15000,
});

client.interceptors.request.use(config => {
  const token = tokens.access;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Fired when the session is gone for good, so AuthContext can drop to the login screen.
type SessionListener = () => void;
const sessionListeners = new Set<SessionListener>();
export const onSessionExpired = (fn: SessionListener) => {
  sessionListeners.add(fn);
  return () => { sessionListeners.delete(fn); };
};

// Requests that 401 while a refresh is already in flight wait here, so
// /auth/refresh is called once instead of once per parallel request.
let refreshing: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = tokens.refresh;
  if (!refreshToken) throw new Error('No refresh token');
  const res = await axios.post<ApiResponse<AuthResponse>>(`${API_BASE_URL}/auth/refresh`, { refreshToken });
  const { accessToken, refreshToken: next } = res.data.data;
  tokens.set(accessToken, next);
  return accessToken;
}

client.interceptors.response.use(
  // Every MSS service wraps responses; callers get the envelope body directly.
  response => response.data,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = error.response?.status;
    const isAuthCall = (original?.url || '').includes('/auth/');

    if (status !== 401 || !original || isAuthCall || original._retry) {
      return Promise.reject(error);
    }

    // Only a real session can expire. A 401 from a public page while logged out
    // must not bounce the user anywhere.
    if (!tokens.refresh) {
      if (tokens.access) {
        tokens.clear();
        sessionListeners.forEach(fn => fn());
      }
      return Promise.reject(error);
    }

    original._retry = true;
    try {
      refreshing ??= refreshAccessToken().finally(() => { refreshing = null; });
      const fresh = await refreshing;
      original.headers.Authorization = `Bearer ${fresh}`;
      return client(original);
    } catch (refreshError) {
      tokens.clear();
      sessionListeners.forEach(fn => fn());
      return Promise.reject(refreshError);
    }
  },
);

// The response interceptor unwraps axios' `data`, so these helpers type the result as the body.
export const http = {
  get: <T>(url: string, config?: object) => client.get<T, T>(url, config),
  post: <T>(url: string, body?: unknown, config?: object) => client.post<T, T>(url, body, config),
  put: <T>(url: string, body?: unknown, config?: object) => client.put<T, T>(url, body, config),
  patch: <T>(url: string, body?: unknown, config?: object) => client.patch<T, T>(url, body, config),
  delete: <T>(url: string, config?: object) => client.delete<T, T>(url, config),
};

export function formData(fields: Record<string, string | Blob | undefined>): FormData {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => { if (v !== undefined) fd.append(k, v); });
  return fd;
}
