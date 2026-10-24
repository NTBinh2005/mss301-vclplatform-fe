import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon';
import ReviewSession from '../components/ReviewSession';
import { Alert, EmptyState, Loading, SignMedia, SignThumb, StatusTag } from '../components/common';
import { useLearning } from '../context/LearningContext';
import { useUI } from '../context/UIContext';
import { timeAgo } from '../lib/format';
import { updatePrefs, usePrefs } from '../lib/prefs';
import type { Sign, SignStatus } from '../lib/signs';

type StatusFilter = 'all' | SignStatus | 'favs';

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
  const review = (queue: Sign[]) => ui.openModal(<ReviewSession queue={queue} />, 'Review');
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
      <p className="kicker">{L.signs.length} signs · {known} in your hands</p>
      <h1 className="display sm">The <em>Dictionary</em></h1>
      <p className="lede">Every sign is a handshape, a movement, and a context. Open an entry to watch it; hover a hand to see it move.</p>

      <div className="dict-tools">
        <label className="dict-search">
          <Icon name="search" size={17} />
          <input placeholder="Search a word, a meaning, a topic…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search signs" />
          {q && <button type="button" className="clear-x" onClick={() => setQ('')} aria-label="Clear search"><Icon name="x" size={15} /></button>}
        </label>
        <div className="chip-row">
          {(['all', 'new', 'learning', 'learned', 'favs'] as StatusFilter[]).map(s => (
            <button key={s} className={`chip ${status === s ? 'on' : ''}`} onClick={() => setStatus(s)}>
              {s === 'all' ? 'All statuses' : s === 'favs' ? <><Icon name="star" size={13} /> Favourites</> : s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="dict-grid">
        <nav className="cat-list" aria-label="Categories">
          <button className={`cat-btn ${cat === 'all' ? 'on' : ''}`} onClick={() => setCat('all')}>All signs <i>{L.signs.length}</i></button>
          {L.categories.map(c => (
            <button key={c.id} className={`cat-btn ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)}>
              {c.name} <i>{L.signs.filter(s => s.categoryId === c.id).length}</i>
            </button>
          ))}
        </nav>

        <div aria-live="polite">
          {filtered && rows.length > 0 && (
            <p className="result-line">{rows.length} {rows.length === 1 ? 'sign' : 'signs'} found <button className="linkbtn" onClick={clear}>Clear filters</button></p>
          )}
          {rows.length === 0 ? (
            <EmptyState title="Nothing matches" body="Try a shorter word, or clear the filters. Still missing? Ask for it to be added."
              action={<div className="row" style={{ justifyContent: 'center' }}>
                <button className="btn btn-ghost btn-sm" onClick={clear}>Clear search & filters</button>
                <Link className="btn btn-sm" to={`/request${q ? `?word=${encodeURIComponent(q)}` : ''}`}>Request this sign</Link>
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
                  <span className="drow-not">{sg.videoUrl ? <><Icon name="video" size={14} /> video</> : sg.expectedId == null ? 'not in AI model' : ''}</span>
                  <StatusTag status={sg.status} />
                  <button className={`fav-btn ${favs.includes(sg.id) ? 'on' : ''}`} aria-label={`Favourite ${sg.word}`} aria-pressed={favs.includes(sg.id)}
                    onClick={e => { e.stopPropagation(); toggleFav(sg.id); }}>
                    <Icon name="star" size={17} />
                  </button>
                </div>
                <div className="drow-body">
                  {isOpen && (
                    <div className="drow-body-in">
                      <div style={{ width: 'min(260px, 100%)' }}><SignMedia sign={sg} size={150} /></div>
                      <div>
                        <div className="transcript"><h4>How to sign it</h4><p>{sg.description || 'No written description yet — follow the demonstration.'}</p></div>
                        {sg.lastAttemptedAt && <p className="notation">Last practised {timeAgo(sg.lastAttemptedAt)}</p>}
                        <div className="drow-actions">
                          <button className="btn btn-sm" disabled={sg.expectedId == null} onClick={() => navigate(`/studio?sign=${sg.id}`)}
                            title={sg.expectedId == null ? 'This sign is not connected to the AI model yet' : undefined}>
                            <Icon name="video" size={15} /> Practise in Studio
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => review([sg])}><Icon name="refresh" size={15} /> Flashcard</button>
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
            <h3>Review queue</h3>
            {L.due.length ? (
              <>
                {L.due.slice(0, 6).map(sg => (
                  <button key={sg.id} className="q-item" onClick={() => review([sg])}><b>{sg.word}</b><span>needs work</span></button>
                ))}
                <button className="textlink" style={{ marginTop: 8 }} onClick={() => review(L.due)}>Review all {L.due.length} <Icon name="arrowr" size={14} /></button>
              </>
            ) : <p style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>Nothing due — nice work.</p>}
          </div>
          {favs.length > 0 && (
            <div className="side-block">
              <h3>Favourites</h3>
              {favs.map(id => L.signById.get(id)).filter(Boolean).slice(0, 6).map(sg => (
                <button key={sg!.id} className="q-item" onClick={() => reveal(sg!.id)}>
                  <b>{sg!.word}</b><span>{sg!.categoryName}</span>
                </button>
              ))}
            </div>
          )}
          {recent.length > 0 && (
            <div className="side-block">
              <h3>Recently practised</h3>
              {recent.map(sg => (
                <button key={sg.id} className="q-item" onClick={() => reveal(sg.id)}><b>{sg.word}</b><span>{timeAgo(sg.lastAttemptedAt)}</span></button>
              ))}
            </div>
          )}
          <div className="side-block">
            <h3>Missing a word?</h3>
            <p style={{ fontSize: 13.5, color: 'var(--ink-2)', marginBottom: 10 }}>Suggest a sign and the team will add it with a tutorial video.</p>
            <Link className="btn btn-ghost btn-sm" to="/request"><Icon name="plus" size={14} /> Request a sign</Link>
          </div>
        </aside>
      </div>
    </section>
  );
}
