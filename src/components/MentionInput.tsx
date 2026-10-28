import { useEffect, useRef, useState } from 'react';
import { Avatar } from './common';
import { userApi } from '../services';
import type { UserSummary } from '../models';

export interface Mention { userId: number; username: string }

/* A one-line input that tags one person: type "@" and a few letters, pick a name,
   and the comment is sent with mentionedUserId so that person gets a MENTION
   notification. Deleting the "@name" text drops the tag again. */
export default function MentionInput({ value, mention, onChange, placeholder, label, autoFocus }: {
  value: string;
  mention: Mention | null;
  onChange: (text: string, mention: Mention | null) => void;
  placeholder: string;
  label: string;
  autoFocus?: boolean;
}) {
  const [found, setFound] = useState<UserSummary[]>([]);
  const [active, setActive] = useState(0);
  const seq = useRef(0);
  const token = /(^|\s)@([^\s@]{1,30})$/.exec(value)?.[2] ?? null;

  useEffect(() => {
    if (!token) { setFound([]); return; }
    const my = ++seq.current;
    const t = window.setTimeout(() => {
      userApi.search(token, 0, 6)
        .then(r => { if (my === seq.current) { setFound(r.content); setActive(0); } })
        .catch(() => { if (my === seq.current) setFound([]); });
    }, 250);
    return () => window.clearTimeout(t);
  }, [token]);

  const pick = (u: UserSummary) => {
    const text = value.replace(/@[^\s@]*$/, `@${u.username} `);
    onChange(text, { userId: u.userId, username: u.username });
    setFound([]);
  };

  const change = (text: string) => {
    // The tag only survives while its "@username" is still in the text.
    onChange(text, mention && text.includes(`@${mention.username}`) ? mention : null);
  };

  return (
    <span className="mention-wrap">
      <input value={value} placeholder={placeholder} aria-label={label} autoFocus={autoFocus} maxLength={2000}
        onChange={e => change(e.target.value)}
        onKeyDown={e => {
          if (!found.length) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => (a + 1) % found.length); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => (a - 1 + found.length) % found.length); }
          else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(found[active]); }
          else if (e.key === 'Escape') { e.stopPropagation(); setFound([]); }
        }} />
      {found.length > 0 && (
        <span className="mention-list" role="listbox" aria-label="People to mention">
          {found.map((u, i) => (
            <button type="button" key={u.userId} role="option" aria-selected={i === active} className={i === active ? 'on' : ''}
              onMouseDown={e => { e.preventDefault(); pick(u); }}>
              <Avatar name={u.fullName || u.username} url={u.avatarUrl} size={24} />
              <span><b>{u.fullName || u.username}</b> <span className="faint">@{u.username}</span></span>
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
