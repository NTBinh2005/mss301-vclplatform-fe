import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Hand, SignPlayer } from './Hand';
import Icon, { type IconName } from './Icon';
import type { Sign, SignStatus } from '../lib/signs';
import { initials } from '../lib/format';

export function Brand({ to = '/' }: { to?: string }) {
  return (
    <Link className="brand" to={to} aria-label="SignMentor home">
      <span className="brand-mark"><Hand frame={{ shape: 'open', rot: -16 }} size={19} /></span>
      <span>Sign<em>Mentor</em></span>
    </Link>
  );
}

/* The large demonstration of a sign: the tutorial video when the backend has one,
   then the still image, then the generative flipbook. */
export function SignMedia({ sign, size = 220, autoplay = true }: { sign: Sign; size?: number; autoplay?: boolean }) {
  if (sign.videoUrl) {
    return (
      <div className="media-frame has-video">
        <video key={sign.id} className="sign-video" src={sign.videoUrl} poster={sign.imageUrl || undefined}
          autoPlay={autoplay} muted loop playsInline controls />
      </div>
    );
  }
  if (sign.imageUrl) {
    return <div className="media-frame has-video"><img className="sign-img" src={sign.imageUrl} alt={`The sign for ${sign.word}`} /></div>;
  }
  return <div className="media-frame"><SignPlayer frames={sign.frames} size={size} autoplay={autoplay} /></div>;
}

/* Small thumbnail: still image if there is one, else a hand that plays on hover. */
export function SignThumb({ sign, size = 72 }: { sign: Sign; size?: number }) {
  if (sign.imageUrl) return <span className="thumb" style={{ width: size, height: size }}><img src={sign.imageUrl} alt="" /></span>;
  return <SignPlayer frames={sign.frames} size={size} hover chrome={false} />;
}

const STATUS: Record<SignStatus, [string, IconName]> = {
  learned: ['Learned', 'check'],
  learning: ['Learning', 'refresh'],
  new: ['New', 'plus'],
};

export function StatusTag({ status }: { status: SignStatus }) {
  const [label, icon] = STATUS[status];
  return <span className="status"><Icon name={icon} size={13} /> {label}</span>;
}

export function EmptyState({ title, body, action }: { title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <span style={{ opacity: 0.35, display: 'inline-block' }}><Hand frame={{ shape: 'open', rot: -8 }} size={64} /></span>
      <h3>{title}</h3>
      <p>{body}</p>
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div className="loading-block"><span className="spin" /> {label}</div>;
}

export function Alert({ kind = 'err', children }: { kind?: 'err' | 'ok' | 'info'; children: ReactNode }) {
  return (
    <div className={`alert ${kind === 'info' ? '' : kind}`} role={kind === 'err' ? 'alert' : 'status'}>
      <Icon name={kind === 'ok' ? 'check' : 'alert'} size={17} /><span>{children}</span>
    </div>
  );
}

export function Avatar({ name, url, size, className = 'avatar' }: { name?: string | null; url?: string | null; size?: number; className?: string }) {
  const style = size ? { width: size, height: size, fontSize: size * 0.34 } : undefined;
  return <span className={className} style={style} aria-hidden="true">{url ? <img src={url} alt="" /> : initials(name)}</span>;
}

export function Spinner() {
  return <span className="spin" aria-hidden="true" />;
}
