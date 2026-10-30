import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Hand, SignPlayer } from './Hand';
import Icon, { type IconName } from './Icon';
import type { Sign, SignStatus } from '../lib/signs';
import { initials } from '../lib/format';

export interface ThemeOption {
  id: 'jade' | 'slate' | 'rose' | 'plum' | 'lacquer';
  name: string;
  sub: string;
  primary: string;
  secondary: string;
}

export const THEMES: ThemeOption[] = [
  { id: 'jade', name: 'Ngọc bích', sub: 'Xanh Ngọc Bích & Hổ Phách dịu mắt', primary: '#0F6E56', secondary: '#B86B11' },
  { id: 'slate', name: 'Lam cổ điển', sub: 'Xanh Chàm Đá & Ngọc Biển trầm', primary: '#2B4C7E', secondary: '#0E7470' },
  { id: 'rose', name: 'Hồng trà', sub: 'Đỏ Hồng Trà & Xanh Rêu tự nhiên', primary: '#B5385A', secondary: '#1E6B52' },
  { id: 'plum', name: 'Tím khói', sub: 'Tím Mận Trầm & Xanh Trà thanh lịch', primary: '#563D82', secondary: '#0F6E5E' },
  { id: 'lacquer', name: 'Sơn mài', sub: 'Đỏ Sơn Mài & Giấy Dó truyền thống', primary: '#C8431F', secondary: '#0F6E5E' },
];

const THEME_KEY = 'sm_theme';

function readSavedTheme(): ThemeOption['id'] {
  if (typeof window === 'undefined') return 'jade';
  let saved: string | null = null;
  try {
    saved = window.localStorage.getItem(THEME_KEY);
  } catch {
    // localStorage bị chặn (chế độ riêng tư / chặn cookie) → dùng bảng màu mặc định.
  }
  if (saved && THEMES.some(t => t.id === saved)) return saved as ThemeOption['id'];
  return 'jade';
}

export function applyTheme(id: ThemeOption['id']) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = id;
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(THEME_KEY, id);
    } catch {
      // Không lưu được thì chỉ đổi màu cho phiên hiện tại.
    }
    window.dispatchEvent(new CustomEvent('sm-theme-change', { detail: id }));
  }
}

export function ThemePicker() {
  const [theme, setTheme] = useState<ThemeOption['id']>(() => readSavedTheme());
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const onSync = (e: Event) => {
      const next = (e as CustomEvent<ThemeOption['id']>).detail;
      if (next) setTheme(next);
    };
    window.addEventListener('sm-theme-change', onSync);
    return () => window.removeEventListener('sm-theme-change', onSync);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = THEMES.find(t => t.id === theme) ?? THEMES[0];

  return (
    <div className="theme-picker" ref={wrapRef}>
      <button
        type="button"
        className="theme-btn"
        onClick={() => setOpen(o => !o)}
        aria-label="Đổi bảng màu giao diện"
        aria-expanded={open}
        title={`Giao diện: ${current.name}`}
      >
        <span
          className="theme-swatch"
          style={{ background: `linear-gradient(135deg, ${current.primary} 50%, ${current.secondary} 50%)` }}
          aria-hidden="true"
        />
        <span className="hide-sm">{current.name}</span>
      </button>
      {open && (
        <div className="theme-menu" role="menu" aria-label="Chọn bảng màu">
          <div className="theme-menu-head">Tông màu giao diện</div>
          {THEMES.map(t => {
            const active = t.id === theme;
            return (
              <button
                key={t.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                className={`theme-item ${active ? 'on' : ''}`}
                onClick={() => {
                  applyTheme(t.id);
                  setTheme(t.id);
                  setOpen(false);
                }}
              >
                <span
                  className="theme-swatch"
                  style={{ background: `linear-gradient(135deg, ${t.primary} 50%, ${t.secondary} 50%)` }}
                  aria-hidden="true"
                />
                <span className="theme-item-text">
                  <b>{t.name}</b>
                  <small>{t.sub}</small>
                </span>
                {active && <Icon name="check" size={15} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Brand({ to = '/' }: { to?: string }) {
  return (
    <Link className="brand" to={to} aria-label="Trang chủ SignMentor">
      <span className="brand-mark"><Hand frame={{ shape: 'open', rot: -16 }} size={19} /></span>
      <span>Sign<em>Mentor</em></span>
    </Link>
  );
}

/* The large demonstration of a sign: the tutorial video when the backend has one,
   then the still image, then the generative flipbook. */
export function SignMedia({ sign, size = 220, autoplay = true }: { sign: Sign; size?: number; autoplay?: boolean }) {
  if (sign.videoUrl) {
    return (
      <div className="media-frame has-video">
        <video key={sign.id} className="sign-video" src={sign.videoUrl} poster={sign.imageUrl || undefined}
          autoPlay={autoplay} muted loop playsInline controls />
      </div>
    );
  }
  if (sign.imageUrl) {
    return <div className="media-frame has-video"><img className="sign-img" src={sign.imageUrl} alt={`Ký hiệu “${sign.word}”`} /></div>;
  }
  return <div className="media-frame"><SignPlayer frames={sign.frames} size={size} autoplay={autoplay} /></div>;
}

/* Small thumbnail: still image if there is one, else a hand that plays on hover. */
export function SignThumb({ sign, size = 72 }: { sign: Sign; size?: number }) {
  if (sign.imageUrl) return <span className="thumb" style={{ width: size, height: size }}><img src={sign.imageUrl} alt="" /></span>;
  return <SignPlayer frames={sign.frames} size={size} hover chrome={false} />;
}

const STATUS: Record<SignStatus, [string, IconName]> = {
  learned: ['Đã thuộc', 'check'],
  learning: ['Đang học', 'refresh'],
  new: ['Mới', 'plus'],
};

export function StatusTag({ status }: { status: SignStatus }) {
  const [label, icon] = STATUS[status];
  return <span className={`status st-badge-${status}`}><Icon name={icon} size={13} /> {label}</span>;
}

export function EmptyState({ title, body, action }: { title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-art" aria-hidden="true">
        <Hand frame={{ shape: 'open', rot: -8, arc: 'wave' }} size={68} />
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

export function Loading({ label = 'Đang tải…' }: { label?: string }) {
  return (
    <div className="loading-block" role="status" aria-live="polite">
      <div className="loading-pill"><span className="spin" /> <span>{label}</span></div>
      <div className="skeleton-grid" aria-hidden="true">
        <div className="skel skel-hero" />
        <div className="skel-row">
          <div className="skel skel-card" />
          <div className="skel skel-card" />
        </div>
      </div>
    </div>
  );
}

export function Alert({ kind = 'err', children }: { kind?: 'err' | 'ok' | 'info'; children: ReactNode }) {
  const icon: IconName = kind === 'ok' ? 'check' : kind === 'info' ? 'info' : 'alert';
  return (
    <div className={`alert ${kind}`} role={kind === 'err' ? 'alert' : 'status'}>
      <span className="alert-icon"><Icon name={icon} size={18} /></span>
      <span className="alert-body">{children}</span>
    </div>
  );
}

export function Avatar({ name, url, size, className = 'avatar' }: { name?: string | null; url?: string | null; size?: number; className?: string }) {
  const style = size ? { width: size, height: size, fontSize: size * 0.34 } : undefined;
  return <span className={className} style={style} aria-hidden="true">{url ? <img src={url} alt="" /> : initials(name)}</span>;
}

export function Spinner() {
  return <span className="spin" aria-hidden="true" />;
}

export type BannerVariant =
  | 'auth'
  | 'today'
  | 'journey'
  | 'dictionary'
  | 'community'
  | 'request'
  | 'step-watch'
  | 'step-practice'
  | 'step-remember';

export function ArtBanner({
  variant,
  knownCount,
  dueCount,
}: {
  variant: BannerVariant;
  knownCount?: number;
  dueCount?: number;
}) {
  if (variant === 'auth') {
    return (
      <div className="photo-banner photo-banner-auth" aria-hidden="true">
        <div className="auth-photo-main">
          <img className="photo-banner-img" src="/banners/auth-banner.jpg" alt="" />
          <div className="photo-banner-scrim" />
          <div className="auth-photo-top">
            <span className="glass-pill"><Icon name="sparkles" size={12} /> AI Phòng tập trực tiếp</span>
            <span className="glass-pill dark"><Icon name="flame" size={12} /> Chuỗi 7 ngày</span>
          </div>
          <div className="auth-photo-bottom">
            <div>
              <small>Huấn luyện viên AI · Thời gian thực</small>
              <strong>Nhận diện 21 khớp bàn tay · Chính xác 96%</strong>
            </div>
          </div>
        </div>
        <div className="auth-photo-sub">
          <img className="auth-sub-thumb" src="/banners/challenge-banner.jpg" alt="" />
          <div>
            <b>Học qua thực hành camera</b>
            <small>Xem người ký mẫu · Làm theo 5 giây · Nhận góp ý ngay</small>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'today') {
    return (
      <div className="photo-banner photo-banner-today hide-sm" aria-hidden="true">
        <img className="photo-banner-img" src="/banners/today-banner.jpg" alt="" />
        <div className="photo-banner-scrim" />
        <div className="photo-banner-content">
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <span className="glass-pill"><Icon name="check" size={12} /> {knownCount ?? 0} đã thuộc</span>
            <span className="glass-pill warm"><Icon name="refresh" size={12} /> {dueCount ?? 0} cần ôn</span>
          </div>
          <div className="photo-banner-caption">
            <strong>Phòng tập Ngôn ngữ Ký hiệu</strong>
            <span>Luyện 5 phút mỗi ngày cùng camera AI để giữ phản xạ đôi tay</span>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'journey') {
    return (
      <div className="photo-banner photo-banner-page hide-sm" aria-hidden="true">
        <img className="photo-banner-img" src="/banners/journey-banner.jpg" alt="" />
        <div className="photo-banner-scrim" />
        <div className="photo-banner-content">
          <span className="glass-pill"><Icon name="compass" size={12} /> Lộ trình theo chủ đề</span>
          <div className="photo-banner-caption">
            <strong>Từ ký hiệu đơn lẻ đến hội thoại tự nhiên</strong>
            <span>Xem video mẫu · Tự kiểm tra · Chấm điểm AI trong Phòng tập</span>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'dictionary') {
    return (
      <div className="photo-banner photo-banner-page hide-sm" aria-hidden="true">
        <img className="photo-banner-img" src="/banners/dictionary-banner.jpg" alt="" />
        <div className="photo-banner-scrim" />
        <div className="photo-banner-content">
          <div className="row" style={{ gap: 8 }}>
            <span className="glass-pill"><Icon name="video" size={12} /> Video mẫu HD</span>
            <span className="glass-pill warm"><Icon name="sparkles" size={12} /> Tích hợp AI</span>
          </div>
          <div className="photo-banner-caption">
            <strong>Kho tư liệu Ngôn ngữ Ký hiệu Việt Nam</strong>
            <span>Tra cứu hình dạng tay, hướng chuyển động và ngữ cảnh sử dụng</span>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'community') {
    return (
      <div className="photo-banner photo-banner-page hide-sm" aria-hidden="true">
        <img className="photo-banner-img" src="/banners/community-banner.jpg" alt="" />
        <div className="photo-banner-scrim" />
        <div className="photo-banner-content">
          <span className="glass-pill"><Icon name="users" size={12} /> Cộng đồng SignMentor</span>
          <div className="photo-banner-caption">
            <strong>Cùng trò chuyện và chia sẻ cột mốc</strong>
            <span>Kết nối với người học đi trước và tìm hiểu văn hóa Điếc</span>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'request') {
    return (
      <div className="photo-banner photo-banner-page hide-sm" aria-hidden="true">
        <img className="photo-banner-img" src="/banners/request-banner.jpg" alt="" />
        <div className="photo-banner-scrim" />
        <div className="photo-banner-content">
          <span className="glass-pill"><Icon name="sparkles" size={12} /> Mở rộng từ điển VSL</span>
          <div className="photo-banner-caption">
            <strong>Đề xuất từ mới · Đội ngũ quay mẫu & huấn luyện AI</strong>
            <span>Mỗi đóng góp giúp kho ký hiệu Việt Nam hoàn thiện hơn</span>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'step-watch') {
    return (
      <div className="step-photo-banner" aria-hidden="true">
        <img className="photo-banner-img" src="/banners/step-watch.jpg" alt="" />
        <div className="photo-banner-scrim subtle" />
        <span className="glass-pill step-pill"><Icon name="play" size={11} /> Video người ký thật</span>
      </div>
    );
  }

  if (variant === 'step-practice') {
    return (
      <div className="step-photo-banner" aria-hidden="true">
        <img className="photo-banner-img" src="/banners/challenge-banner.jpg" alt="" />
        <div className="photo-banner-scrim subtle" />
        <span className="glass-pill step-pill warm"><Icon name="sparkles" size={11} /> AI chấm điểm 96%</span>
      </div>
    );
  }

  return (
    <div className="step-photo-banner" aria-hidden="true">
      <img className="photo-banner-img" src="/banners/step-remember.jpg" alt="" />
      <div className="photo-banner-scrim subtle" />
      <span className="glass-pill step-pill"><Icon name="flame" size={11} /> Ôn tập & giữ chuỗi</span>
    </div>
  );
}

