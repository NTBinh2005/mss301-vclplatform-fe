import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Alert, Spinner } from '../../components/common';
import { useUI } from '../../context/UIContext';
import { authApi } from '../../services';
import { apiErrorMessage } from '../../api/errors';
import * as v from '../../lib/validation';
import { AuthLayout, Field, PasswordInput, useCountdown } from './AuthLayout';

/* Three steps, as in signmentor: email → OTP → new password. */
export default function ForgotPassword() {
  const navigate = useNavigate();
  const { toast } = useUI();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const timer = useCountdown(90);

  const run = async (fn: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setFailure('');
    try { await fn(); } catch (err) { setFailure(apiErrorMessage(err, fallback)); } finally { setBusy(false); }
  };

  const sendCode = (e?: FormEvent) => {
    e?.preventDefault();
    const err = v.email(email);
    setErrors({ email: err });
    if (err || busy) return;
    run(async () => { await authApi.forgotPassword(email.trim()); setStep(2); timer.restart(); },
      'Could not send the code. Check the email address.');
  };

  const verify = (e: FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) { setErrors({ otp: 'Enter the 6-digit code.' }); return; }
    setErrors({});
    run(async () => { await authApi.verifyOtp(email.trim(), otp); setStep(3); }, 'That code is invalid or has expired.');
  };

  const reset = (e: FormEvent) => {
    e.preventDefault();
    const fieldErrors = { password: v.password(pw), confirm: pw !== pw2 ? 'The two passwords do not match.' : '' };
    setErrors(fieldErrors);
    if (!v.isValid(fieldErrors)) return;
    run(async () => {
      await authApi.resetPassword(email.trim(), otp, pw);
      toast('Password updated. Sign in with your new password.');
      navigate('/login', { replace: true });
    }, 'Could not reset the password. Please try again.');
  };

  const titles = {
    1: { k: 'Forgot your password?', h: <>Let’s get you <em>back in</em>.</>, l: 'Enter your account email and we will send a 6-digit recovery code.' },
    2: { k: 'Check your inbox', h: <>Enter the <em>code</em>.</>, l: <>We sent it to <strong>{email}</strong>. Check spam too.</> },
    3: { k: 'Almost there', h: <>Choose a new <em>password</em>.</>, l: 'Make it one you have not used here before.' },
  }[step];

  return (
    <AuthLayout quote="“Being stuck is data, not failure.” Recover your account and keep your streak alive.">
      <div className="steps" aria-label={`Step ${step} of 3`}>
        {[1, 2, 3].map(n => <span key={n} className={`stepdot ${n < step ? 'done' : n === step ? 'now' : ''}`}>{n < step ? '✓' : n}</span>)}
      </div>
      <p className="kicker">{titles.k}</p>
      <h1 className="display sm">{titles.h}</h1>
      <p className="lede">{titles.l}</p>
      {failure && <div style={{ marginBottom: 18 }}><Alert>{failure}</Alert></div>}

      {step === 1 && (
        <form onSubmit={sendCode} noValidate>
          <Field label="Email" error={errors.email}>
            <input className="tinput" type="email" autoComplete="email" placeholder="you@email.com" value={email} aria-label="Email"
              onChange={e => { setEmail(e.target.value); setErrors({}); setFailure(''); }} />
          </Field>
          <div className="form-actions">
            <button className="btn btn-lacquer" disabled={busy}>{busy ? <><Spinner /> Sending…</> : <>Send code <Icon name="arrowr" size={16} /></>}</button>
          </div>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={verify} noValidate>
          <Field label="6-digit code" error={errors.otp}>
            <input className="tinput otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="······" autoFocus
              value={otp} aria-label="6-digit code" onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); setErrors({}); setFailure(''); }} />
          </Field>
          <div className="form-actions">
            <button className="btn btn-lacquer" disabled={busy || otp.length !== 6}>{busy ? <><Spinner /> Checking…</> : <>Verify <Icon name="check" size={16} /></>}</button>
            <span className="spacer" />
            {timer.left > 0
              ? <span className="faint" style={{ fontSize: 13.5 }}>Resend in {timer.label}</span>
              : <button type="button" className="linkbtn" disabled={busy} onClick={() => sendCode()}>Resend code</button>}
          </div>
          <p style={{ marginTop: 16 }}><button type="button" className="textlink" onClick={() => setStep(1)}><Icon name="arrowl" size={14} /> Use another email</button></p>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={reset} noValidate>
          <Field label="New password" error={errors.password} hint="8–12 characters, with upper case, lower case and a number.">
            <PasswordInput label="New password" value={pw} autoComplete="new-password" onChange={val => { setPw(val); setErrors({}); }} />
          </Field>
          <Field label="Repeat new password" error={errors.confirm}>
            <PasswordInput label="Repeat new password" value={pw2} autoComplete="new-password" onChange={val => { setPw2(val); setErrors({}); }} />
          </Field>
          <div className="form-actions">
            <button className="btn btn-lacquer" disabled={busy}>{busy ? <><Spinner /> Saving…</> : <>Update password <Icon name="check" size={16} /></>}</button>
          </div>
        </form>
      )}
      <p className="auth-foot">Remembered it? <Link className="linkbtn" to="/login">Back to sign in</Link></p>
    </AuthLayout>
  );
}
