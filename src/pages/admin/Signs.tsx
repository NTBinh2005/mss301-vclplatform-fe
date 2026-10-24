import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Alert, EmptyState, Loading, Spinner } from '../../components/common';
import { useUI } from '../../context/UIContext';
import { categoryApi, vocabularyApi } from '../../services';
import { apiErrorMessage } from '../../api/errors';
import type { CategoryResponse, VocabularyResponse } from '../../models';
import * as v from '../../lib/validation';
import { PageHead, useLoad } from './shared';

export default function AdminSigns() {
  const ui = useUI();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<number | ''>('');
  const data = useLoad(async () => {
    const [cats, vocab] = await Promise.all([categoryApi.list(0, 200), vocabularyApi.list(0, 1000)]);
    return { cats: cats.content, vocab: vocab.content };
  });

  const rows = useMemo(() => {
    const lq = q.trim().toLowerCase();
    return (data.data?.vocab ?? []).filter(x => (!lq || x.word.toLowerCase().includes(lq)) && (cat === '' || x.categoryId === cat));
  }, [data.data, q, cat]);

  const edit = (sign?: VocabularyResponse, preset?: { word: string; categoryId?: number }) => ui.openModal(
    <SignForm sign={sign} preset={preset} categories={data.data?.cats ?? []} onSaved={() => { ui.closeLayer(); data.reload(); ui.toast(sign ? 'Sign updated' : 'Sign added'); }} />,
    sign ? 'Edit sign' : 'New sign',
  );

  // Arriving from a learner request (?new=<word>&cat=<id>) opens a prefilled form once.
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const word = params.get('new');
    if (!word || !data.data) return;
    setParams({}, { replace: true });
    edit(undefined, { word, categoryId: Number(params.get('cat')) || undefined });
  }, [params, data.data]);

  const remove = async (s: VocabularyResponse) => {
    const ok = await ui.confirm({ title: `Delete “${s.word}”?`, body: 'Learner progress on this sign will be lost.', confirmLabel: 'Delete sign', danger: true });
    if (!ok) return;
    try { await vocabularyApi.remove(s.id); data.reload(); ui.toast('Sign deleted', 'trash'); }
    catch (err) { ui.toast(apiErrorMessage(err, 'Could not delete the sign'), 'alert'); }
  };

  return (
    <>
      <PageHead kicker="Admin · learning-service" title={<>The <em>signs</em></>}>
        <button className="btn btn-lacquer btn-sm" onClick={() => edit()} disabled={!data.data?.cats.length}><Icon name="plus" size={15} /> New sign</button>
      </PageHead>
      <div className="toolbar">
        <label className="dict-search"><Icon name="search" size={17} /><input placeholder="Search signs…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search signs" /></label>
        <select className="tselect" style={{ width: 'auto' }} value={cat} onChange={e => setCat(e.target.value ? Number(e.target.value) : '')} aria-label="Filter by topic">
          <option value="">All topics</option>
          {data.data?.cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="faint" style={{ fontSize: 13 }}>{rows.length} shown</span>
      </div>
      {data.loading && !data.data ? <Loading /> : data.error ? <Alert>{data.error}</Alert> : rows.length === 0 ? (
        <EmptyState title="No signs" body={data.data!.cats.length ? 'Add a sign, or loosen the filters.' : 'Create a topic first.'} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th></th><th>Sign</th><th>Topic</th><th>Model class</th><th>Video</th><th></th></tr></thead>
            <tbody>
              {rows.map(s => (
                <tr key={s.id}>
                  <td style={{ width: 56 }}>{s.imageUrl ? <img className="thumb" src={s.imageUrl} alt="" /> : <span className="thumb" style={{ display: 'inline-block' }} />}</td>
                  <td><span className="word">{s.word}</span>{s.description && <div className="faint" style={{ fontSize: 12.5 }}>{s.description}</div>}</td>
                  <td>{s.categoryName}</td>
                  <td>{s.expectedId != null ? <span className="pill">#{s.expectedId}</span> : <span className="pill lacquer">not set</span>}</td>
                  <td>{s.videoTutorialUrl ? <a className="textlink" href={s.videoTutorialUrl} target="_blank" rel="noreferrer"><Icon name="video" size={14} /> open</a> : <span className="faint">—</span>}</td>
                  <td><div className="actions">
                    <button className="iconbtn" onClick={() => edit(s)} aria-label={`Edit ${s.word}`}><Icon name="edit" size={17} /></button>
                    <button className="iconbtn" onClick={() => remove(s)} aria-label={`Delete ${s.word}`}><Icon name="trash" size={17} /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function SignForm({ sign, preset, categories, onSaved }: {
  sign?: VocabularyResponse; preset?: { word: string; categoryId?: number }; categories: CategoryResponse[]; onSaved: () => void;
}) {
  const presetCat = preset?.categoryId && categories.some(c => c.id === preset.categoryId) ? preset.categoryId : undefined;
  const [f, setF] = useState({
    word: sign?.word || preset?.word || '',
    categoryId: sign?.categoryId ? String(sign.categoryId) : String(presetCat ?? categories[0]?.id ?? ''),
    description: sign?.description || '',
    expectedId: sign?.expectedId != null ? String(sign.expectedId) : '',
    videoTutorialUrl: sign?.videoTutorialUrl || '',
    imageUrl: sign?.imageUrl || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF(p => ({ ...p, [k]: e.target.value })); setErrors(p => ({ ...p, [k]: '' })); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const fieldErrors = {
      word: v.text(f.word, 'Word', 255),
      categoryId: f.categoryId ? '' : 'Pick a topic.',
      expectedId: f.expectedId.trim() ? v.nonNegativeInt(f.expectedId, 'Model class') : '',
    };
    setErrors(fieldErrors);
    if (!v.isValid(fieldErrors)) return;
    setBusy(true); setFailure('');
    const body = {
      word: f.word.trim(),
      categoryId: Number(f.categoryId),
      description: f.description.trim() || undefined,
      expectedId: f.expectedId.trim() ? Number(f.expectedId) : undefined,
      videoTutorialUrl: f.videoTutorialUrl.trim() || undefined,
      imageUrl: f.imageUrl.trim() || undefined,
    };
    try {
      if (sign) await vocabularyApi.update(sign.id, body); else await vocabularyApi.create(body);
      onSaved();
    } catch (err) { setFailure(apiErrorMessage(err, 'Could not save the sign.')); setBusy(false); }
  };

  const field = (k: keyof typeof f, label: string, el: ReactNode, hint?: string) => (
    <div className={`field ${errors[k] ? 'invalid' : ''}`}>
      <label htmlFor={`sf-${k}`}>{label}</label>
      {el}
      {errors[k] ? <span className="err">{errors[k]}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate>
      <p className="kicker">{sign ? 'Edit sign' : 'New sign'}</p>
      <h2>{sign ? sign.word : 'Add a sign'}</h2>
      {preset && !sign && <p className="muted" style={{ marginTop: 4 }}>Requested by a learner — remember to mark the request as reviewed.</p>}
      {failure && <div style={{ margin: '12px 0' }}><Alert>{failure}</Alert></div>}
      <div className="form-grid" style={{ marginTop: 18 }}>
        {field('word', 'Word', <input id="sf-word" className="tinput" value={f.word} onChange={set('word')} placeholder="Xin chào" autoFocus />)}
        {field('categoryId', 'Topic', (
          <select id="sf-categoryId" className="tselect" value={f.categoryId} onChange={set('categoryId')}>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        ))}
      </div>
      {field('description', 'How to sign it', <input id="sf-description" className="tinput" value={f.description} onChange={set('description')} maxLength={255} placeholder="Flat hand at the chest, palm out, wave twice." />)}
      {field('expectedId', 'AI model class (expectedId)', <input id="sf-expectedId" className="tinput" inputMode="numeric" value={f.expectedId} onChange={set('expectedId')} placeholder="0–999" />,
        'The class index this sign has in the ONNX model. Without it, learners cannot be scored on this sign.')}
      {field('videoTutorialUrl', 'Tutorial video URL', <input id="sf-videoTutorialUrl" className="tinput" value={f.videoTutorialUrl} onChange={set('videoTutorialUrl')} maxLength={500} placeholder="https://…/xin-chao.mp4" />)}
      {field('imageUrl', 'Image URL', <input id="sf-imageUrl" className="tinput" value={f.imageUrl} onChange={set('imageUrl')} maxLength={500} placeholder="https://…" />)}
      <div className="form-actions"><button className="btn" disabled={busy}>{busy ? <Spinner /> : <Icon name="check" size={15} />} Save</button></div>
    </form>
  );
}
