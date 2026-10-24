import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { Alert, EmptyState, Spinner } from '../components/common';
import { useLearning } from '../context/LearningContext';
import { useUI } from '../context/UIContext';
import { suggestionApi } from '../services';
import { apiErrorMessage } from '../api/errors';
import type { VocabularyExistsResult, VocabularySuggestionResponse, VocabularySynonymResult } from '../models';
import { timeAgo } from '../lib/format';

/* Suggest a word for the dictionary. As in signmentor: exact-duplicate check
   blocks submission; the AI synonym scan only hints at near-matches. */
export default function RequestSign() {
  const { categories } = useLearning();
  const { toast } = useUI();
  const [params] = useSearchParams();
  const [word, setWord] = useState(params.get('word') || '');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [exists, setExists] = useState<VocabularyExistsResult | null>(null);
  const [synonyms, setSynonyms] = useState<VocabularySynonymResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mine, setMine] = useState<VocabularySuggestionResponse[]>([]);
  const seq = useRef(0);

  useEffect(() => { suggestionApi.mine().then(setMine).catch(() => {}); }, []);

  // Debounced duplicate check as the learner types.
  useEffect(() => {
    setExists(null); setSynonyms(null);
    const w = word.trim();
    if (w.length < 2) return;
    const my = ++seq.current;
    const t = window.setTimeout(async () => {
      setChecking(true);
      try { const r = await suggestionApi.exists(w); if (my === seq.current) setExists(r); } catch { /* the server re-checks on submit */ }
      finally { if (my === seq.current) setChecking(false); }
    }, 450);
    return () => window.clearTimeout(t);
  }, [word]);

  const scan = async () => {
    const w = word.trim();
    if (!w) return;
    setScanning(true);
    try { setSynonyms(await suggestionApi.synonyms(w)); } catch { setSynonyms({ aiChecked: true, aiError: true, synonyms: [] }); }
    finally { setScanning(false); }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!word.trim()) { setError('Which word should we add?'); return; }
    if (categoryId === '') { setError('Pick the topic it belongs to.'); return; }
    if (exists?.exists) return;
    setBusy(true); setError('');
    try {
      const s = await suggestionApi.submit({ word: word.trim(), categoryId, description: description.trim() || undefined });
      setMine(list => [s, ...list]);
      setWord(''); setDescription(''); setCategoryId('');
      toast('Request sent — thank you', 'send');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not send the request.'));
    } finally { setBusy(false); }
  };

  return (
    <section className="view">
      <Link className="textlink" to="/dictionary"><Icon name="arrowl" size={15} /> Dictionary</Link>
      <p className="kicker" style={{ marginTop: 18 }}>Grow the dictionary</p>
      <h1 className="display sm">Request a <em>sign</em>.</h1>
      <p className="lede">Missing a word you need? Tell us, and the team will film a tutorial and connect it to the AI model.</p>

      <div className="two-col" style={{ marginTop: 26 }}>
        <form onSubmit={submit} noValidate>
          <div className="rule-head" style={{ marginTop: 0 }}><h2>New request</h2></div>
          {error && <div style={{ marginBottom: 16 }}><Alert>{error}</Alert></div>}
          <div className="field">
            <label htmlFor="rq-word">Word or phrase</label>
            <input id="rq-word" className="tinput" value={word} onChange={e => setWord(e.target.value)} placeholder="e.g. Bác sĩ" maxLength={255} />
            {checking && <span className="hint">Checking the dictionary…</span>}
            {exists?.exists && (
              <span className="err">“{exists.word}” is already in the dictionary{exists.categoryName ? ` under ${exists.categoryName}` : ''}. <Link className="linkbtn" to={`/dictionary?q=${encodeURIComponent(exists.word || word.trim())}`}>Find it</Link></span>
            )}
            {exists && !exists.exists && <span className="hint" style={{ color: 'var(--mentor-2)' }}>Not in the dictionary yet.</span>}
          </div>
          <div className="field">
            <label htmlFor="rq-cat">Topic</label>
            <select id="rq-cat" className="tselect" value={categoryId} onChange={e => setCategoryId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Choose a topic…</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="rq-desc">Why or where you need it (optional)</label>
            <textarea id="rq-desc" className="tarea" value={description} onChange={e => setDescription(e.target.value)} maxLength={255}
              placeholder="I need it to talk with my cousin about doctor visits." />
          </div>

          {synonyms && (
            <div style={{ marginBottom: 18 }}>
              {synonyms.aiError ? <Alert kind="info">The AI scan is unavailable right now. You can still send the request.</Alert>
                : !synonyms.aiChecked ? <Alert kind="info">The AI scan is switched off on this server.</Alert>
                : synonyms.synonyms.length ? (
                  <Alert kind="info">Similar signs already exist: {synonyms.synonyms.map(s => `${s.word} (${s.categoryName})`).join(', ')}. Send anyway if yours is different.</Alert>
                ) : <Alert kind="ok">No similar signs found.</Alert>}
            </div>
          )}

          <div className="form-actions">
            <button className="btn btn-lacquer" disabled={busy || !!exists?.exists}>{busy ? <Spinner /> : <Icon name="send" size={15} />} Send request</button>
            <button type="button" className="btn btn-ghost" disabled={!word.trim() || scanning} onClick={scan}>
              {scanning ? <><Spinner /> Scanning…</> : <><Icon name="search" size={15} /> Check for similar signs</>}
            </button>
          </div>
        </form>

        <aside>
          <div className="rule-head" style={{ marginTop: 0 }}><h2>Your requests</h2>{mine.length > 0 && <span className="kicker">{mine.length} sent</span>}</div>
          {mine.length === 0 ? <EmptyState title="No requests yet" body="Words you suggest appear here with their review status." /> : mine.map(s => (
            <div className="timeline-item" key={s.id} style={{ alignItems: 'center' }}>
              <span style={{ minWidth: 0 }}><b className="serif" style={{ fontSize: 16 }}>{s.word}</b><br /><span className="faint" style={{ fontSize: 12.5 }}>{s.categoryName} · {timeAgo(s.createdAt)}</span></span>
              <span className={`pill ${s.status === 'REVIEWED' ? 'ink' : 'dashed'}`} style={{ marginLeft: 'auto' }}>{s.status === 'REVIEWED' ? 'Reviewed' : 'Pending'}</span>
            </div>
          ))}
        </aside>
      </div>
    </section>
  );
}
