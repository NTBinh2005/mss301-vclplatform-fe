import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon';
import ReviewSession from '../components/ReviewSession';
import { Alert, ArtBanner, EmptyState, Loading, SignMedia, SignThumb, StatusTag } from '../components/common';
import { useLearning } from '../context/LearningContext';
import { useUI } from '../context/UIContext';
import { timeAgo } from '../lib/format';
import { updatePrefs, usePrefs } from '../lib/prefs';
import type { Sign, SignStatus } from '../lib/signs';

type StatusFilter = 'all' | SignStatus | 'favs';
const STATUS_LABEL: Record<SignStatus, string> = { new: 'Mới', learning: 'Đang học', learned: 'Đã thuộc' };

export default function Dictionary() {
  const L = useLearning();
  const ui = useUI();
  const navigate = useNavigate();
  const { favs } = usePrefs();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [cat, setCat] = useState<number | 'all'>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [open, setOpen] = useState<number | null>(null);

  const rows = useMemo(() => {
    const lq = q.trim().toLowerCase();
    return L.signs.filter(s =>
      (!lq || `${s.word} ${s.description} ${s.categoryName}`.toLowerCase().includes(lq))
      && (cat === 'all' || s.categoryId === cat)
      && (status === 'all' || (status === 'favs' ? favs.includes(s.id) : s.status === status)));
  }, [L.signs, q, cat, status, favs]);

  if (L.loading) return <section className="view"><Loading /></section>;

  const known = L.signs.filter(s => s.status !== 'new').length;
  const review = (queue: Sign[]) => ui.openModal(<ReviewSession queue={queue} />, 'Ôn tập');
  const toggleFav = (id: number) => updatePrefs(p => ({ favs: p.favs.includes(id) ? p.favs.filter(f => f !== id) : [...p.favs, id] }));
  const recent = L.signs.filter(s => s.lastAttemptedAt).sort((a, b) => (b.lastAttemptedAt! > a.lastAttemptedAt! ? 1 : -1)).slice(0, 4);
  const clear = () => { setQ(''); setCat('all'); setStatus('all'); };
  const reveal = (id: number) => {
    clear();
    setOpen(id);
    window.setTimeout(() => document.getElementById(`sign-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  };
  const filtered = q.trim() !== '' || cat !== 'all' || status !== 'all';

  return (
    <section className="view">
      {L.error && <div style={{ marginBottom: 20 }}><Alert>{L.error}</Alert></div>}
      <div className="page-banner">
        <div className="page-banner-copy">
          <p className="kicker">{L.signs.length} ký hiệu · bạn đã tập {known}</p>
          <h1 className="display sm"><em>Từ điển</em> ký hiệu</h1>
          <p className="lede">Mỗi ký hiệu là một hình dạng tay, một chuyển động và một ngữ cảnh. Mở một mục để xem; rê chuột lên bàn tay để thấy nó chuyển động.</p>
        </div>
        <ArtBanner variant="dictionary" />
      </div>

      <div className="dict-tools">
        <label className="dict-search">
          <Icon name="search" size={17} />
          <input placeholder="Tìm từ, nghĩa, chủ đề…" value={q} onChange={e => setQ(e.target.value)} aria-label="Tìm ký hiệu" />
          {q && <button type="button" className="clear-x" onClick={() => setQ('')} aria-label="Xóa tìm kiếm"><Icon name="x" size={15} /></button>}
        </label>
        <div className="chip-row">
          {(['all', 'new', 'learning', 'learned', 'favs'] as StatusFilter[]).map(s => (
            <button key={s} className={`chip ${status === s ? 'on' : ''}`} onClick={() => setStatus(s)}>
              {s === 'all' ? 'Mọi trạng thái' : s === 'favs' ? <><Icon name="star" size={13} /> Yêu thích</> : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="dict-grid">
        <nav className="cat-list" aria-label="Chủ đề">
          <button className={`cat-btn ${cat === 'all' ? 'on' : ''}`} onClick={() => setCat('all')}>Tất cả <i>{L.signs.length}</i></button>
          {L.categories.map(c => (
            <button key={c.id} className={`cat-btn ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)}>
              {c.name} <i>{L.signs.filter(s => s.categoryId === c.id).length}</i>
            </button>
          ))}
        </nav>

        <div aria-live="polite">
          {filtered && rows.length > 0 && (
            <p className="result-line">Tìm thấy {rows.length} ký hiệu <button className="linkbtn" onClick={clear}>Bỏ lọc</button></p>
          )}
          {rows.length === 0 ? (
            <EmptyState title="Không có kết quả" body="Thử từ ngắn hơn hoặc bỏ bộ lọc. Vẫn không có? Hãy đề xuất thêm."
              action={<div className="row" style={{ justifyContent: 'center' }}>
                <button className="btn btn-ghost btn-sm" onClick={clear}>Xóa tìm kiếm & bộ lọc</button>
                <Link className="btn btn-sm" to={`/request${q ? `?word=${encodeURIComponent(q)}` : ''}`}>Đề xuất ký hiệu này</Link>
              </div>} />
          ) : rows.map(sg => {
            const isOpen = open === sg.id;
            return (
              <article key={sg.id} id={`sign-${sg.id}`} className={`drow st-${sg.status} ${isOpen ? 'open' : ''}`}>
                <div className="drow-head" role="button" tabIndex={0} aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : sg.id)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(isOpen ? null : sg.id); } }}>
                  <span className="drow-hand"><SignThumb sign={sg} size={60} /></span>
                  <span><span className="drow-word">{sg.word}</span><span className="drow-en">{sg.categoryName}</span></span>
                  <span className="drow-not">{sg.videoUrl ? <><Icon name="video" size={14} /> video</> : sg.expectedId == null ? 'chưa có trong mô hình AI' : ''}</span>
                  <StatusTag status={sg.status} />
                  <button className={`fav-btn ${favs.includes(sg.id) ? 'on' : ''}`} aria-label={`Yêu thích ${sg.word}`} aria-pressed={favs.includes(sg.id)}
                    onClick={e => { e.stopPropagation(); toggleFav(sg.id); }}>
                    <Icon name="star" size={17} />
                  </button>
                </div>
                <div className="drow-body">
                  {isOpen && (
                    <div className="drow-body-in">
                      <div style={{ width: 260, maxWidth: '100%' }}><SignMedia sign={sg} size={150} /></div>
                      <div>
                        <div className="transcript"><h4>Cách ký</h4><p>{sg.description || 'Chưa có mô tả — hãy làm theo video minh họa.'}</p></div>
                        {sg.lastAttemptedAt && <p className="notation">Luyện lần cuối {timeAgo(sg.lastAttemptedAt)}</p>}
                        <div className="drow-actions">
                          <button className="btn btn-sm" disabled={sg.expectedId == null} onClick={() => navigate(`/studio?sign=${sg.id}`)}
                            title={sg.expectedId == null ? 'Ký hiệu này chưa được nối với mô hình AI' : undefined}>
                            <Icon name="video" size={15} /> Luyện trong Phòng tập
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => review([sg])}><Icon name="refresh" size={15} /> Thẻ ôn</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <aside className="dict-side">
          <div className="side-block">
            <h3>Hàng đợi ôn tập</h3>
            {L.due.length ? (
              <>
                {L.due.slice(0, 6).map(sg => (
                  <button key={sg.id} className="q-item" onClick={() => review([sg])}><b>{sg.word}</b><span>cần luyện thêm</span></button>
                ))}
                <button className="textlink" style={{ marginTop: 8 }} onClick={() => review(L.due)}>Ôn tất cả {L.due.length} <Icon name="arrowr" size={14} /></button>
              </>
            ) : <p style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>Không có gì cần ôn — tốt lắm.</p>}
          </div>
          {favs.length > 0 && (
            <div className="side-block">
              <h3>Yêu thích</h3>
              {favs.map(id => L.signById.get(id)).filter(Boolean).slice(0, 6).map(sg => (
                <button key={sg!.id} className="q-item" onClick={() => reveal(sg!.id)}>
                  <b>{sg!.word}</b><span>{sg!.categoryName}</span>
                </button>
              ))}
            </div>
          )}
          {recent.length > 0 && (
            <div className="side-block">
              <h3>Luyện gần đây</h3>
              {recent.map(sg => (
                <button key={sg.id} className="q-item" onClick={() => reveal(sg.id)}><b>{sg.word}</b><span>{timeAgo(sg.lastAttemptedAt)}</span></button>
              ))}
            </div>
          )}
          <div className="side-block">
            <h3>Thiếu từ?</h3>
            <p style={{ fontSize: 13.5, color: 'var(--ink-2)', marginBottom: 10 }}>Đề xuất một ký hiệu, đội ngũ sẽ thêm kèm video hướng dẫn.</p>
            <Link className="btn btn-ghost btn-sm" to="/request"><Icon name="plus" size={14} /> Đề xuất ký hiệu</Link>
          </div>
        </aside>
      </div>
    </section>
  );
}
