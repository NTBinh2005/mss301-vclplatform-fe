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
      setFailure(apiErrorMessage(err, 'Không gửi được mã. Vui lòng thử lại.'));
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
    if (otp.length !== 6) { setFailure('Mã gồm 6 chữ số.'); return; }
    setBusy(true);
    setFailure('');
    try {
      await authApi.register({
        fullName: form.fullName.trim(), username: form.username.trim(), email: form.email.trim(), password: form.password, otp,
      });
      toast('Đã tạo tài khoản. Đăng nhập để bắt đầu học.');
      navigate('/login', { replace: true });
    } catch (err) {
      setFailure(apiErrorMessage(err, 'Đăng ký thất bại. Kiểm tra lại mã và thử lại.'));
      setBusy(false);
    }
  };

  return (
    <AuthLayout quote="“Mỗi ngày học năm ký hiệu, dùng mỗi ký hiệu trong một câu, quay lại một lần tập. Xem lại. Lặp lại.”">
      <div className="steps" aria-label={`Bước ${step}/2`}>
        <span className={`stepdot ${step > 1 ? 'done' : 'now'}`}>{step > 1 ? '✓' : 1}</span>
        <span className={`stepdot ${step === 2 ? 'now' : ''}`}>2</span>
      </div>
      <p className="kicker">{step === 1 ? 'Tạo tài khoản' : 'Kiểm tra hộp thư'}</p>
      <h1 className="display sm">{step === 1 ? <>Bắt đầu <em>hành trình</em>.</> : <>Nhập <em>mã xác nhận</em>.</>}</h1>
      <p className="lede">
        {step === 1
          ? 'Điền vài thông tin, rồi chúng tôi gửi mã 6 chữ số qua email để xác nhận đúng là bạn.'
          : <>Chúng tôi đã gửi mã 6 chữ số tới <strong>{form.email}</strong>. Nhớ kiểm tra cả thư rác.</>}
      </p>
      {failure && <div style={{ marginBottom: 18 }}><Alert>{failure}</Alert></div>}

      {step === 1 ? (
        <form onSubmit={submitDetails} noValidate>
          <div className="form-grid">
            <Field label="Họ và tên" error={errors.fullName}>
              <input className="tinput" autoComplete="name" placeholder="Nguyễn Minh Anh" value={form.fullName} aria-label="Họ và tên"
                onChange={e => set('fullName')(e.target.value)} />
            </Field>
            <Field label="Tên đăng nhập" error={errors.username}>
              <input className="tinput" autoComplete="username" placeholder="minhanh" value={form.username} aria-label="Tên đăng nhập"
                onChange={e => set('username')(e.target.value)} />
            </Field>
          </div>
          <Field label="Email" error={errors.email}>
            <input className="tinput" type="email" autoComplete="email" placeholder="ban@email.com" value={form.email} aria-label="Email"
              onChange={e => set('email')(e.target.value)} />
          </Field>
          <Field label="Mật khẩu" error={errors.password} hint={v.PASSWORD_HINT}>
            <PasswordInput label="Mật khẩu" value={form.password} autoComplete="new-password" onChange={set('password')} />
          </Field>
          <div className="form-actions">
            <button className="btn btn-lacquer" type="submit" disabled={busy}>
              {busy ? <><Spinner /> Đang gửi mã…</> : <>Tiếp tục <Icon name="arrowr" size={16} /></>}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={submitOtp} noValidate>
          <Field label="Mã 6 chữ số">
            <input className="tinput otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="······"
              value={otp} aria-label="Mã 6 chữ số" autoFocus
              onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); setFailure(''); }} />
          </Field>
          <div className="form-actions">
            <button className="btn btn-lacquer" type="submit" disabled={busy || otp.length < 6}>
              {busy ? <><Spinner /> Đang xác minh…</> : <>Tạo tài khoản <Icon name="check" size={16} /></>}
            </button>
            <span className="spacer" />
            {timer.left > 0
              ? <span className="faint" style={{ fontSize: 13.5 }}>Gửi lại sau {timer.label}</span>
              : <button type="button" className="linkbtn" disabled={busy} onClick={sendOtp}>Gửi lại mã</button>}
          </div>
          <p style={{ marginTop: 16 }}>
            <button type="button" className="textlink" onClick={() => { setStep(1); setOtp(''); setFailure(''); }}>
              <Icon name="arrowl" size={14} /> Sửa thông tin
            </button>
          </p>
        </form>
      )}
      <p className="auth-foot">Đã có tài khoản? <Link className="linkbtn" to="/login">Đăng nhập</Link></p>
    </AuthLayout>
  );
}
