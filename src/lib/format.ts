// The modifier shown in keyboard hints: ⌘ on Apple devices, Ctrl elsewhere.
export const modKey = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';

export const fmtLongDate = (d: Date) =>
  d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

export const dayPart = () => {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
};

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const s = Math.max(0, (Date.now() - then) / 1000);
  if (s < 60) return 'just now';
  const m = s / 60, h = m / 60, d = h / 24;
  if (m < 60) return `${Math.floor(m)} min ago`;
  if (h < 24) return `${Math.floor(h)} h ago`;
  if (d < 2) return 'yesterday';
  if (d < 7) return `${Math.floor(d)} days ago`;
  if (d < 14) return '1 week ago';
  if (d < 60) return `${Math.floor(d / 7)} weeks ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const isToday = (iso: string | null | undefined) =>
  !!iso && new Date(iso).toDateString() === new Date().toDateString();

export const initials = (name: string | null | undefined) =>
  (name || '?').trim().split(/\s+/).map(w => w[0]).slice(-2).join('').toUpperCase();

export const firstName = (name: string | null | undefined) => {
  const parts = (name || '').trim().split(/\s+/);
  // Vietnamese names put the given name last.
  return parts[parts.length - 1] || 'there';
};

export const excerpt = (s: string, n = 160) => {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > n ? `${flat.slice(0, n).trimEnd()}…` : flat;
};

// A post's text: lists carry a 200-char `excerpt`, the detail view the full `content`.
export const postBody = (p: { content?: string; excerpt?: string }) => p.content ?? p.excerpt ?? '';

type Person = { displayName?: string | null; fullName?: string | null; username?: string | null } | null | undefined;
export const nameOf = (u: Person, fallback = 'Someone') =>
  u?.displayName || u?.fullName || u?.username || fallback;

const NOTIFICATION_TEXT: Record<string, string> = {
  LIKE: 'liked your post',
  COMMENT: 'commented on your post',
  REPLY: 'replied to your comment',
  SHARE: 'shared a post with you',
  FOLLOW: 'started following you',
  MENTION: 'mentioned you',
};
export const notificationText = (type: string) => NOTIFICATION_TEXT[type] || 'sent you a notification';

// Labels for the backend's weekActivity (7 entries, oldest first, last = today).
export const lastSevenDays = () =>
  Array.from({ length: 7 }, (_, i) => new Date(Date.now() - (6 - i) * 864e5)
    .toLocaleDateString('en-GB', { weekday: 'short' }));
