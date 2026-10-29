import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { Alert, ArtBanner, EmptyState, Spinner } from '../components/common';
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
    if (!word.trim()) { setError('Bạn muốn thêm từ nào?'); return; }
    if (categoryId === '') { setError('Chọn chủ đề của từ này.'); return; }
    if (exists?.exists) return;
    setBusy(true); setError('');
    try {
      const s = await suggestionApi.submit({ word: word.trim(), categoryId, description: description.trim() || undefined });
      setMine(list => [s, ...list]);
      setWord(''); setDescription(''); setCategoryId('');
      toast('Đã gửi đề xuất — cảm ơn bạn', 'send');
    } catch (err) {
      setError(apiErrorMessage(err, 'Không gửi được đề xuất.'));
    } finally { setBusy(false); }
  };

  // Only possible while the team has not reviewed it yet.
  const withdraw = async (s: VocabularySuggestionResponse) => {
    try {
      await suggestionApi.withdraw(s.id);
      setMine(list => list.filter(x => x.id !== s.id));
      toast(`Đã thu hồi đề xuất “${s.word}”`, 'trash');
    } catch (err) { toast(apiErrorMessage(err, 'Không thu hồi được đề xuất'), 'alert'); }
  };

  return (
    <section className="view">
      <Link className="textlink" to="/dictionary"><Icon name="arrowl" size={15} /> Từ điển</Link>
      <div className="page-banner" style={{ marginTop: 14 }}>
        <div className="page-banner-copy">
          <p className="kicker">Mở rộng từ điển</p>
          <h1 className="display sm">Đề xuất <em>ký hiệu</em>.</h1>
          <p className="lede">Thiếu từ bạn cần? Hãy cho chúng tôi biết, đội ngũ sẽ quay video hướng dẫn và nối nó với mô hình AI.</p>
        </div>
        <ArtBanner variant="request" />
      </div>

      <div className="two-col" style={{ marginTop: 26 }}>
        <form onSubmit={submit} noValidate>
          <div className="rule-head" style={{ marginTop: 0 }}><h2>Đề xuất mới</h2></div>
          {error && <div style={{ marginBottom: 16 }}><Alert>{error}</Alert></div>}
          <div className="field">
            <label htmlFor="rq-word">Từ hoặc cụm từ</label>
            <input id="rq-word" className="tinput" value={word} onChange={e => setWord(e.target.value)} placeholder="vd: Bác sĩ" maxLength={255} />
            {checking && <span className="hint">Đang kiểm tra từ điển…</span>}
            {exists?.exists && (
              <span className="err">“{exists.word}” đã có trong từ điển{exists.categoryName ? `, thuộc chủ đề ${exists.categoryName}` : ''}. <Link className="linkbtn" to={`/dictionary?q=${encodeURIComponent(exists.word || word.trim())}`}>Xem ngay</Link></span>
            )}
            {exists && !exists.exists && <span className="hint" style={{ color: 'var(--mentor-2)' }}>Từ này chưa có trong từ điển.</span>}
          </div>
          <div className="field">
            <label htmlFor="rq-cat">Chủ đề</label>
            <select id="rq-cat" className="tselect" value={categoryId} onChange={e => setCategoryId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Chọn chủ đề…</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="rq-desc">Bạn cần từ này ở đâu, vì sao (không bắt buộc)</label>
            <textarea id="rq-desc" className="tarea" value={description} onChange={e => setDescription(e.target.value)} maxLength={255}
              placeholder="Mình cần để nói chuyện với người thân về việc đi khám bệnh." />
          </div>

          {synonyms && (
            <div style={{ marginBottom: 18 }}>
              {synonyms.aiError ? <Alert kind="info">Tạm thời không quét AI được. Bạn vẫn có thể gửi đề xuất.</Alert>
                : !synonyms.aiChecked ? <Alert kind="info">Máy chủ đang tắt tính năng quét AI.</Alert>
                : synonyms.synonyms.length ? (
                  <Alert kind="info">Đã có ký hiệu gần nghĩa: {synonyms.synonyms.map(s => `${s.word} (${s.categoryName})`).join(', ')}. Vẫn gửi nếu từ của bạn khác nghĩa.</Alert>
                ) : <Alert kind="ok">Không có ký hiệu gần nghĩa.</Alert>}
            </div>
          )}

          <div className="form-actions">
            <button className="btn btn-lacquer" disabled={busy || !!exists?.exists}>{busy ? <Spinner /> : <Icon name="send" size={15} />} Gửi đề xuất</button>
            <button type="button" className="btn btn-ghost" disabled={!word.trim() || scanning} onClick={scan}>
              {scanning ? <><Spinner /> Đang quét…</> : <><Icon name="search" size={15} /> Kiểm tra từ gần nghĩa</>}
            </button>
          </div>
        </form>

        <aside>
          <div className="rule-head" style={{ marginTop: 0 }}><h2>Đề xuất của bạn</h2>{mine.length > 0 && <span className="kicker">Đã gửi {mine.length}</span>}</div>
          {mine.length === 0 ? <EmptyState title="Chưa có đề xuất" body="Các từ bạn đề xuất sẽ hiện ở đây kèm trạng thái duyệt." /> : mine.map(s => (
            <div className="timeline-item" key={s.id} style={{ alignItems: 'center' }}>
              <span style={{ minWidth: 0 }}><b className="serif" style={{ fontSize: 16 }}>{s.word}</b><br /><span className="faint" style={{ fontSize: 12.5 }}>{s.categoryName} · {timeAgo(s.createdAt)}</span></span>
              <span className={`pill ${s.status === 'REVIEWED' ? 'ink' : 'dashed'}`} style={{ marginLeft: 'auto' }}>{s.status === 'REVIEWED' ? 'Đã xem xét' : 'Đang chờ'}</span>
              {s.status === 'PENDING' && (
                <button className="iconbtn" onClick={() => withdraw(s)} aria-label={`Thu hồi đề xuất ${s.word}`} title="Thu hồi"><Icon name="trash" size={16} /></button>
              )}
            </div>
          ))}
        </aside>
      </div>
    </section>
  );
}
