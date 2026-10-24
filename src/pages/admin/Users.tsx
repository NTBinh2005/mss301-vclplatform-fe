import { useMemo, useState } from 'react';
import Icon from '../../components/Icon';
import { Alert, Avatar, EmptyState, Loading } from '../../components/common';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { adminApi } from '../../services';
import { apiErrorMessage } from '../../api/errors';
import type { PageResponse, UserResponse } from '../../models';
import { timeAgo } from '../../lib/format';
import { PageHead, Unavailable, useLoad } from './shared';

export default function AdminUsers() {
  const { user: me } = useAuth();
  const ui = useUI();
  const [q, setQ] = useState('');
  const list = useLoad(() => adminApi.users(0, 200));

  const rows = useMemo(() => {
    const lq = q.trim().toLowerCase();
    return (list.data?.content ?? []).filter(u => !lq || `${u.fullName} ${u.username} ${u.email}`.toLowerCase().includes(lq));
  }, [list.data, q]);

  const toggle = async (u: UserResponse) => {
    const next = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (next === 'INACTIVE' && !(await ui.confirm({
      title: `Deactivate ${u.fullName}?`, body: 'They will not be able to sign in until you reactivate the account.',
      confirmLabel: 'Deactivate', danger: true,
    }))) return;
    try {
      await adminApi.setUserStatus(u.userId, next);
      list.setData(d => d && ({ ...d, content: d.content.map(x => (x.userId === u.userId ? { ...x, status: next } : x)) }) as PageResponse<UserResponse>);
      ui.toast(next === 'ACTIVE' ? `${u.fullName} reactivated` : `${u.fullName} deactivated`, 'users');
    } catch (err) { ui.toast(apiErrorMessage(err, 'Could not update the account'), 'alert'); }
  };

  return (
    <>
      <PageHead kicker="Admin · identity-service" title={<>The <em>people</em></>} />
      {list.missing ? <Unavailable endpoint="/api/admin/users" service="identity-service" /> : (
        <>
          <div className="toolbar">
            <label className="dict-search"><Icon name="search" size={17} /><input placeholder="Search by name, username or email…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search users" /></label>
            {list.data && <span className="faint" style={{ fontSize: 13 }}>{list.data.totalElements} accounts</span>}
          </div>
          {list.loading && !list.data ? <Loading /> : list.error ? <Alert>{list.error}</Alert> : rows.length === 0 ? <EmptyState title="No accounts match" body="Try another search." /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Person</th><th>Email</th><th>Role</th><th>Status</th><th>Last sign-in</th><th></th></tr></thead>
                <tbody>
                  {rows.map(u => (
                    <tr key={u.userId}>
                      <td><div className="row"><Avatar name={u.fullName} url={u.avatarUrl} size={34} /><span><b>{u.fullName}</b><br /><span className="faint" style={{ fontSize: 12.5 }}>@{u.username}</span></span></div></td>
                      <td>{u.email}</td>
                      <td><span className={`pill ${u.role === 'ADMIN' ? 'ink' : ''}`}>{u.role}</span></td>
                      <td><span className={`pill ${u.status === 'ACTIVE' ? 'mentor' : 'lacquer dashed'}`}>{u.status === 'ACTIVE' ? 'Active' : 'Inactive'}</span></td>
                      <td className="muted">{u.lastLogin ? timeAgo(u.lastLogin) : 'Never'}</td>
                      <td><div className="actions">
                        {u.userId !== me?.userId && (
                          <button className="btn btn-ghost btn-sm" onClick={() => toggle(u)}>{u.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}</button>
                        )}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
