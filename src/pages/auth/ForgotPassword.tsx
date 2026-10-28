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
      'Không gửi được mã. Hãy kiểm tra lại địa chỉ email.');
  };

  const verify = (e: FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) { setErrors({ otp: 'Nhập mã 6 chữ số.' }); return; }
    setErrors({});
    run(async () => { await authApi.verifyOtp(email.trim(), otp); setStep(3); }, 'Mã không đúng hoặc đã hết hạn.');
  };

  const reset = (e: FormEvent) => {
    e.preventDefault();
    const fieldErrors = { password: v.password(pw), confirm: pw !== pw2 ? 'Hai mật khẩu không khớp.' : '' };
    setErrors(fieldErrors);
    if (!v.isValid(fieldErrors)) return;
    run(async () => {
      await authApi.resetPassword(email.trim(), otp, pw);
      toast('Đã đặt lại mật khẩu. Hãy đăng nhập bằng mật khẩu mới.');
      navigate('/login', { replace: true });
    }, 'Không đặt lại được mật khẩu. Vui lòng thử lại.');
  };

  const titles = {
    1: { k: 'Quên mật khẩu?', h: <>Cùng lấy lại <em>tài khoản</em>.</>, l: 'Nhập email tài khoản, chúng tôi sẽ gửi mã khôi phục 6 chữ số.' },
    2: { k: 'Kiểm tra hộp thư', h: <>Nhập <em>mã xác nhận</em>.</>, l: <>Chúng tôi đã gửi tới <strong>{email}</strong>. Nhớ kiểm tra cả thư rác.</> },
    3: { k: 'Sắp xong rồi', h: <>Chọn <em>mật khẩu</em> mới.</>, l: 'Nên là mật khẩu bạn chưa từng dùng ở đây.' },
  }[step];

  return (
    <AuthLayout quote="“Bế tắc là dữ liệu, không phải thất bại.” Lấy lại tài khoản và giữ chuỗi ngày học.">
      <div className="steps" aria-label={`Bước ${step}/3`}>
        {[1, 2, 3].map(n => <span key={n} className={`stepdot ${n < step ? 'done' : n === step ? 'now' : ''}`}>{n < step ? '✓' : n}</span>)}
      </div>
      <p className="kicker">{titles.k}</p>
      <h1 className="display sm">{titles.h}</h1>
      <p className="lede">{titles.l}</p>
      {failure && <div style={{ marginBottom: 18 }}><Alert>{failure}</Alert></div>}

      {step === 1 && (
        <form onSubmit={sendCode} noValidate>
          <Field label="Email" error={errors.email}>
            <input className="tinput" type="email" autoComplete="email" placeholder="ban@email.com" value={email} aria-label="Email"
              onChange={e => { setEmail(e.target.value); setErrors({}); setFailure(''); }} />
          </Field>
          <div className="form-actions">
            <button className="btn btn-lacquer" disabled={busy}>{busy ? <><Spinner /> Đang gửi…</> : <>Gửi mã <Icon name="arrowr" size={16} /></>}</button>
          </div>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={verify} noValidate>
          <Field label="Mã 6 chữ số" error={errors.otp}>
            <input className="tinput otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="······" autoFocus
              value={otp} aria-label="Mã 6 chữ số" onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); setErrors({}); setFailure(''); }} />
          </Field>
          <div className="form-actions">
            <button className="btn btn-lacquer" disabled={busy || otp.length !== 6}>{busy ? <><Spinner /> Đang kiểm tra…</> : <>Xác minh <Icon name="check" size={16} /></>}</button>
            <span className="spacer" />
            {timer.left > 0
              ? <span className="faint" style={{ fontSize: 13.5 }}>Gửi lại sau {timer.label}</span>
              : <button type="button" className="linkbtn" disabled={busy} onClick={() => sendCode()}>Gửi lại mã</button>}
          </div>
          <p style={{ marginTop: 16 }}><button type="button" className="textlink" onClick={() => setStep(1)}><Icon name="arrowl" size={14} /> Dùng email khác</button></p>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={reset} noValidate>
          <Field label="Mật khẩu mới" error={errors.password} hint={v.PASSWORD_HINT}>
            <PasswordInput label="Mật khẩu mới" value={pw} autoComplete="new-password" onChange={val => { setPw(val); setErrors({}); }} />
          </Field>
          <Field label="Nhập lại mật khẩu mới" error={errors.confirm}>
            <PasswordInput label="Nhập lại mật khẩu mới" value={pw2} autoComplete="new-password" onChange={val => { setPw2(val); setErrors({}); }} />
          </Field>
          <div className="form-actions">
            <button className="btn btn-lacquer" disabled={busy}>{busy ? <><Spinner /> Đang lưu…</> : <>Cập nhật mật khẩu <Icon name="check" size={16} /></>}</button>
          </div>
        </form>
      )}
      <p className="auth-foot">Nhớ ra rồi? <Link className="linkbtn" to="/login">Quay lại đăng nhập</Link></p>
    </AuthLayout>
  );
}
