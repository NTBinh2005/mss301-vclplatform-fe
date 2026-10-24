import type { ApiResponse } from '../models';

// The team contract wraps every response in ApiResponse. Services ported from the
// old monolith sometimes still return the raw DTO, so accept both shapes.
export async function unwrap<T>(p: Promise<ApiResponse<T> | T>): Promise<T> {
  const body = await p;
  if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
    return (body as ApiResponse<T>).data;
  }
  return body as T;
}

export const q = (params: Record<string, string | number | boolean | undefined | null>) => {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null) s.append(k, String(v)); });
  return s.toString();
};
