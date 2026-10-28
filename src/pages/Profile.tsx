import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon, { type IconName } from '../components/Icon';
import { Hand } from '../components/Hand';
import { Alert, Loading, Spinner } from '../components/common';
import { useAuth } from '../context/AuthContext';
import { useLearning } from '../context/LearningContext';
import { useUI } from '../context/UIContext';
import { followApi, userApi } from '../services';
import { apiErrorMessage } from '../api/errors';
import type { FollowStatusResponse, PracticeStatsResponse } from '../models';
import { initials, lastSevenDays, timeAgo } from '../lib/format';
import { updatePrefs, usePrefs } from '../lib/prefs';
import * as v from '../lib/validation';

// The backend has no "how close am I" endpoint, so progress is derived from
// /practice/stats using the same keys and thresholds as AchievementService.
const PROGRESS: Record<string, (s: PracticeStatsResponse) => [number, number]> = {
  FIRST_STEP: s => [s.totalAttempts, 1],
  CORRECT_10: s => [s.correctAttempts, 10],
  CORRECT_50: s => [s.correctAttempts, 50],
  LEARNED_5: s => [s.learnedCount, 5],
  LEARNED_20: s => [s.learnedCount, 20],
  ALL_LEARNED: s => [s.learnedCount, Math.max(s.totalVocabs, 1)],
  PROFICIENCY_50: s => [s.proficiency, 50],
  PROFICIENCY_100: s => [s.proficiency, 100],
};
const ACH_ICON: Record<string, IconName> = {
  FIRST_STEP: 'star', CORRECT_10: 'check', CORRECT_50: 'seal', LEARNED_5: 'book', LEARNED_20: 'book',
  ALL_LEARNED: 'seal', PROFICIENCY_50: 'chart', PROFICIENCY_100: 'shield',
};

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const L = useLearning();
  const ui = useUI();
  const navigate = useNavigate();
  const { goal, reduceMotion } = usePrefs();
  const [drawn, setDrawn] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [emailNotes, setEmailNotes] = useState<boolean | null>(user?.emailNotificationsEnabled ?? null);
  const [social, setSocial] = useState<FollowStatusResponse | null>(null);

  useEffect(() => { const r = requestAnimationFrame(() => setDrawn(true)); return () => cancelAnimationFrame(r); }, []);
  useEffect(() => { userApi.me().then(p => { setUser(p); setEmailNotes(p.emailNotificationsEnabled); }).catch(() => {}); }, [setUser]);
  useEffect(() => { if (user) followApi.stats(user.userId).then(setSocial).catch(() => {}); }, [user?.userId]);

  if (L.loading || !user) return <section className="view"><Loading /></section>;

  const s = L.stats;
  const perCat = L.categories.map(c => {
    const all = L.signs.filter(x => x.categoryId === c.id);
    return { name: c.name, total: all.length, got: all.filter(x => x.status === 'learned').length };
  }).filter(c => c.total > 0);
  const week = s?.weekActivity?.length === 7 ? s.weekActivity : null;
  const weekLabels = lastSevenDays();
  const joined = user.createdAt ? new Date(user.createdAt) : null;
  const since = joined && !Number.isNaN(joined.getTime()) ? joined.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' }) : '';

  const setGoal = (d: number) => {
    const g = Math.min(10, Math.max(1, goal + d));
    updatePrefs({ goal: g });
    ui.toast(`Mục tiêu ngày: ${g} hoạt động`, 'seal');
  };

  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      setUser(await userApi.uploadAvatar(file));
      ui.toast('Đã cập nhật ảnh đại diện');
    } catch (err) { ui.toast(apiErrorMessage(err, 'Không tải được ảnh lên'), 'alert'); } finally { setUploading(false); }
  };

  const removeAvatar = async () => {
    setUploading(true);
    try { setUser(await userApi.removeAvatar()); ui.toast('Đã gỡ ảnh đại diện', 'trash'); }
    catch (err) { ui.toast(apiErrorMessage(err, 'Không gỡ được ảnh đại diện'), 'alert'); } finally { setUploading(false); }
  };

  const toggleEmail = async () => {
    const next = !emailNotes;
    try { setUser(await userApi.setEmailNotifications(next)); setEmailNotes(next); ui.toast(next ? 'Đã bật email nhắc nhở' : 'Đã tắt email nhắc nhở', 'mail'); }
    catch (err) { ui.toast(apiErrorMessage(err, 'Không cập nhật được cài đặt thông báo'), 'alert'); }
  };

  const deleteAccount = () => ui.openModal(
    <DeleteAccountForm onDeleted={async () => { await logout(); navigate('/', { replace: true }); ui.toast('Tài khoản của bạn đã được xóa', 'trash'); }} />,
    'Xóa tài khoản',
  );

  return (
    <section className="view">
      <div className="prof-head">
        <span className="prof-hand" aria-hidden="true"><Hand frame={{ shape: 'flat', rot: -6 }} size={300} /></span>
        <div className="prof-avatar">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials(user.fullName)}
          <label>{uploading ? <Spinner /> : 'Đổi ảnh'}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={e => uploadAvatar(e.target.files?.[0])} /></label>
        </div>
        <div style={{ position: 'relative' }}>
          <p className="kicker">@{user.username} · {s ? `thành thạo ${s.proficiency}%` : 'Học viên'}{since ? ` · tham gia ${since}` : ''}</p>
          <h1 className="display sm">{user.fullName || user.username}</h1>
          {user.bio && <p className="muted" style={{ maxWidth: '60ch', marginTop: 4 }}>{user.bio}</p>}
          <p className="faint" style={{ fontSize: 13.5, marginTop: 6 }}>
            {social ? <>{social.followerCount} người theo dõi · đang theo dõi {social.followingCount} · {social.friendCount} bạn bè · </> : null}
            <Link className="linkbtn" to={`/people/${user.userId}`}>Trang công khai của bạn</Link>
            {' · '}<button className="linkbtn" onClick={() => ui.openModal(<AvatarUrlForm current={user.avatarUrl} />, 'Ảnh đại diện từ đường dẫn')}>Dùng ảnh từ đường dẫn</button>
            {user.avatarUrl && <> · <button className="linkbtn" onClick={removeAvatar} disabled={uploading}>Gỡ ảnh</button></>}
          </p>
          <div className="goal-line">
            <Icon name="flag" size={16} /><span>Mục tiêu ngày:</span>
            <span className="goal-stepper">
              <button onClick={() => setGoal(-1)} aria-label="Giảm mục tiêu ngày" disabled={goal <= 1}><Icon name="minus" size={14} /></button>
              <b style={{ minWidth: 92, textAlign: 'center', padding: '0 4px' }}>{goal} hoạt động / ngày</b>
              <button onClick={() => setGoal(1)} aria-label="Tăng mục tiêu ngày" disabled={goal >= 10}><Icon name="plus" size={14} /></button>
            </span>
            <span className="faint" style={{ fontSize: 13 }}>hôm nay đã làm {L.activityToday}</span>
          </div>
        </div>
      </div>

      <div className="figs" role="list">
        <div className="fig" role="listitem"><b>{s?.learnedCount ?? 0}</b><span>ký hiệu đã thuộc</span></div>
        <div className="fig" role="listitem"><b>{s ? `${Math.round(s.accuracyRate)}%` : '—'}</b><span>độ chính xác</span></div>
        <div className="fig" role="listitem"><b>{s?.currentStreak ?? 0}</b><span>ngày liên tiếp</span></div>
        <div className="fig" role="listitem"><b>{s?.longestStreak ?? 0}</b><span>chuỗi dài nhất</span></div>
        <div className="fig" role="listitem"><b>{s?.totalAttempts ?? 0}</b><span>lượt tập</span></div>
      </div>

      <div className="two-col">
        <div>
          <div className="rule-head"><h2>Kỹ năng</h2><span className="kicker">ký hiệu đã thuộc theo chủ đề</span></div>
          {perCat.length === 0 && <p className="muted">Chưa có chủ đề.</p>}
          {perCat.map(c => (
            <div className="skill" key={c.name}>
              <span>{c.name}</span>
              <div className="skill-track"><div className="skill-fill" style={{ width: drawn ? `${Math.round((c.got / c.total) * 100)}%` : 0 }} /></div>
              <b style={{ textAlign: 'right' }}>{c.got}/{c.total}</b>
            </div>
          ))}

          {week && (
            <>
              <div className="rule-head"><h2>Tuần này</h2><span className="kicker">những ngày bạn đã luyện</span></div>
              <div className="week">{week.map((on, i) => <span key={i}><i className={on ? 'on' : ''} />{weekLabels[i]}</span>)}</div>
            </>
          )}

          <div className="rule-head"><h2>Hoạt động gần đây</h2></div>
          {L.attempts.length === 0 && <p className="muted">Các lượt tập trong Phòng tập sẽ hiện ở đây.</p>}
          {L.attempts.slice(0, 8).map(a => (
            <div className="timeline-item" key={a.attemptId}>
              <span>{a.isCorrect ? 'Ký đúng' : 'Đã luyện'} “{a.word}” trong Phòng tập{a.confidence != null ? ` · ${Math.round(a.confidence)}%` : ''}</span>
              <time>{timeAgo(a.attemptedAt)}</time>
            </div>
          ))}
        </div>

        <aside>
          <div className="rule-head"><h2>Thành tích</h2></div>
          <div className="stampgrid">
            {L.achievements.length === 0 && <p className="muted">Thành tích sẽ xuất hiện sau lượt tập đầu tiên.</p>}
            {L.achievements.map(a => {
              const prog = s && PROGRESS[a.key] ? PROGRESS[a.key](s) : null;
              return (
                <div key={a.id} className={`ach ${a.unlocked ? '' : 'locked'}`} title={a.description}>
                  <span className="ach-stamp"><Icon name={ACH_ICON[a.key] || 'star'} size={26} /></span>
                  <b>{a.name}</b>
                  <span>{a.unlocked ? `Đạt được ${a.unlockedAt ? timeAgo(a.unlockedAt) : ''}` : prog ? `${a.description} · ${Math.min(prog[0], prog[1])}/${prog[1]}` : a.description}</span>
                </div>
              );
            })}
          </div>

          <div className="rule-head"><h2>Cài đặt</h2></div>
          <div className="settings-row">
            <span style={{ flex: 1 }}>Giảm chuyển động<br /><small style={{ color: 'var(--ink-2)' }}>Tạm dừng tự phát và hiệu ứng trang trí</small></span>
            <button className="switch" role="switch" aria-checked={reduceMotion} aria-label="Giảm chuyển động"
              onClick={() => { updatePrefs({ reduceMotion: !reduceMotion }); ui.toast(!reduceMotion ? 'Đã giảm chuyển động' : 'Đã bật lại chuyển động'); }} />
          </div>
          {emailNotes !== null && (
            <div className="settings-row">
              <span style={{ flex: 1 }}>Email nhắc nhở<br /><small style={{ color: 'var(--ink-2)' }}>Nhắc khi bạn sắp mất chuỗi ngày học</small></span>
              <button className="switch" role="switch" aria-checked={emailNotes} aria-label="Email nhắc nhở" onClick={toggleEmail} />
            </div>
          )}
          <div className="settings-row">
            <span style={{ flex: 1 }}>Thông tin hồ sơ<br /><small style={{ color: 'var(--ink-2)' }}>Họ tên và tiểu sử</small></span>
            <button className="btn btn-ghost btn-sm" onClick={() => ui.openModal(<ProfileForm />, 'Sửa hồ sơ')}><Icon name="edit" size={14} /> Sửa</button>
          </div>
          <div className="settings-row">
            <span style={{ flex: 1 }}>Mật khẩu<br /><small style={{ color: 'var(--ink-2)' }}>Đổi mật khẩu đăng nhập</small></span>
            <button className="btn btn-ghost btn-sm" onClick={() => ui.openModal(<PasswordForm />, 'Đổi mật khẩu')}><Icon name="lock" size={14} /> Đổi</button>
          </div>
          <div className="settings-row">
            <span style={{ flex: 1 }}>Đăng xuất<br /><small style={{ color: 'var(--ink-2)' }}>Tiến độ đã được lưu vào tài khoản</small></span>
            <button className="btn btn-ghost btn-sm" onClick={async () => { await logout(); navigate('/', { replace: true }); }}><Icon name="logout" size={14} /> Đăng xuất</button>
          </div>
          <div className="settings-row">
            <span style={{ flex: 1, color: 'var(--lacquer-2)' }}>Xóa tài khoản<br /><small style={{ color: 'var(--ink-2)' }}>Xóa vĩnh viễn tài khoản và tiến độ học</small></span>
            <button className="btn btn-ghost btn-sm btn-danger-ghost" onClick={deleteAccount}><Icon name="trash" size={14} /> Xóa</button>
          </div>
        </aside>
      </div>
    </section>
  );
}

function ProfileForm() {
  const { user, setUser } = useAuth();
  const ui = useUI();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const fieldErrors = { fullName: v.fullName(fullName), bio: bio.length > 500 ? 'Tiểu sử tối đa 500 ký tự.' : '' };
    setErrors(fieldErrors);
    if (!v.isValid(fieldErrors)) return;
    setBusy(true); setFailure('');
    try {
      setUser(await userApi.updateProfile({ fullName: fullName.trim(), bio: bio.trim() }));
      ui.closeLayer();
      ui.toast('Đã lưu hồ sơ');
    } catch (err) { setFailure(apiErrorMessage(err, 'Không lưu được hồ sơ.')); setBusy(false); }
  };

  return (
    <form onSubmit={submit} noValidate>
      <p className="kicker">Tài khoản</p>
      <h2>Thông tin hồ sơ</h2>
      {failure && <div style={{ margin: '12px 0' }}><Alert>{failure}</Alert></div>}
      <div style={{ marginTop: 18 }}>
        <div className={`field ${errors.fullName ? 'invalid' : ''}`}>
          <label htmlFor="pf-name">Họ và tên</label>
          <input id="pf-name" className="tinput" value={fullName} maxLength={100}
            onChange={e => { setFullName(e.target.value); setErrors(p => ({ ...p, fullName: '' })); }} />
          {errors.fullName && <span className="err">{errors.fullName}</span>}
        </div>
        <div className={`field ${errors.bio ? 'invalid' : ''}`}>
          <label htmlFor="pf-bio">Tiểu sử</label>
          <textarea id="pf-bio" className="tarea" value={bio} maxLength={500} placeholder="Vài dòng về bạn và lý do bạn học ký hiệu."
            onChange={e => { setBio(e.target.value); setErrors(p => ({ ...p, bio: '' })); }} />
          {errors.bio ? <span className="err">{errors.bio}</span> : <span className="hint">{bio.length}/500</span>}
        </div>
        <div className="field">
          <span className="label">Tên đăng nhập và email</span>
          <span className="muted">@{user?.username} · {user?.email}</span>
          <span className="hint">Dùng để định danh tài khoản, không đổi được ở đây.</span>
        </div>
      </div>
      <div className="form-actions"><button className="btn" disabled={busy}>{busy ? <Spinner /> : <Icon name="check" size={15} />} Lưu</button></div>
    </form>
  );
}

function PasswordForm() {
  const ui = useUI();
  const [oldPw, setOldPw] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const fieldErrors = {
      old: v.required(oldPw, 'Mật khẩu hiện tại'),
      pw: v.password(pw),
      pw2: pw !== pw2 ? 'Hai mật khẩu không khớp.' : '',
    };
    setErrors(fieldErrors);
    if (!v.isValid(fieldErrors)) return;
    setBusy(true); setFailure('');
    try {
      await userApi.changePassword(oldPw, pw);
      ui.closeLayer();
      ui.toast('Đã đổi mật khẩu', 'lock');
    } catch (err) { setFailure(apiErrorMessage(err, 'Không đổi được mật khẩu.')); setBusy(false); }
  };

  const row = (id: string, label: string, val: string, set: (s: string) => void, hint?: string) => (
    <div className={`field ${errors[id] ? 'invalid' : ''}`}>
      <label htmlFor={`pw-${id}`}>{label}</label>
      <input id={`pw-${id}`} className="tinput" type="password" value={val} onChange={e => { set(e.target.value); setErrors(p => ({ ...p, [id]: '' })); }} />
      {errors[id] ? <span className="err">{errors[id]}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate>
      <p className="kicker">Bảo mật</p>
      <h2>Đổi mật khẩu</h2>
      {failure && <div style={{ margin: '12px 0' }}><Alert>{failure}</Alert></div>}
      <div style={{ marginTop: 18 }}>
        {row('old', 'Mật khẩu hiện tại', oldPw, setOldPw)}
        {row('pw', 'Mật khẩu mới', pw, setPw, v.PASSWORD_HINT)}
        {row('pw2', 'Nhập lại mật khẩu mới', pw2, setPw2)}
      </div>
      <div className="form-actions"><button className="btn" disabled={busy}>{busy ? <Spinner /> : <Icon name="lock" size={15} />} Đổi mật khẩu</button></div>
    </form>
  );
}

// Use a picture that is already online (identity PUT /users/me/avatar); an uploaded photo it replaces is deleted.
function AvatarUrlForm({ current }: { current: string | null }) {
  const { setUser } = useAuth();
  const ui = useUI();
  const [url, setUrl] = useState(current && !current.includes('/avatars/') ? current : '');
  const [error, setError] = useState('');
  const [broken, setBroken] = useState(false);
  const [busy, setBusy] = useState(false);
  const valid = /^https?:\/\/\S+$/.test(url.trim());

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) { setError('Đường dẫn ảnh phải bắt đầu bằng http:// hoặc https://'); return; }
    if (broken) { setError('Không mở được ảnh từ đường dẫn này. Hãy kiểm tra lại.'); return; }
    setBusy(true); setError('');
    try {
      setUser(await userApi.setAvatarUrl(url.trim()));
      ui.closeLayer();
      ui.toast('Đã cập nhật ảnh đại diện');
    } catch (err) { setError(apiErrorMessage(err, 'Không cập nhật được ảnh đại diện.')); setBusy(false); }
  };

  return (
    <form onSubmit={submit} noValidate>
      <p className="kicker">Ảnh đại diện</p>
      <h2>Dùng ảnh từ đường dẫn</h2>
      <p className="muted" style={{ marginTop: 4 }}>Dán đường dẫn của một ảnh có sẵn trên mạng. Ảnh bạn đã tải lên trước đó sẽ bị thay thế.</p>
      {error && <div style={{ margin: '12px 0' }}><Alert>{error}</Alert></div>}
      <div className="field" style={{ marginTop: 18 }}>
        <label htmlFor="av-url">Đường dẫn ảnh</label>
        <input id="av-url" className="tinput" value={url} maxLength={1024} placeholder="https://…/anh-dai-dien.jpg" autoFocus
          onChange={e => { setUrl(e.target.value); setError(''); setBroken(false); }} />
      </div>
      {valid && (
        <div className="row" style={{ gap: 12, marginBottom: 12 }}>
          <span className="avatar" style={{ width: 64, height: 64, overflow: 'hidden' }}>
            <img src={url.trim()} alt="Xem trước ảnh đại diện" onError={() => setBroken(true)} onLoad={() => setBroken(false)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </span>
          <span className="faint" style={{ fontSize: 13 }}>{broken ? 'Không tải được ảnh này.' : 'Xem trước'}</span>
        </div>
      )}
      <div className="form-actions"><button className="btn" disabled={busy}>{busy ? <Spinner /> : <Icon name="check" size={15} />} Lưu</button></div>
    </form>
  );
}

// identity soft-deletes and anonymises the account; the password proves it is the owner.
function DeleteAccountForm({ onDeleted }: { onDeleted: () => void }) {
  const [pw, setPw] = useState('');
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pw) { setFailure('Nhập mật khẩu để xác nhận.'); return; }
    setBusy(true); setFailure('');
    try { await userApi.deleteAccount(pw); onDeleted(); }
    catch (err) { setFailure(apiErrorMessage(err, 'Không xóa được tài khoản.')); setBusy(false); }
  };
  return (
    <form onSubmit={submit} noValidate>
      <p className="kicker">Vui lòng xác nhận</p>
      <h2>Xóa tài khoản của bạn?</h2>
      <p className="muted" style={{ marginTop: 8 }}>Bạn sẽ bị đăng xuất, họ tên, email và ảnh đại diện bị xóa. Không thể hoàn tác.</p>
      {failure && <div style={{ margin: '12px 0' }}><Alert>{failure}</Alert></div>}
      <div className="field" style={{ marginTop: 18 }}>
        <label htmlFor="da-pw">Mật khẩu</label>
        <input id="da-pw" className="tinput" type="password" autoComplete="current-password" value={pw}
          onChange={e => { setPw(e.target.value); setFailure(''); }} autoFocus />
      </div>
      <div className="form-actions">
        <button className="btn btn-danger" disabled={busy}>{busy ? <Spinner /> : <Icon name="trash" size={15} />} Xóa tài khoản</button>
      </div>
    </form>
  );
}
