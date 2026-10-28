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
  ACTIVE: ['Hoạt động', 'mentor'],
  BANNED: ['Đã khóa', 'lacquer'],
  PENDING_VERIFICATION: ['Chưa xác minh', 'dashed'],
  DELETED: ['Đã xóa', 'dashed'],
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
    <LockForm user={u} onDone={x => { ui.closeLayer(); replace(x); stats.reload(); ui.toast(`Đã khóa ${u.fullName || u.username}`, 'lock'); }} />,
    'Khóa tài khoản',
  );

  const unlock = async (u: AdminUserResponse) => {
    try { replace(await adminApi.setUserStatus(u.id, 'ACTIVE')); stats.reload(); ui.toast(`Đã mở khóa ${u.fullName || u.username}`, 'users'); }
    catch (err) { ui.toast(apiErrorMessage(err, 'Không cập nhật được tài khoản'), 'alert'); }
  };

  const toggleRole = async (u: AdminUserResponse) => {
    const next: Role = u.role === 'ADMIN' ? 'USER' : 'ADMIN';
    const ok = await ui.confirm({
      title: next === 'ADMIN' ? `Cấp quyền quản trị cho ${u.fullName || u.username}?` : `Thu hồi quyền quản trị của ${u.fullName || u.username}?`,
      body: next === 'ADMIN' ? 'Quản trị viên quản lý được ký hiệu, người dùng và bài viết.' : 'Người này vẫn giữ tài khoản học viên.',
      confirmLabel: next === 'ADMIN' ? 'Cấp quyền' : 'Thu hồi quyền',
      danger: next === 'USER',
    });
    if (!ok) return;
    try { replace(await adminApi.setUserRole(u.id, next)); stats.reload(); ui.toast('Đã cập nhật vai trò', 'shield'); }
    catch (err) { ui.toast(apiErrorMessage(err, 'Không đổi được vai trò'), 'alert'); }
  };

  const remove = async (u: AdminUserResponse) => {
    const ok = await ui.confirm({
      title: `Xóa ${u.fullName || u.username}?`,
      body: 'Tài khoản bị ẩn danh hóa và không đăng nhập được nữa. Không thể hoàn tác.',
      confirmLabel: 'Xóa tài khoản', danger: true,
    });
    if (!ok) return;
    try { await adminApi.deleteUser(u.id); refresh(); ui.toast('Đã xóa tài khoản', 'trash'); }
    catch (err) { ui.toast(apiErrorMessage(err, 'Không xóa được tài khoản'), 'alert'); }
  };

  const create = () => ui.openModal(<CreateUserForm onDone={() => { ui.closeLayer(); refresh(); ui.toast('Đã tạo tài khoản', 'users'); }} />, 'Tài khoản mới');

  return (
    <>
      <PageHead kicker="Quản trị · identity-service" title={<>Người <em>dùng</em></>}>
        {!list.missing && <button className="btn btn-lacquer btn-sm" onClick={create}><Icon name="plus" size={15} /> Tài khoản mới</button>}
      </PageHead>
      {stats.data && (
        <div className="tiles figs">
          <div className="fig"><b>{stats.data.totalUsers}</b><span>tài khoản</span></div>
          <div className="fig"><b>{stats.data.activeUsers}</b><span>hoạt động</span></div>
          <div className="fig"><b>{stats.data.bannedUsers}</b><span>đã khóa</span></div>
          <div className="fig"><b>{stats.data.adminUsers}</b><span>quản trị viên</span></div>
        </div>
      )}
      {list.missing ? <Unavailable endpoint="/api/users/admin" service="identity-service" /> : (
        <>
          <div className="toolbar">
            <label className="dict-search"><Icon name="search" size={17} /><input placeholder="Tìm theo tên, tên đăng nhập hoặc email…" value={q} onChange={e => setQ(e.target.value)} aria-label="Tìm người dùng" /></label>
            <select className="tselect" style={{ width: 'auto' }} value={role} onChange={e => setRole(e.target.value as Role | '')} aria-label="Lọc theo vai trò">
              <option value="">Mọi vai trò</option><option value="USER">Học viên</option><option value="ADMIN">Quản trị viên</option>
            </select>
            <select className="tselect" style={{ width: 'auto' }} value={status} onChange={e => setStatus(e.target.value as UserStatus | '')} aria-label="Lọc theo trạng thái">
              <option value="">Mọi trạng thái</option><option value="ACTIVE">Hoạt động</option><option value="BANNED">Đã khóa</option>
              <option value="PENDING_VERIFICATION">Chưa xác minh</option><option value="DELETED">Đã xóa</option>
            </select>
            {list.data && <span className="faint" style={{ fontSize: 13 }}>{list.data.totalElements} tài khoản</span>}
          </div>
          {list.loading && !list.data ? <Loading /> : list.error ? <Alert>{list.error}</Alert> : list.data!.content.length === 0 ? <EmptyState title="Không có tài khoản phù hợp" body="Thử từ khóa hoặc bộ lọc khác." /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Người dùng</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th>Tham gia</th><th></th></tr></thead>
                <tbody>
                  {list.data!.content.map(u => {
                    const [label, cls] = STATUS_LABEL[u.status] || [u.status, ''];
                    const self = u.id === me?.userId;
                    return (
                      <tr key={u.id}>
                        <td><div className="row"><Avatar name={u.fullName || u.username} url={u.avatarUrl} size={34} /><span><b>{u.fullName || '—'}</b><br /><span className="faint" style={{ fontSize: 12.5 }}>@{u.username}</span></span></div></td>
                        <td>{u.email}</td>
                        <td><span className={`pill ${u.role === 'ADMIN' ? 'ink' : ''}`}>{u.role === 'ADMIN' ? 'Quản trị' : 'Học viên'}</span></td>
                        <td><span className={`pill ${cls}`}>{label}</span></td>
                        <td className="muted">{timeAgo(u.createdAt)}</td>
                        <td><div className="actions">
                          {!self && u.status !== 'DELETED' && <>
                            {u.status === 'BANNED'
                              ? <button className="btn btn-ghost btn-sm" onClick={() => unlock(u)}>Mở khóa</button>
                              : <button className="btn btn-ghost btn-sm" onClick={() => lock(u)}>Khóa</button>}
                            <button className="btn btn-ghost btn-sm" onClick={() => toggleRole(u)}>{u.role === 'ADMIN' ? 'Hạ thành học viên' : 'Cấp quyền quản trị'}</button>
                            <button className="iconbtn" onClick={() => remove(u)} aria-label={`Xóa ${u.username}`}><Icon name="trash" size={17} /></button>
                          </>}
                          {self && <span className="faint" style={{ fontSize: 12.5 }}>Bạn</span>}
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
    catch (err) { setError(apiErrorMessage(err, 'Không khóa được tài khoản.')); setBusy(false); }
  };
  return (
    <form onSubmit={submit}>
      <p className="kicker">Kiểm duyệt</p>
      <h2>Khóa {user.fullName || user.username}</h2>
      <p className="muted" style={{ margin: '8px 0 16px' }}>Người này không đăng nhập được cho đến khi bạn mở khóa. Phiên đang mở sẽ hết khi token hết hạn (tối đa 30 phút).</p>
      {error && <div style={{ marginBottom: 12 }}><Alert>{error}</Alert></div>}
      <div className="field"><label htmlFor="lk-reason">Lý do (không bắt buộc)</label>
        <textarea id="lk-reason" className="tarea" value={reason} onChange={e => setReason(e.target.value)} placeholder="Liên tục đăng spam trong cộng đồng." autoFocus /></div>
      <div className="form-actions"><button className="btn btn-lacquer" disabled={busy}>{busy ? <Spinner /> : <Icon name="lock" size={15} />} Khóa tài khoản</button></div>
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
      fullName: f.fullName.length > 100 ? 'Tối đa 100 ký tự.' : '',
      username: v.username(f.username), email: v.email(f.email), password: v.password(f.password),
    };
    setErrors(fieldErrors);
    if (!v.isValid(fieldErrors)) return;
    setBusy(true); setFailure('');
    try {
      await adminApi.createUser({ fullName: f.fullName.trim() || undefined, username: f.username.trim(), email: f.email.trim(), password: f.password, role: f.role });
      onDone();
    } catch (err) { setFailure(apiErrorMessage(err, 'Không tạo được tài khoản.')); setBusy(false); }
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
      <h2>Tài khoản mới</h2>
      <p className="muted" style={{ marginTop: 4 }}>Tạo sẵn ở trạng thái đã xác minh — không cần mã email.</p>
      {failure && <div style={{ margin: '12px 0' }}><Alert>{failure}</Alert></div>}
      <div className="form-grid" style={{ marginTop: 18 }}>
        {field('fullName', 'Họ và tên')}
        {field('username', 'Tên đăng nhập')}
      </div>
      {field('email', 'Email', 'email')}
      <div className="form-grid">
        {field('password', 'Mật khẩu', 'password')}
        <div className="field"><label htmlFor="cu-role">Vai trò</label>
          <select id="cu-role" className="tselect" value={f.role} onChange={set('role')}>
            <option value="USER">Học viên</option><option value="ADMIN">Quản trị viên</option>
          </select></div>
      </div>
      <div className="form-actions"><button className="btn" disabled={busy}>{busy ? <Spinner /> : <Icon name="check" size={15} />} Tạo</button></div>
    </form>
  );
}
