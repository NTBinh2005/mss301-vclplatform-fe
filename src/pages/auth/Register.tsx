import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Alert, Spinner } from '../../components/common';
import { useUI } from '../../context/UIContext';
import { authApi } from '../../services';
import { apiErrorMessage } from '../../api/errors';
import * as v from '../../lib/validation';
import { AuthLayout, Field, PasswordInput, useCountdown } from './AuthLayout';

/* Two steps, as in signmentor: details → email OTP. Registration does not sign
   the user in; they continue to the login page. */
export default function Register() {
  const navigate = useNavigate();
  const { toast } = useUI();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({ fullName: '', username: '', email: '', password: '' });
  const [errors, setErrors] = useState({ fullName: '', username: '', email: '', password: '' });
  const [otp, setOtp] = useState('');
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const timer = useCountdown(90);

  const set = (k: keyof typeof form) => (val: string) => {
    setForm(f => ({ ...f, [k]: val }));
    setErrors(e => ({ ...e, [k]: '' }));
    setFailure('');
  };

  const sendOtp = async () => {
    setBusy(true);
    setFailure('');
    try {
      await authApi.sendRegisterOtp(form.email.trim(), form.username.trim());
      setStep(2);
      timer.restart();
    } catch (err) {
      setFailure(apiErrorMessage(err, 'Could not send the code. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const submitDetails = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const fieldErrors = {
      fullName: v.fullName(form.fullName), username: v.username(form.username),
      email: v.email(form.email), password: v.password(form.password),
    };
    setErrors(fieldErrors);
    if (v.isValid(fieldErrors)) await sendOtp();
  };

  const submitOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (otp.length !== 6) { setFailure('The code has 6 digits.'); return; }
    setBusy(true);
    setFailure('');
    try {
      await authApi.register({
        fullName: form.fullName.trim(), username: form.username.trim(), email: form.email.trim(), password: form.password, otp,
      });
      toast('Account created. Sign in to start learning.');
      navigate('/login', { replace: true });
    } catch (err) {
      setFailure(apiErrorMessage(err, 'Registration failed. Check the code and try again.'));
      setBusy(false);
    }
  };

  return (
    <AuthLayout quote="“Learn five signs a day, use each one in a sentence, and film one attempt. Watch it back. Repeat.”">
      <div className="steps" aria-label={`Step ${step} of 2`}>
        <span className={`stepdot ${step > 1 ? 'done' : 'now'}`}>{step > 1 ? '✓' : 1}</span>
        <span className={`stepdot ${step === 2 ? 'now' : ''}`}>2</span>
      </div>
      <p className="kicker">{step === 1 ? 'Create your account' : 'Check your inbox'}</p>
      <h1 className="display sm">{step === 1 ? <>Start your <em>journey</em>.</> : <>Enter the <em>code</em>.</>}</h1>
      <p className="lede">
        {step === 1
          ? 'A few details, then we email you a 6-digit code to confirm it is really you.'
          : <>We sent a 6-digit code to <strong>{form.email}</strong>. Check spam too.</>}
      </p>
      {failure && <div style={{ marginBottom: 18 }}><Alert>{failure}</Alert></div>}

      {step === 1 ? (
        <form onSubmit={submitDetails} noValidate>
          <div className="form-grid">
            <Field label="Full name" error={errors.fullName}>
              <input className="tinput" autoComplete="name" placeholder="Nguyễn Minh Anh" value={form.fullName} aria-label="Full name"
                onChange={e => set('fullName')(e.target.value)} />
            </Field>
            <Field label="Username" error={errors.username}>
              <input className="tinput" autoComplete="username" placeholder="minhanh" value={form.username} aria-label="Username"
                onChange={e => set('username')(e.target.value)} />
            </Field>
          </div>
          <Field label="Email" error={errors.email}>
            <input className="tinput" type="email" autoComplete="email" placeholder="you@email.com" value={form.email} aria-label="Email"
              onChange={e => set('email')(e.target.value)} />
          </Field>
          <Field label="Password" error={errors.password} hint={v.PASSWORD_HINT}>
            <PasswordInput label="Password" value={form.password} autoComplete="new-password" onChange={set('password')} />
          </Field>
          <div className="form-actions">
            <button className="btn btn-lacquer" type="submit" disabled={busy}>
              {busy ? <><Spinner /> Sending code…</> : <>Continue <Icon name="arrowr" size={16} /></>}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={submitOtp} noValidate>
          <Field label="6-digit code">
            <input className="tinput otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="······"
              value={otp} aria-label="6-digit code" autoFocus
              onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); setFailure(''); }} />
          </Field>
          <div className="form-actions">
            <button className="btn btn-lacquer" type="submit" disabled={busy || otp.length < 6}>
              {busy ? <><Spinner /> Verifying…</> : <>Create account <Icon name="check" size={16} /></>}
            </button>
            <span className="spacer" />
            {timer.left > 0
              ? <span className="faint" style={{ fontSize: 13.5 }}>Resend in {timer.label}</span>
              : <button type="button" className="linkbtn" disabled={busy} onClick={sendOtp}>Resend code</button>}
          </div>
          <p style={{ marginTop: 16 }}>
            <button type="button" className="textlink" onClick={() => { setStep(1); setOtp(''); setFailure(''); }}>
              <Icon name="arrowl" size={14} /> Edit my details
            </button>
          </p>
        </form>
      )}
      <p className="auth-foot">Already have an account? <Link className="linkbtn" to="/login">Sign in</Link></p>
    </AuthLayout>
  );
}
