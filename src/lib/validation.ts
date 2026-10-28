// Mirrors the backend @Valid constraints (RegisterRequest etc.).
// Each function returns an error message, or '' when the value is valid.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_HINT = 'Từ 6 đến 100 ký tự.';

export const required = (v: string, label: string) => (v.trim() ? '' : `${label} không được để trống.`);

export function text(v: string, label: string, max?: number) {
  if (!v.trim()) return `${label} không được để trống.`;
  if (max != null && v.length > max) return `${label} tối đa ${max} ký tự.`;
  return '';
}

export function email(v: string) {
  const t = v.trim();
  if (!t) return 'Email không được để trống.';
  if (v.length > 100) return 'Email tối đa 100 ký tự.';
  if (!EMAIL_RE.test(t)) return 'Email không đúng định dạng.';
  return '';
}

export function username(v: string) {
  const t = v.trim();
  if (!t) return 'Tên đăng nhập không được để trống.';
  if (t.length < 3 || t.length > 50) return 'Tên đăng nhập phải từ 3 đến 50 ký tự.';
  return '';
}

export function fullName(v: string) {
  if (!v.trim()) return 'Họ và tên không được để trống.';
  if (v.length > 100) return 'Họ và tên tối đa 100 ký tự.';
  return '';
}

export function password(v: string) {
  if (!v) return 'Mật khẩu không được để trống.';
  if (v.length < 6 || v.length > 100) return 'Mật khẩu phải từ 6 đến 100 ký tự.';
  return '';
}

export function nonNegativeInt(v: string, label: string) {
  const t = v.trim();
  if (!t) return `${label} không được để trống.`;
  if (!/^\d+$/.test(t)) return `${label} phải là số nguyên từ 0 trở lên.`;
  return '';
}

export const isValid = (errors: Record<string, string>) => Object.values(errors).every(e => !e);
