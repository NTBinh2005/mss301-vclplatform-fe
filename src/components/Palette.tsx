import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon, { type IconName } from './Icon';
import ReviewSession from './ReviewSession';
import { useLearning } from '../context/LearningContext';
import { useUI } from '../context/UIContext';

interface Cmd { label: string; icon: IconName; run: () => void }

export default function Palette() {
  const navigate = useNavigate();
  const ui = useUI();
  const { signs, due, nextLesson } = useLearning();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);

  const groups = useMemo(() => {
    const lq = q.trim().toLowerCase();
    const go = (path: string) => () => { ui.closeLayer(); navigate(path); };
    const nav: Cmd[] = ([
      ['Today', '/today', 'home'], ['Journey', '/learn', 'book'], ['Dictionary', '/dictionary', 'grid'],
      ['Studio', '/studio', 'video'], ['Common room', '/community', 'users'], ['My posts', '/community/mine', 'edit'],
      ['Request a sign', '/request', 'plus'], ['Profile', '/profile', 'user'],
    ] as [string, string, IconName][])
      .filter(([l]) => !lq || l.toLowerCase().includes(lq))
      .map(([label, path, icon]) => ({ label, icon, run: go(path) }));

    const actions: Cmd[] = [];
    if (nextLesson && (!lq || 'continue lesson'.includes(lq))) {
      actions.push({ label: `Continue Lesson ${nextLesson.n}`, icon: 'play', run: go(`/lesson/${nextLesson.id}`) });
    }
    if (due.length && (!lq || 'review'.includes(lq))) {
      actions.push({ label: `Review ${due.length} due signs`, icon: 'refresh', run: () => ui.openModal(<ReviewSession queue={due} />, 'Review') });
    }
    if (!lq || 'studio practice'.includes(lq)) actions.push({ label: 'Practise in the Studio', icon: 'camera', run: go('/studio') });
    if (!lq || 'mentor ask'.includes(lq)) actions.push({ label: 'Ask Mentor', icon: 'send', run: () => ui.openMentor() });

    const signCmds: Cmd[] = lq
      ? signs.filter(s => s.word.toLowerCase().includes(lq) || s.categoryName.toLowerCase().includes(lq)).slice(0, 6)
        .map(s => ({ label: `Practise “${s.word}”`, icon: 'video' as IconName, run: go(`/studio?sign=${s.id}`) }))
      : [];

    return [
      { name: 'Go to', items: nav },
      { name: 'Actions', items: actions },
      { name: 'Signs', items: signCmds },
    ].filter(g => g.items.length);
  }, [q, signs, due, nextLesson, navigate, ui]);

  const flat = groups.flatMap(g => g.items);
  const current = Math.min(sel, Math.max(0, flat.length - 1));

  return (
    <div className="palette" role="dialog" aria-modal="true" aria-label="Search and commands">
      <input
        placeholder="Where to? Try “studio”, “review”, or a sign…"
        value={q}
        aria-label="Search commands"
        onChange={e => { setQ(e.target.value); setSel(0); }}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setSel(Math.min(current + 1, flat.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setSel(Math.max(0, current - 1)); }
          if (e.key === 'Enter') flat[current]?.run();
        }}
      />
      <div className="pal-list">
        {flat.length === 0 && (
          <p style={{ padding: 22, color: 'var(--ink-2)' }}>
            No matches. Mentor can probably still help — <button className="textlink" onClick={() => ui.openMentor(q)}>ask them</button>.
          </p>
        )}
        {groups.map(g => (
          <div key={g.name}>
            <p className="pal-group">{g.name}</p>
            {g.items.map(it => {
              const idx = flat.indexOf(it);
              return (
                <button key={it.label} className={`pal-item ${idx === current ? 'sel' : ''}`} onMouseEnter={() => setSel(idx)} onClick={it.run}>
                  <Icon name={it.icon} size={17} /><span>{it.label}</span>{idx === current && <span className="kicker">↵ enter</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
