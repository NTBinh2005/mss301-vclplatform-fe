import { isAxiosError } from 'axios';

// Field validation messages (errors[].message) win over the general message,
// which wins over the caller's fallback.
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (!isAxiosError(err)) return err instanceof Error && err.message ? err.message : fallback;
  if (err.code === 'ECONNABORTED') return 'Máy chủ phản hồi quá lâu. Vui lòng thử lại.';
  if (!err.response) return 'Không kết nối được máy chủ. Hãy kiểm tra API gateway đã chạy chưa.';
  const data = err.response.data as { message?: string; errors?: { message?: string }[] } | undefined;
  const field = data?.errors?.[0]?.message;
  if (field?.trim()) return field;
  // Bean-validation messages arrive as "field: message"; the field name means nothing to the learner.
  if (data?.message?.trim()) return data.message.replace(/(^|;\s*)[a-zA-Z.]+: /g, '$1');
  return fallback;
}

export function apiErrorCode(err: unknown): string | undefined {
  if (!isAxiosError(err)) return undefined;
  const data = err.response?.data as { code?: string; error?: string } | undefined;
  return data?.code || data?.error;
}

export const isNotFoundOrUnavailable = (err: unknown) =>
  isAxiosError(err) && (!err.response || [404, 502, 503, 504].includes(err.response.status));
