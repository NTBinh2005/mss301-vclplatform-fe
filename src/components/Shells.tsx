import { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import Icon, { type IconName } from './Icon';
import MentorDrawer from './MentorDrawer';
import Palette from './Palette';
import { Avatar, Brand, Loading } from './common';
import { useAuth } from '../context/AuthContext';
import { LearningProvider, useLearning } from '../context/LearningContext';
import { LayerHost, useUI } from '../context/UIContext';
import { modKey } from '../lib/format';
import { adminApi, notificationApi } from '../services';

// Profile lives behind the avatar on wide screens, and as the last tab on narrow ones.
const ROUTES: [string, string, IconName][] = [
  ['/today', 'Hôm nay', 'home'],
  ['/learn', 'Lộ trình', 'book'],
  ['/dictionary', 'Từ điển', 'grid'],
  ['/studio', 'Phòng tập', 'video'],
  ['/community', 'Cộng đồng', 'users'],
];
const TABS: [string, string, IconName][] = [...ROUTES, ['/profile', 'Hồ sơ', 'user']];

function useScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);
}

/* ---------- guards ---------- */
export function RequireLearner() {
  const { status, isAdmin } = useAuth();
  const loc = useLocation();
  if (status === 'loading') return <div className="boot"><Loading label="Đang mở sổ tay của bạn…" /></div>;
  if (status === 'anon') return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  if (isAdmin) return <Navigate to="/admin" replace />;
  return <LearningProvider><LearnerShell /></LearningProvider>;
}

export function RequireAdmin() {
  const { status, isAdmin } = useAuth();
  if (status === 'loading') return <div className="boot"><Loading /></div>;
  if (status === 'anon') return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/today" replace />;
  return <AdminShell />;
}

export function GuestOnly() {
  const { status, isAdmin } = useAuth();
  if (status === 'loading') return <div className="boot"><Loading /></div>;
  if (status === 'authed') return <Navigate to={isAdmin ? '/admin' : '/today'} replace />;
  return <Outlet />;
}

/* ---------- learner ---------- */
function LearnerShell() {
  const { user } = useAuth();
  const { stats } = useLearning();
  const ui = useUI();
  const { pathname } = useLocation();
  const [unread, setUnread] = useState(0);
  useScrollTop();
  const streak = stats?.currentStreak ?? 0;

  useEffect(() => { notificationApi.unreadCount().then(setUnread).catch(() => {}); }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (ui.layer?.kind === 'palette') ui.closeLayer(); else ui.openPalette();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui]);

  return (
    <>
      <a className="skip" href="#app">Bỏ qua tới nội dung</a>
      <header className="topbar">
        <Brand to="/today" />
        <nav className="mainnav" aria-label="Điều hướng chính">
          {ROUTES.map(([to, label]) => (
            <NavLink key={to} to={to}>{label}{to === '/community' && unread > 0 && <span className="badge-dot" aria-label={`${unread} thông báo chưa đọc`}>{unread}</span>}</NavLink>
          ))}
        </nav>
        <div className="top-actions">
          <button className="mentor-btn" onClick={() => ui.openMentor()} aria-label="Hỏi Mentor, huấn luyện viên AI">
            <span className="mentor-dot" /><span>Mentor</span>
          </button>
          <button className="searchbtn" onClick={ui.openPalette} aria-label="Tìm kiếm và lệnh" title={`Tìm kiếm (${modKey}+K)`}>
            <Icon name="search" size={16} /><span>Tìm kiếm</span><span className="kbd">{modKey} K</span>
          </button>
          <Link className="streak-chip" to="/today" title={`Chuỗi ${streak} ngày`} aria-label={`Chuỗi ${streak} ngày`}>
            <Icon name="flame" size={18} /><span>{streak}</span>
          </Link>
          <Link className="avatar" to="/profile" aria-label="Hồ sơ của bạn" title={user?.fullName}><Avatar name={user?.fullName} url={user?.avatarUrl} className="" /></Link>
        </div>
      </header>
      <main id="app" tabIndex={-1}><Outlet /></main>
      <footer className="app-foot">
        <span>SignMentor — dành cho người học Ngôn ngữ Ký hiệu Việt Nam.</span>
        <span className="hide-sm">Nhấn <span className="kbd">{modKey} K</span> ở bất kỳ đâu để chuyển nhanh.</span>
      </footer>
      <nav className="tabbar" aria-label="Điều hướng chính (di động)" style={{ gridTemplateColumns: `repeat(${TABS.length},1fr)` }}>
        {TABS.map(([to, label, icon]) => (
          <NavLink key={to} to={to}>
            <Icon name={icon} size={21} /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <LayerHost palette={<Palette />} mentor={ask => <MentorDrawer ask={ask} />} />
    </>
  );
}

/* ---------- admin ---------- */
const ADMIN_ROUTES: [string, string][] = [
  ['/admin', 'Tổng quan'], ['/admin/categories', 'Chủ đề'], ['/admin/signs', 'Ký hiệu'],
  ['/admin/users', 'Người dùng'], ['/admin/posts', 'Bài viết'], ['/admin/reports', 'Tố cáo'], ['/admin/requests', 'Đề xuất'],
];

function AdminShell() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [pending, setPending] = useState<Record<string, number>>({});
  useScrollTop();

  // Open reports / sign requests, refreshed on every admin navigation.
  useEffect(() => {
    Promise.allSettled([adminApi.pendingReports(), adminApi.pendingSuggestions()]).then(([r, s]) => setPending({
      '/admin/reports': r.status === 'fulfilled' ? r.value : 0,
      '/admin/requests': s.status === 'fulfilled' ? s.value : 0,
    }));
  }, [pathname]);
  return (
    <>
      <header className="topbar">
        <Brand to="/admin" />
        <span className="pill ink">Quản trị</span>
        <span className="spacer" />
        <div className="top-actions">
          <span className="muted hide-sm" style={{ fontSize: 14 }}>{user?.fullName}</span>
          <Avatar name={user?.fullName} url={user?.avatarUrl} />
          <button className="btn btn-ghost btn-sm" onClick={logout}><Icon name="logout" size={15} /> Đăng xuất</button>
        </div>
      </header>
      <main id="app" tabIndex={-1}>
        <div className="view" style={{ paddingTop: 0 }}>
          <nav className="admin-sub" aria-label="Mục quản trị">
            {ADMIN_ROUTES.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/admin'} className={({ isActive }) => (isActive ? 'active' : '')}>
                {label}{pending[to] ? <span className="badge-dot" aria-label={`${pending[to]} đang chờ`}>{pending[to]}</span> : null}
              </NavLink>
            ))}
          </nav>
          <Outlet />
        </div>
      </main>
      <LayerHost />
    </>
  );
}
