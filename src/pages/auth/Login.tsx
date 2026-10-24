import { type FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Alert, Spinner } from '../../components/common';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import * as v from '../../lib/validation';
import { AuthLayout, Field, PasswordInput } from './AuthLayout';

export default function Login() {
  const { login } = useAuth();
  const { toast } = useUI();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({ email: '', password: '' });
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const fieldErrors = { email: v.email(email), password: v.required(password, 'Password') };
    setErrors(fieldErrors);
    if (!v.isValid(fieldErrors)) return;
    setFailure('');
    setBusy(true);
    try {
      const user = await login(email.trim(), password);
      toast(`Welcome back, ${user.fullName.split(' ').pop()}`);
      navigate(user.role === 'ADMIN' ? '/admin' : from || '/today', { replace: true });
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
      setBusy(false);
    }
  };

  return (
    <AuthLayout quote="“A hand is someone’s voice.” Pick up where you left off — your streak is waiting.">
      <p className="kicker">Welcome back</p>
      <h1 className="display sm">Sign <em>in</em>.</h1>
      <p className="lede">Your lessons, review queue and Studio scores are right where you left them.</p>
      {failure && <div style={{ marginBottom: 18 }}><Alert>{failure}</Alert></div>}
      <form onSubmit={submit} noValidate>
        <Field label="Email" error={errors.email}>
          <input className="tinput" type="email" autoComplete="email" placeholder="you@email.com" value={email} aria-label="Email"
            onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: '' })); setFailure(''); }} />
        </Field>
        <Field label="Password" error={errors.password}
          aside={<Link className="linkbtn" to="/forgot-password" style={{ fontSize: 13 }}>Forgot password?</Link>}>
          <PasswordInput label="Password" value={password} autoComplete="current-password" placeholder="••••••••"
            onChange={val => { setPassword(val); setErrors(p => ({ ...p, password: '' })); setFailure(''); }} />
        </Field>
        <div className="form-actions">
          <button className="btn btn-lacquer" type="submit" disabled={busy}>
            {busy ? <><Spinner /> Signing in…</> : <>Sign in <Icon name="arrowr" size={16} /></>}
          </button>
        </div>
      </form>
      <p className="auth-foot">New to SignMentor? <Link className="linkbtn" to="/register">Create an account</Link></p>
    </AuthLayout>
  );
}
