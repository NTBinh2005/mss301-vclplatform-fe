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
    const fieldErrors = { email: v.required(email, 'Tên đăng nhập hoặc email'), password: v.required(password, 'Mật khẩu') };
    setErrors(fieldErrors);
    if (!v.isValid(fieldErrors)) return;
    setFailure('');
    setBusy(true);
    try {
      const user = await login(email.trim(), password);
      toast(`Chào mừng trở lại, ${(user.fullName || user.username).split(' ').pop()}`);
      navigate(user.role === 'ADMIN' ? '/admin' : from || '/today', { replace: true });
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Đăng nhập thất bại. Vui lòng thử lại.');
      setBusy(false);
    }
  };

  return (
    <AuthLayout quote="“Đôi tay là tiếng nói của một người.” Tiếp tục từ chỗ bạn dừng lại — chuỗi ngày học đang chờ.">
      <p className="kicker">Chào mừng trở lại</p>
      <h1 className="display sm"><em>Đăng nhập</em>.</h1>
      <p className="lede">Bài học, hàng đợi ôn tập và điểm Phòng tập vẫn ở nguyên chỗ bạn để lại.</p>
      {failure && <div style={{ marginBottom: 18 }}><Alert>{failure}</Alert></div>}
      <form onSubmit={submit} noValidate>
        <Field label="Tên đăng nhập hoặc email" error={errors.email}>
          <input className="tinput" autoComplete="username" placeholder="minhanh hoặc ban@email.com" value={email} aria-label="Tên đăng nhập hoặc email"
            onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: '' })); setFailure(''); }} />
        </Field>
        <Field label="Mật khẩu" error={errors.password}
          aside={<Link className="linkbtn" to="/forgot-password" style={{ fontSize: 13 }}>Quên mật khẩu?</Link>}>
          <PasswordInput label="Mật khẩu" value={password} autoComplete="current-password" placeholder="••••••••"
            onChange={val => { setPassword(val); setErrors(p => ({ ...p, password: '' })); setFailure(''); }} />
        </Field>
        <div className="form-actions">
          <button className="btn btn-lacquer" type="submit" disabled={busy}>
            {busy ? <><Spinner /> Đang đăng nhập…</> : <>Đăng nhập <Icon name="arrowr" size={16} /></>}
          </button>
        </div>
      </form>
      <p className="auth-foot">Mới đến SignMentor? <Link className="linkbtn" to="/register">Tạo tài khoản</Link></p>
    </AuthLayout>
  );
}
