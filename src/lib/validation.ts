// Mirrors the backend @Valid constraints (RegisterRequest etc.).
// Each function returns an error message, or '' when the value is valid.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_HINT = '6–100 characters.';

export const required = (v: string, label: string) => (v.trim() ? '' : `${label} is required.`);

export function text(v: string, label: string, max?: number) {
  if (!v.trim()) return `${label} is required.`;
  if (max != null && v.length > max) return `${label} must be at most ${max} characters.`;
  return '';
}

export function email(v: string) {
  const t = v.trim();
  if (!t) return 'Email is required.';
  if (v.length > 100) return 'Email must be at most 100 characters.';
  if (!EMAIL_RE.test(t)) return 'That does not look like an email address.';
  return '';
}

export function username(v: string) {
  const t = v.trim();
  if (!t) return 'Username is required.';
  if (t.length < 3 || t.length > 50) return 'Username must be 3–50 characters.';
  return '';
}

export function fullName(v: string) {
  if (!v.trim()) return 'Full name is required.';
  if (v.length > 100) return 'Full name must be at most 100 characters.';
  return '';
}

export function password(v: string) {
  if (!v) return 'Password is required.';
  if (v.length < 6 || v.length > 100) return 'Password must be 6–100 characters.';
  return '';
}

export function nonNegativeInt(v: string, label: string) {
  const t = v.trim();
  if (!t) return `${label} is required.`;
  if (!/^\d+$/.test(t)) return `${label} must be a whole number of 0 or more.`;
  return '';
}

export const isValid = (errors: Record<string, string>) => Object.values(errors).every(e => !e);
