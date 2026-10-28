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

const MAX_VIDEO_MB = 50;

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

  // Several words may share one AI class (one sign, several meanings); show who else uses it.
  const sharing = useMemo(() => {
    const by = new Map<number, string[]>();
    (data.data?.vocab ?? []).forEach(x => { if (x.expectedId != null) by.set(x.expectedId, [...(by.get(x.expectedId) || []), x.word]); });
    return by;
  }, [data.data]);

  const edit = (sign?: VocabularyResponse, preset?: { word: string; categoryId?: number }) => ui.openModal(
    <SignForm sign={sign} preset={preset} categories={data.data?.cats ?? []} vocab={data.data?.vocab ?? []}
      onSaved={msg => { ui.closeLayer(); data.reload(); ui.toast(msg); }} />,
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
    const ok = await ui.confirm({ title: `Delete “${s.word}”?`, body: 'Learner progress on this sign will be lost, and its video and image are deleted.', confirmLabel: 'Delete sign', danger: true });
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
              {rows.map(s => {
                const shared = s.expectedId != null ? (sharing.get(s.expectedId) || []).filter(w => w !== s.word) : [];
                return (
                  <tr key={s.id}>
                    <td style={{ width: 56 }}>{s.imageUrl ? <img className="thumb" src={s.imageUrl} alt="" /> : <span className="thumb" style={{ display: 'inline-block' }} />}</td>
                    <td><span className="word">{s.word}</span>{s.description && <div className="faint" style={{ fontSize: 12.5 }}>{s.description}</div>}</td>
                    <td>{s.categoryName}</td>
                    <td>
                      {s.expectedId != null ? <span className="pill">#{s.expectedId}</span> : <span className="pill lacquer">not set</span>}
                      {shared.length > 0 && <div className="faint" style={{ fontSize: 12 }}>same sign as {shared.join(', ')}</div>}
                    </td>
                    <td>{s.videoTutorialUrl ? <a className="textlink" href={s.videoTutorialUrl} target="_blank" rel="noreferrer"><Icon name="video" size={14} /> open</a> : <span className="faint">—</span>}</td>
                    <td><div className="actions">
                      <button className="iconbtn" onClick={() => edit(s)} aria-label={`Edit ${s.word}`}><Icon name="edit" size={17} /></button>
                      <button className="iconbtn" onClick={() => remove(s)} aria-label={`Delete ${s.word}`}><Icon name="trash" size={17} /></button>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function SignForm({ sign, preset, categories, vocab, onSaved }: {
  sign?: VocabularyResponse; preset?: { word: string; categoryId?: number }; categories: CategoryResponse[];
  vocab: VocabularyResponse[]; onSaved: (msg: string) => void;
}) {
  const presetCat = preset?.categoryId && categories.some(c => c.id === preset.categoryId) ? preset.categoryId : undefined;
  const [f, setF] = useState({
    word: sign?.word || preset?.word || '',
    categoryId: sign?.categoryId ? String(sign.categoryId) : String(presetCat ?? categories[0]?.id ?? ''),
    description: sign?.description || '',
    expectedId: sign?.expectedId != null ? String(sign.expectedId) : '',
  });
  const [video, setVideo] = useState<File | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState('');
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF(p => ({ ...p, [k]: e.target.value })); setErrors(p => ({ ...p, [k]: '' })); };

  const expected = f.expectedId.trim() ? Number(f.expectedId) : null;
  const sameClass = expected != null ? vocab.filter(x => x.expectedId === expected && x.id !== sign?.id).map(x => x.word) : [];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const fieldErrors = {
      word: v.text(f.word, 'Word', 255),
      categoryId: f.categoryId ? '' : 'Pick a topic.',
      expectedId: !f.expectedId.trim() ? '' : v.nonNegativeInt(f.expectedId, 'Model class') || (Number(f.expectedId) > 999 ? 'The model has classes 0–999.' : ''),
      video: video && video.size > MAX_VIDEO_MB * 1024 * 1024 ? `The video can be at most ${MAX_VIDEO_MB} MB.` : '',
    };
    setErrors(fieldErrors);
    if (!v.isValid(fieldErrors)) return;
    setFailure('');
    const body = {
      word: f.word.trim(),
      categoryId: Number(f.categoryId),
      description: f.description.trim() || undefined,
      expectedId: expected ?? undefined,
    };
    let saved: VocabularyResponse | undefined;
    try {
      setBusy('Saving the sign…');
      saved = sign ? await vocabularyApi.update(sign.id, body) : await vocabularyApi.create(body);
      if (image) { setBusy('Uploading the image…'); await vocabularyApi.uploadImage(saved.id, image); }
      // ai-service converts the clip to a web-friendly MP4 first; that takes a while for long clips.
      if (video) { setBusy('Converting and uploading the video…'); await vocabularyApi.uploadVideo(saved.id, video, expected ?? undefined); }
      onSaved(sign ? 'Sign updated' : 'Sign added');
    } catch (err) {
      const msg = apiErrorMessage(err, 'Could not save the sign.');
      setFailure(saved ? `The sign was saved, but the media upload failed: ${msg}` : msg);
      setBusy('');
    }
  };

  const field = (k: string, label: string, el: ReactNode, hint?: ReactNode) => (
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
        sameClass.length
          ? <>Shared with {sameClass.join(', ')} — fine when it is the same sign with several meanings.</>
          : 'The class index this sign has in the ONNX model. Without it, learners cannot be scored on this sign.')}
      <div className="form-grid">
        {field('video', 'Tutorial video', (
          <div className="filepick">
            <label className="btn btn-ghost btn-sm"><Icon name="video" size={14} /> {video || sign?.videoTutorialUrl ? 'Replace video' : 'Choose a video'}
              <input id="sf-video" type="file" accept="video/*" className="sr-only" onChange={e => { setVideo(e.target.files?.[0] || null); setErrors(p => ({ ...p, video: '' })); }} /></label>
            <span className="faint">{video ? video.name : sign?.videoTutorialUrl ? 'Has a video' : `Up to ${MAX_VIDEO_MB} MB`}</span>
          </div>
        ))}
        {field('image', 'Still image', (
          <div className="filepick">
            <label className="btn btn-ghost btn-sm"><Icon name="upload" size={14} /> {image || sign?.imageUrl ? 'Replace image' : 'Choose an image'}
              <input id="sf-image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={e => setImage(e.target.files?.[0] || null)} /></label>
            <span className="faint">{image ? image.name : sign?.imageUrl ? 'Has an image' : 'Optional'}</span>
          </div>
        ))}
      </div>
      {sign?.videoTutorialUrl && !video && <video className="sign-video" src={sign.videoTutorialUrl} controls muted style={{ maxHeight: 180, marginBottom: 12 }} />}
      <div className="form-actions">
        <button className="btn" disabled={!!busy}>{busy ? <><Spinner /> {busy}</> : <><Icon name="check" size={15} /> Save</>}</button>
      </div>
    </form>
  );
}
