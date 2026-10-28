import { type ReactNode, useEffect, useState } from 'react';
import Icon from '../../components/Icon';
import { Hand } from '../../components/Hand';
import { Brand } from '../../components/common';

export function AuthLayout({ quote, children }: { quote: ReactNode; children: ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-art">
        <Brand />
        <span className="hero-hand" aria-hidden="true"><Hand frame={{ shape: 'open', rot: 10 }} size={520} /></span>
        <blockquote>{quote}</blockquote>
      </aside>
      <main className="auth-main" id="app">
        <div className="auth-card">
          <div className="auth-mobile-brand"><Brand /></div>
          {children}
        </div>
      </main>
    </div>
  );
}

interface FieldProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}

export function Field({ label, error, hint, aside, children }: FieldProps) {
  return (
    <div className={`field ${error ? 'invalid' : ''}`}>
      <div className="row" style={{ justifyContent: 'space-between' }}><span className="label">{label}</span>{aside}</div>
      {children}
      {error ? <span className="err">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function PasswordInput(props: { value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string; label: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-wrap">
      <input className="tinput" type={show ? 'text' : 'password'} value={props.value} placeholder={props.placeholder}
        autoComplete={props.autoComplete} aria-label={props.label} onChange={e => props.onChange(e.target.value)} />
      <button type="button" className="iconbtn" onClick={() => setShow(s => !s)} aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} tabIndex={-1}>
        <Icon name={show ? 'eyeoff' : 'eye'} size={17} />
      </button>
    </div>
  );
}

/* Seconds until an OTP may be re-sent; restart() after every send. */
export function useCountdown(seconds: number) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const t = window.setTimeout(() => setLeft(l => l - 1), 1000);
    return () => window.clearTimeout(t);
  }, [left]);
  return { left, restart: () => setLeft(seconds), label: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` };
}
