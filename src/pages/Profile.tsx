import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon, { type IconName } from '../components/Icon';
import { Hand } from '../components/Hand';
import { Alert, Loading, Spinner } from '../components/common';
import { useAuth } from '../context/AuthContext';
import { useLearning } from '../context/LearningContext';
import { useUI } from '../context/UIContext';
import { userApi } from '../services';
import { apiErrorMessage } from '../api/errors';
import type { PracticeStatsResponse } from '../models';
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

  useEffect(() => { const r = requestAnimationFrame(() => setDrawn(true)); return () => cancelAnimationFrame(r); }, []);
  useEffect(() => { userApi.profile().then(p => setEmailNotes(p.emailNotificationsEnabled ?? null)).catch(() => {}); }, []);

  if (L.loading || !user) return <section className="view"><Loading /></section>;

  const s = L.stats;
  const perCat = L.categories.map(c => {
    const all = L.signs.filter(x => x.categoryId === c.id);
    return { name: c.name, total: all.length, got: all.filter(x => x.status === 'learned').length };
  }).filter(c => c.total > 0);
  const week = s?.weekActivity?.length === 7 ? s.weekActivity : null;
  const weekLabels = lastSevenDays().map(d => d[0]);
  const joined = user.createdAt ? new Date(user.createdAt) : null;
  const since = joined && !Number.isNaN(joined.getTime()) ? joined.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : '';

  const setGoal = (d: number) => {
    const g = Math.min(10, Math.max(1, goal + d));
    updatePrefs({ goal: g });
    ui.toast(`Daily goal set to ${g}`, 'seal');
  };

  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await userApi.uploadAvatar(file);
      setUser({ ...user, avatarUrl: typeof url === 'string' ? url : user.avatarUrl });
      ui.toast('Photo updated');
    } catch (err) { ui.toast(apiErrorMessage(err, 'Could not upload the photo'), 'alert'); } finally { setUploading(false); }
  };

  const toggleEmail = async () => {
    const next = !emailNotes;
    try { await userApi.setEmailNotifications(next); setEmailNotes(next); ui.toast(next ? 'Email notifications on' : 'Email notifications off', 'mail'); }
    catch (err) { ui.toast(apiErrorMessage(err, 'Could not update notifications'), 'alert'); }
  };

  const deleteAccount = async () => {
    const ok = await ui.confirm({
      title: 'Delete your account?',
      body: 'Your progress, streak, achievements and posts will be removed for good. This cannot be undone.',
      confirmLabel: 'Delete account', danger: true,
    });
    if (!ok) return;
    try { await userApi.deleteAccount(); await logout(); navigate('/', { replace: true }); }
    catch (err) { ui.toast(apiErrorMessage(err, 'Could not delete the account'), 'alert'); }
  };

  return (
    <section className="view">
      <div className="prof-head">
        <span className="prof-hand" aria-hidden="true"><Hand frame={{ shape: 'flat', rot: -6 }} size={300} /></span>
        <div className="prof-avatar">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials(user.fullName)}
          <label>{uploading ? <Spinner /> : 'Change'}<input type="file" accept="image/*" className="sr-only" onChange={e => uploadAvatar(e.target.files?.[0])} /></label>
        </div>
        <div style={{ position: 'relative' }}>
          <p className="kicker">@{user.username} · {s ? `${s.proficiency}% proficiency` : 'Learner'}{since ? ` · since ${since}` : ''}</p>
          <h1 className="display sm">{user.fullName}</h1>
          <div className="goal-line">
            <Icon name="flag" size={16} /><span>Daily goal:</span>
            <span className="goal-stepper">
              <button onClick={() => setGoal(-1)} aria-label="Lower daily goal" disabled={goal <= 1}><Icon name="minus" size={14} /></button>
              <b style={{ minWidth: 92, textAlign: 'center', padding: '0 4px' }}>{goal} {goal === 1 ? 'activity' : 'activities'} / day</b>
              <button onClick={() => setGoal(1)} aria-label="Raise daily goal" disabled={goal >= 10}><Icon name="plus" size={14} /></button>
            </span>
            <span className="faint" style={{ fontSize: 13 }}>{L.activityToday} done today</span>
          </div>
        </div>
      </div>

      <div className="figs" role="list">
        <div className="fig" role="listitem"><b>{s?.learnedCount ?? 0}</b><span>signs learned</span></div>
        <div className="fig" role="listitem"><b>{s ? `${Math.round(s.accuracyRate)}%` : '—'}</b><span>accuracy</span></div>
        <div className="fig" role="listitem"><b>{s?.currentStreak ?? 0}</b><span>day streak</span></div>
        <div className="fig" role="listitem"><b>{s?.longestStreak ?? 0}</b><span>best streak</span></div>
        <div className="fig" role="listitem"><b>{s?.totalAttempts ?? 0}</b><span>studio attempts</span></div>
      </div>

      <div className="two-col">
        <div>
          <div className="rule-head"><h2>Skills</h2><span className="kicker">signs learned per topic</span></div>
          {perCat.length === 0 && <p className="muted">No topics yet.</p>}
          {perCat.map(c => (
            <div className="skill" key={c.name}>
              <span>{c.name}</span>
              <div className="skill-track"><div className="skill-fill" style={{ width: drawn ? `${Math.round((c.got / c.total) * 100)}%` : 0 }} /></div>
              <b style={{ textAlign: 'right' }}>{c.got}/{c.total}</b>
            </div>
          ))}

          {week && (
            <>
              <div className="rule-head"><h2>This week</h2><span className="kicker">days you practised</span></div>
              <div className="week">{week.map((on, i) => <span key={i}><i className={on ? 'on' : ''} />{weekLabels[i]}</span>)}</div>
            </>
          )}

          <div className="rule-head"><h2>Recent activity</h2></div>
          {L.attempts.length === 0 && <p className="muted">Your Studio attempts will show up here.</p>}
          {L.attempts.slice(0, 8).map(a => (
            <div className="timeline-item" key={a.attemptId}>
              <span>{a.isCorrect ? 'Signed' : 'Practised'} “{a.word}” in the Studio{a.confidence != null ? ` · ${Math.round(a.confidence)}%` : ''}</span>
              <time>{timeAgo(a.attemptedAt)}</time>
            </div>
          ))}
        </div>

        <aside>
          <div className="rule-head"><h2>Achievements</h2></div>
          <div className="stampgrid">
            {L.achievements.length === 0 && <p className="muted">Achievements appear after your first attempt.</p>}
            {L.achievements.map(a => {
              const prog = s && PROGRESS[a.key] ? PROGRESS[a.key](s) : null;
              return (
                <div key={a.id} className={`ach ${a.unlocked ? '' : 'locked'}`} title={a.description}>
                  <span className="ach-stamp"><Icon name={ACH_ICON[a.key] || 'star'} size={26} /></span>
                  <b>{a.name}</b>
                  <span>{a.unlocked ? `Earned ${a.unlockedAt ? timeAgo(a.unlockedAt) : ''}` : prog ? `${a.description} · ${Math.min(prog[0], prog[1])}/${prog[1]}` : a.description}</span>
                </div>
              );
            })}
          </div>

          <div className="rule-head"><h2>Settings</h2></div>
          <div className="settings-row">
            <span style={{ flex: 1 }}>Reduce motion<br /><small style={{ color: 'var(--ink-2)' }}>Pauses auto-play and decorative animation</small></span>
            <button className="switch" role="switch" aria-checked={reduceMotion} aria-label="Reduce motion"
              onClick={() => { updatePrefs({ reduceMotion: !reduceMotion }); ui.toast(!reduceMotion ? 'Motion reduced' : 'Motion restored'); }} />
          </div>
          {emailNotes !== null && (
            <div className="settings-row">
              <span style={{ flex: 1 }}>Email notifications<br /><small style={{ color: 'var(--ink-2)' }}>Mentions and shares from the common room</small></span>
              <button className="switch" role="switch" aria-checked={emailNotes} aria-label="Email notifications" onClick={toggleEmail} />
            </div>
          )}
          <div className="settings-row">
            <span style={{ flex: 1 }}>Profile details<br /><small style={{ color: 'var(--ink-2)' }}>Name, username and email</small></span>
            <button className="btn btn-ghost btn-sm" onClick={() => ui.openModal(<ProfileForm />, 'Edit profile')}><Icon name="edit" size={14} /> Edit</button>
          </div>
          <div className="settings-row">
            <span style={{ flex: 1 }}>Password<br /><small style={{ color: 'var(--ink-2)' }}>Change the password you sign in with</small></span>
            <button className="btn btn-ghost btn-sm" onClick={() => ui.openModal(<PasswordForm />, 'Change password')}><Icon name="lock" size={14} /> Change</button>
          </div>
          <div className="settings-row">
            <span style={{ flex: 1 }}>Sign out<br /><small style={{ color: 'var(--ink-2)' }}>Your progress is saved to your account</small></span>
            <button className="btn btn-ghost btn-sm" onClick={async () => { await logout(); navigate('/', { replace: true }); }}><Icon name="logout" size={14} /> Sign out</button>
          </div>
          <div className="settings-row">
            <span style={{ flex: 1, color: 'var(--lacquer-2)' }}>Delete account<br /><small style={{ color: 'var(--ink-2)' }}>Permanently removes your account and progress</small></span>
            <button className="btn btn-ghost btn-sm btn-danger-ghost" onClick={deleteAccount}><Icon name="trash" size={14} /> Delete</button>
          </div>
        </aside>
      </div>
    </section>
  );
}

function ProfileForm() {
  const { user, setUser } = useAuth();
  const ui = useUI();
  const [f, setF] = useState({ fullName: user?.fullName || '', username: user?.username || '', email: user?.email || '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const fieldErrors = { fullName: v.fullName(f.fullName), username: v.username(f.username), email: v.email(f.email) };
    setErrors(fieldErrors);
    if (!v.isValid(fieldErrors)) return;
    setBusy(true); setFailure('');
    try {
      const updated = await userApi.updateProfile({ fullName: f.fullName.trim(), username: f.username.trim(), email: f.email.trim() });
      setUser({ ...user!, ...updated });
      ui.closeLayer();
      ui.toast('Profile saved');
    } catch (err) { setFailure(apiErrorMessage(err, 'Could not save your profile.')); setBusy(false); }
  };

  const input = (k: keyof typeof f, label: string, type = 'text') => (
    <div className={`field ${errors[k] ? 'invalid' : ''}`}>
      <label htmlFor={`pf-${k}`}>{label}</label>
      <input id={`pf-${k}`} className="tinput" type={type} value={f[k]} onChange={e => { setF(p => ({ ...p, [k]: e.target.value })); setErrors(p => ({ ...p, [k]: '' })); }} />
      {errors[k] && <span className="err">{errors[k]}</span>}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate>
      <p className="kicker">Account</p>
      <h2>Profile details</h2>
      {failure && <div style={{ margin: '12px 0' }}><Alert>{failure}</Alert></div>}
      <div style={{ marginTop: 18 }}>
        {input('fullName', 'Full name')}
        {input('username', 'Username')}
        {input('email', 'Email', 'email')}
      </div>
      <div className="form-actions"><button className="btn" disabled={busy}>{busy ? <Spinner /> : <Icon name="check" size={15} />} Save</button></div>
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
      old: v.required(oldPw, 'Current password'),
      pw: v.password(pw),
      pw2: pw !== pw2 ? 'The two passwords do not match.' : '',
    };
    setErrors(fieldErrors);
    if (!v.isValid(fieldErrors)) return;
    setBusy(true); setFailure('');
    try {
      await userApi.updatePassword({ oldPassword: oldPw, newPassword: pw });
      ui.closeLayer();
      ui.toast('Password changed', 'lock');
    } catch (err) { setFailure(apiErrorMessage(err, 'Could not change the password.')); setBusy(false); }
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
      <p className="kicker">Security</p>
      <h2>Change password</h2>
      {failure && <div style={{ margin: '12px 0' }}><Alert>{failure}</Alert></div>}
      <div style={{ marginTop: 18 }}>
        {row('old', 'Current password', oldPw, setOldPw)}
        {row('pw', 'New password', pw, setPw, '8–12 characters, with upper case, lower case and a number.')}
        {row('pw2', 'Repeat new password', pw2, setPw2)}
      </div>
      <div className="form-actions"><button className="btn" disabled={busy}>{busy ? <Spinner /> : <Icon name="lock" size={15} />} Change password</button></div>
    </form>
  );
}
