import { useEffect } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import Icon, { type IconName } from './Icon';
import MentorDrawer from './MentorDrawer';
import Palette from './Palette';
import { Avatar, Brand, Loading } from './common';
import { useAuth } from '../context/AuthContext';
import { LearningProvider, useLearning } from '../context/LearningContext';
import { LayerHost, useUI } from '../context/UIContext';
import { modKey } from '../lib/format';

// Profile lives behind the avatar on wide screens, and as the last tab on narrow ones.
const ROUTES: [string, string, IconName][] = [
  ['/today', 'Today', 'home'],
  ['/learn', 'Journey', 'book'],
  ['/dictionary', 'Dictionary', 'grid'],
  ['/studio', 'Studio', 'video'],
  ['/community', 'Community', 'users'],
];
const TABS: [string, string, IconName][] = [...ROUTES, ['/profile', 'Profile', 'user']];

function useScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);
}

/* ---------- guards ---------- */
export function RequireLearner() {
  const { status, isAdmin } = useAuth();
  const loc = useLocation();
  if (status === 'loading') return <div className="boot"><Loading label="Opening your notebook…" /></div>;
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
  useScrollTop();
  const streak = stats?.currentStreak ?? 0;

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
      <a className="skip" href="#app">Skip to content</a>
      <header className="topbar">
        <Brand to="/today" />
        <nav className="mainnav" aria-label="Primary">
          {ROUTES.map(([to, label]) => (
            <NavLink key={to} to={to}>{label}</NavLink>
          ))}
        </nav>
        <div className="top-actions">
          <button className="mentor-btn" onClick={() => ui.openMentor()} aria-label="Ask Mentor, your AI coach">
            <span className="mentor-dot" /><span>Mentor</span>
          </button>
          <button className="searchbtn" onClick={ui.openPalette} aria-label="Search and commands" title={`Search (${modKey}+K)`}>
            <Icon name="search" size={16} /><span>Search</span><span className="kbd">{modKey} K</span>
          </button>
          <Link className="streak-chip" to="/today" title={`${streak}-day streak`} aria-label={`${streak}-day streak`}>
            <Icon name="flame" size={18} /><span>{streak}</span>
          </Link>
          <Link className="avatar" to="/profile" aria-label="Your profile" title={user?.fullName}><Avatar name={user?.fullName} url={user?.avatarUrl} className="" /></Link>
        </div>
      </header>
      <main id="app" tabIndex={-1}><Outlet /></main>
      <footer className="app-foot">
        <span>SignMentor — made for Vietnamese Sign Language learners.</span>
        <span className="hide-sm">Press <span className="kbd">{modKey} K</span> anywhere to jump.</span>
      </footer>
      <nav className="tabbar" aria-label="Primary mobile" style={{ gridTemplateColumns: `repeat(${TABS.length},1fr)` }}>
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
  ['/admin', 'Overview'], ['/admin/categories', 'Categories'], ['/admin/signs', 'Signs'],
  ['/admin/users', 'Users'], ['/admin/posts', 'Posts'], ['/admin/reports', 'Reports'], ['/admin/requests', 'Requests'],
];

function AdminShell() {
  const { user, logout } = useAuth();
  useScrollTop();
  return (
    <>
      <header className="topbar">
        <Brand to="/admin" />
        <span className="pill ink">Admin</span>
        <span className="spacer" />
        <div className="top-actions">
          <span className="muted hide-sm" style={{ fontSize: 14 }}>{user?.fullName}</span>
          <Avatar name={user?.fullName} url={user?.avatarUrl} />
          <button className="btn btn-ghost btn-sm" onClick={logout}><Icon name="logout" size={15} /> Sign out</button>
        </div>
      </header>
      <main id="app" tabIndex={-1}>
        <div className="view" style={{ paddingTop: 0 }}>
          <nav className="admin-sub" aria-label="Admin sections">
            {ADMIN_ROUTES.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/admin'} className={({ isActive }) => (isActive ? 'active' : '')}>{label}</NavLink>
            ))}
          </nav>
          <Outlet />
        </div>
      </main>
      <LayerHost />
    </>
  );
}
