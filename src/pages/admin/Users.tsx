import { type FormEvent, useEffect, useState } from 'react';
import Icon from '../../components/Icon';
import { Alert, Avatar, EmptyState, Loading, Spinner } from '../../components/common';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { adminApi } from '../../services';
import { apiErrorMessage } from '../../api/errors';
import type { AdminUserResponse, PageResponse, Role, UserStatus } from '../../models';
import { timeAgo } from '../../lib/format';
import * as v from '../../lib/validation';
import { PageHead, Unavailable, useLoad } from './shared';

const STATUS_LABEL: Record<UserStatus, [string, string]> = {
  ACTIVE: ['Active', 'mentor'],
  BANNED: ['Locked', 'lacquer'],
  PENDING_VERIFICATION: ['Unverified', 'dashed'],
  DELETED: ['Deleted', 'dashed'],
};

export default function AdminUsers() {
  const { user: me } = useAuth();
  const ui = useUI();
  const [q, setQ] = useState('');
  const [keyword, setKeyword] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [status, setStatus] = useState<UserStatus | ''>('');
  const stats = useLoad(() => adminApi.userStats());
  const list = useLoad(() => adminApi.users({ keyword: keyword || undefined, role: role || undefined, status: status || undefined, size: 100 }));

  // Filtering runs on identity-service; reload whenever a filter changes.
  useEffect(() => { list.reload(); }, [keyword, role, status]);
  useEffect(() => { const t = window.setTimeout(() => setKeyword(q.trim()), 350); return () => window.clearTimeout(t); }, [q]);

  const replace = (u: AdminUserResponse) =>
    list.setData(d => d && ({ ...d, content: d.content.map(x => (x.id === u.id ? u : x)) }) as PageResponse<AdminUserResponse>);
  const refresh = () => { list.reload(); stats.reload(); };

  const lock = (u: AdminUserResponse) => ui.openModal(
    <LockForm user={u} onDone={x => { ui.closeLayer(); replace(x); stats.reload(); ui.toast(`${u.fullName || u.username} locked`, 'lock'); }} />,
    'Lock account',
  );

  const unlock = async (u: AdminUserResponse) => {
    try { replace(await adminApi.setUserStatus(u.id, 'ACTIVE')); stats.reload(); ui.toast(`${u.fullName || u.username} unlocked`, 'users'); }
    catch (err) { ui.toast(apiErrorMessage(err, 'Could not update the account'), 'alert'); }
  };

  const toggleRole = async (u: AdminUserResponse) => {
    const next: Role = u.role === 'ADMIN' ? 'USER' : 'ADMIN';
    const ok = await ui.confirm({
      title: next === 'ADMIN' ? `Make ${u.fullName || u.username} an admin?` : `Remove admin rights from ${u.fullName || u.username}?`,
      body: next === 'ADMIN' ? 'Admins can manage signs, people and posts.' : 'They keep their learner account.',
      confirmLabel: next === 'ADMIN' ? 'Make admin' : 'Remove admin',
      danger: next === 'USER',
    });
    if (!ok) return;
    try { replace(await adminApi.setUserRole(u.id, next)); stats.reload(); ui.toast('Role updated', 'shield'); }
    catch (err) { ui.toast(apiErrorMessage(err, 'Could not change the role'), 'alert'); }
  };

  const remove = async (u: AdminUserResponse) => {
    const ok = await ui.confirm({
      title: `Delete ${u.fullName || u.username}?`,
      body: 'The account is anonymised and can no longer sign in. This cannot be undone.',
      confirmLabel: 'Delete account', danger: true,
    });
    if (!ok) return;
    try { await adminApi.deleteUser(u.id); refresh(); ui.toast('Account deleted', 'trash'); }
    catch (err) { ui.toast(apiErrorMessage(err, 'Could not delete the account'), 'alert'); }
  };

  const create = () => ui.openModal(<CreateUserForm onDone={() => { ui.closeLayer(); refresh(); ui.toast('Account created', 'users'); }} />, 'New account');

  return (
    <>
      <PageHead kicker="Admin · identity-service" title={<>The <em>people</em></>}>
        {!list.missing && <button className="btn btn-lacquer btn-sm" onClick={create}><Icon name="plus" size={15} /> New account</button>}
      </PageHead>
      {stats.data && (
        <div className="tiles figs">
          <div className="fig"><b>{stats.data.totalUsers}</b><span>accounts</span></div>
          <div className="fig"><b>{stats.data.activeUsers}</b><span>active</span></div>
          <div className="fig"><b>{stats.data.bannedUsers}</b><span>locked</span></div>
          <div className="fig"><b>{stats.data.adminUsers}</b><span>admins</span></div>
        </div>
      )}
      {list.missing ? <Unavailable endpoint="/api/users/admin" service="identity-service" /> : (
        <>
          <div className="toolbar">
            <label className="dict-search"><Icon name="search" size={17} /><input placeholder="Search by name, username or email…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search users" /></label>
            <select className="tselect" style={{ width: 'auto' }} value={role} onChange={e => setRole(e.target.value as Role | '')} aria-label="Filter by role">
              <option value="">All roles</option><option value="USER">Learners</option><option value="ADMIN">Admins</option>
            </select>
            <select className="tselect" style={{ width: 'auto' }} value={status} onChange={e => setStatus(e.target.value as UserStatus | '')} aria-label="Filter by status">
              <option value="">Any status</option><option value="ACTIVE">Active</option><option value="BANNED">Locked</option>
              <option value="PENDING_VERIFICATION">Unverified</option><option value="DELETED">Deleted</option>
            </select>
            {list.data && <span className="faint" style={{ fontSize: 13 }}>{list.data.totalElements} accounts</span>}
          </div>
          {list.loading && !list.data ? <Loading /> : list.error ? <Alert>{list.error}</Alert> : list.data!.content.length === 0 ? <EmptyState title="No accounts match" body="Try another search or filter." /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Person</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th></th></tr></thead>
                <tbody>
                  {list.data!.content.map(u => {
                    const [label, cls] = STATUS_LABEL[u.status] || [u.status, ''];
                    const self = u.id === me?.userId;
                    return (
                      <tr key={u.id}>
                        <td><div className="row"><Avatar name={u.fullName || u.username} url={u.avatarUrl} size={34} /><span><b>{u.fullName || '—'}</b><br /><span className="faint" style={{ fontSize: 12.5 }}>@{u.username}</span></span></div></td>
                        <td>{u.email}</td>
                        <td><span className={`pill ${u.role === 'ADMIN' ? 'ink' : ''}`}>{u.role === 'ADMIN' ? 'Admin' : 'Learner'}</span></td>
                        <td><span className={`pill ${cls}`}>{label}</span></td>
                        <td className="muted">{timeAgo(u.createdAt)}</td>
                        <td><div className="actions">
                          {!self && u.status !== 'DELETED' && <>
                            {u.status === 'BANNED'
                              ? <button className="btn btn-ghost btn-sm" onClick={() => unlock(u)}>Unlock</button>
                              : <button className="btn btn-ghost btn-sm" onClick={() => lock(u)}>Lock</button>}
                            <button className="btn btn-ghost btn-sm" onClick={() => toggleRole(u)}>{u.role === 'ADMIN' ? 'Make learner' : 'Make admin'}</button>
                            <button className="iconbtn" onClick={() => remove(u)} aria-label={`Delete ${u.username}`}><Icon name="trash" size={17} /></button>
                          </>}
                          {self && <span className="faint" style={{ fontSize: 12.5 }}>You</span>}
                        </div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}

function LockForm({ user, onDone }: { user: AdminUserResponse; onDone: (u: AdminUserResponse) => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try { onDone(await adminApi.setUserStatus(user.id, 'BANNED', reason.trim() || undefined)); }
    catch (err) { setError(apiErrorMessage(err, 'Could not lock the account.')); setBusy(false); }
  };
  return (
    <form onSubmit={submit}>
      <p className="kicker">Moderation</p>
      <h2>Lock {user.fullName || user.username}</h2>
      <p className="muted" style={{ margin: '8px 0 16px' }}>They cannot sign in until you unlock the account. Sessions already open end when their token expires (up to 30 minutes).</p>
      {error && <div style={{ marginBottom: 12 }}><Alert>{error}</Alert></div>}
      <div className="field"><label htmlFor="lk-reason">Reason (optional)</label>
        <textarea id="lk-reason" className="tarea" value={reason} onChange={e => setReason(e.target.value)} placeholder="Repeated spam in the common room." autoFocus /></div>
      <div className="form-actions"><button className="btn btn-lacquer" disabled={busy}>{busy ? <Spinner /> : <Icon name="lock" size={15} />} Lock account</button></div>
    </form>
  );
}

function CreateUserForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ fullName: '', username: '', email: '', password: '', role: 'USER' as Role });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF(p => ({ ...p, [k]: e.target.value })); setErrors(p => ({ ...p, [k]: '' })); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const fieldErrors = {
      fullName: f.fullName.length > 100 ? 'At most 100 characters.' : '',
      username: v.username(f.username), email: v.email(f.email), password: v.password(f.password),
    };
    setErrors(fieldErrors);
    if (!v.isValid(fieldErrors)) return;
    setBusy(true); setFailure('');
    try {
      await adminApi.createUser({ fullName: f.fullName.trim() || undefined, username: f.username.trim(), email: f.email.trim(), password: f.password, role: f.role });
      onDone();
    } catch (err) { setFailure(apiErrorMessage(err, 'Could not create the account.')); setBusy(false); }
  };

  const field = (k: keyof typeof f, label: string, type = 'text') => (
    <div className={`field ${errors[k] ? 'invalid' : ''}`}>
      <label htmlFor={`cu-${k}`}>{label}</label>
      <input id={`cu-${k}`} className="tinput" type={type} value={f[k]} onChange={set(k)} />
      {errors[k] && <span className="err">{errors[k]}</span>}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate>
      <p className="kicker">identity-service</p>
      <h2>New account</h2>
      <p className="muted" style={{ marginTop: 4 }}>Created already verified — no email code needed.</p>
      {failure && <div style={{ margin: '12px 0' }}><Alert>{failure}</Alert></div>}
      <div className="form-grid" style={{ marginTop: 18 }}>
        {field('fullName', 'Full name')}
        {field('username', 'Username')}
      </div>
      {field('email', 'Email', 'email')}
      <div className="form-grid">
        {field('password', 'Password', 'password')}
        <div className="field"><label htmlFor="cu-role">Role</label>
          <select id="cu-role" className="tselect" value={f.role} onChange={set('role')}>
            <option value="USER">Learner</option><option value="ADMIN">Admin</option>
          </select></div>
      </div>
      <div className="form-actions"><button className="btn" disabled={busy}>{busy ? <Spinner /> : <Icon name="check" size={15} />} Create</button></div>
    </form>
  );
}
