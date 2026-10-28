// The modifier shown in keyboard hints: ⌘ on Apple devices, Ctrl elsewhere.
export const modKey = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';

export const fmtLongDate = (d: Date) =>
  d.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' });

export const dayPart = () => {
  const h = new Date().getHours();
  return h < 11 ? 'sáng' : h < 13 ? 'trưa' : h < 18 ? 'chiều' : 'tối';
};

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const s = Math.max(0, (Date.now() - then) / 1000);
  if (s < 60) return 'vừa xong';
  const m = s / 60, h = m / 60, d = h / 24;
  if (m < 60) return `${Math.floor(m)} phút trước`;
  if (h < 24) return `${Math.floor(h)} giờ trước`;
  if (d < 2) return 'hôm qua';
  if (d < 7) return `${Math.floor(d)} ngày trước`;
  if (d < 60) return `${Math.floor(d / 7)} tuần trước`;
  return new Date(iso).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

export const isToday = (iso: string | null | undefined) =>
  !!iso && new Date(iso).toDateString() === new Date().toDateString();

export const initials = (name: string | null | undefined) =>
  (name || '?').trim().split(/\s+/).map(w => w[0]).slice(-2).join('').toUpperCase();

export const firstName = (name: string | null | undefined) => {
  const parts = (name || '').trim().split(/\s+/);
  // Vietnamese names put the given name last.
  return parts[parts.length - 1] || 'bạn';
};

export const excerpt = (s: string, n = 160) => {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > n ? `${flat.slice(0, n).trimEnd()}…` : flat;
};

// A post's text: lists carry a 200-char `excerpt`, the detail view the full `content`.
export const postBody = (p: { content?: string; excerpt?: string }) => p.content ?? p.excerpt ?? '';

type Person = { displayName?: string | null; fullName?: string | null; username?: string | null } | null | undefined;
export const nameOf = (u: Person, fallback = 'Ai đó') =>
  u?.displayName || u?.fullName || u?.username || fallback;

const NOTIFICATION_TEXT: Record<string, string> = {
  LIKE: 'đã thích bài viết của bạn',
  COMMENT: 'đã bình luận bài viết của bạn',
  REPLY: 'đã trả lời bình luận của bạn',
  SHARE: 'đã chia sẻ một bài viết với bạn',
  FOLLOW: 'đã bắt đầu theo dõi bạn',
  MENTION: 'đã nhắc đến bạn',
};
export const notificationText = (type: string) => NOTIFICATION_TEXT[type] || 'đã gửi cho bạn một thông báo';

// Labels for the backend's weekActivity (7 entries, oldest first, last = today).
const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
export const lastSevenDays = () =>
  Array.from({ length: 7 }, (_, i) => WEEKDAYS[new Date(Date.now() - (6 - i) * 864e5).getDay()]);
