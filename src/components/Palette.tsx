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
      ['Hôm nay', '/today', 'home'], ['Lộ trình', '/learn', 'book'], ['Từ điển', '/dictionary', 'grid'],
      ['Phòng tập', '/studio', 'video'], ['Cộng đồng', '/community', 'users'], ['Bài viết của tôi', '/community/mine', 'edit'],
      ['Đề xuất ký hiệu', '/request', 'plus'], ['Hồ sơ', '/profile', 'user'],
    ] as [string, string, IconName][])
      .filter(([l]) => !lq || l.toLowerCase().includes(lq))
      .map(([label, path, icon]) => ({ label, icon, run: go(path) }));

    const actions: Cmd[] = [];
    if (nextLesson && (!lq || 'học tiếp bài'.includes(lq))) {
      actions.push({ label: `Học tiếp bài ${nextLesson.n}`, icon: 'play', run: go(`/lesson/${nextLesson.id}`) });
    }
    if (due.length && (!lq || 'ôn tập'.includes(lq))) {
      actions.push({ label: `Ôn ${due.length} ký hiệu cần ôn`, icon: 'refresh', run: () => ui.openModal(<ReviewSession queue={due} />, 'Ôn tập') });
    }
    if (!lq || 'phòng tập luyện'.includes(lq)) actions.push({ label: 'Luyện trong Phòng tập', icon: 'camera', run: go('/studio') });
    if (!lq || 'hỏi mentor'.includes(lq)) actions.push({ label: 'Hỏi Mentor', icon: 'send', run: () => ui.openMentor() });

    const signCmds: Cmd[] = lq
      ? signs.filter(s => s.word.toLowerCase().includes(lq) || s.categoryName.toLowerCase().includes(lq)).slice(0, 6)
        .map(s => ({ label: `Luyện “${s.word}”`, icon: 'video' as IconName, run: go(`/studio?sign=${s.id}`) }))
      : [];

    return [
      { name: 'Đi tới', items: nav },
      { name: 'Thao tác', items: actions },
      { name: 'Ký hiệu', items: signCmds },
    ].filter(g => g.items.length);
  }, [q, signs, due, nextLesson, navigate, ui]);

  const flat = groups.flatMap(g => g.items);
  const current = Math.min(sel, Math.max(0, flat.length - 1));

  return (
    <div className="palette" role="dialog" aria-modal="true" aria-label="Tìm kiếm và lệnh">
      <input
        placeholder="Đi đâu? Thử “phòng tập”, “ôn tập”, hoặc một ký hiệu…"
        value={q}
        aria-label="Tìm lệnh"
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
            Không tìm thấy. Có lẽ Mentor vẫn giúp được — <button className="textlink" onClick={() => ui.openMentor(q)}>hỏi Mentor</button>.
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
