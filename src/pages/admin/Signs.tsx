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
    sign ? 'Sửa ký hiệu' : 'Ký hiệu mới',
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
    const ok = await ui.confirm({ title: `Xóa “${s.word}”?`, body: 'Tiến độ học viên với ký hiệu này sẽ mất, video và ảnh cũng bị xóa.', confirmLabel: 'Xóa ký hiệu', danger: true });
    if (!ok) return;
    try { await vocabularyApi.remove(s.id); data.reload(); ui.toast('Đã xóa ký hiệu', 'trash'); }
    catch (err) { ui.toast(apiErrorMessage(err, 'Không xóa được ký hiệu'), 'alert'); }
  };

  return (
    <>
      <PageHead kicker="Quản trị · learning-service" title={<>Kho <em>ký hiệu</em></>}>
        <button className="btn btn-lacquer btn-sm" onClick={() => edit()} disabled={!data.data?.cats.length}><Icon name="plus" size={15} /> Ký hiệu mới</button>
      </PageHead>
      <div className="toolbar">
        <label className="dict-search"><Icon name="search" size={17} /><input placeholder="Tìm ký hiệu…" value={q} onChange={e => setQ(e.target.value)} aria-label="Tìm ký hiệu" /></label>
        <select className="tselect" style={{ width: 'auto' }} value={cat} onChange={e => setCat(e.target.value ? Number(e.target.value) : '')} aria-label="Lọc theo chủ đề">
          <option value="">Mọi chủ đề</option>
          {data.data?.cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="faint" style={{ fontSize: 13 }}>Hiển thị {rows.length}</span>
      </div>
      {data.loading && !data.data ? <Loading /> : data.error ? <Alert>{data.error}</Alert> : rows.length === 0 ? (
        <EmptyState title="Không có ký hiệu" body={data.data!.cats.length ? 'Thêm ký hiệu hoặc nới bộ lọc.' : 'Hãy tạo chủ đề trước.'} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th></th><th>Ký hiệu</th><th>Chủ đề</th><th>Lớp mô hình</th><th>Video</th><th></th></tr></thead>
            <tbody>
              {rows.map(s => {
                const shared = s.expectedId != null ? (sharing.get(s.expectedId) || []).filter(w => w !== s.word) : [];
                return (
                  <tr key={s.id}>
                    <td style={{ width: 56 }}>{s.imageUrl ? <img className="thumb" src={s.imageUrl} alt="" /> : <span className="thumb" style={{ display: 'inline-block' }} />}</td>
                    <td><span className="word">{s.word}</span>{s.description && <div className="faint" style={{ fontSize: 12.5 }}>{s.description}</div>}</td>
                    <td>{s.categoryName}</td>
                    <td>
                      {s.expectedId != null ? <span className="pill">#{s.expectedId}</span> : <span className="pill lacquer">chưa đặt</span>}
                      {shared.length > 0 && <div className="faint" style={{ fontSize: 12 }}>cùng ký hiệu với {shared.join(', ')}</div>}
                    </td>
                    <td>{s.videoTutorialUrl ? <a className="textlink" href={s.videoTutorialUrl} target="_blank" rel="noreferrer"><Icon name="video" size={14} /> mở</a> : <span className="faint">—</span>}</td>
                    <td><div className="actions">
                      <button className="iconbtn" onClick={() => edit(s)} aria-label={`Sửa ${s.word}`}><Icon name="edit" size={17} /></button>
                      <button className="iconbtn" onClick={() => remove(s)} aria-label={`Xóa ${s.word}`}><Icon name="trash" size={17} /></button>
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
      word: v.text(f.word, 'Từ', 255),
      categoryId: f.categoryId ? '' : 'Chọn chủ đề.',
      expectedId: !f.expectedId.trim() ? '' : v.nonNegativeInt(f.expectedId, 'Lớp mô hình') || (Number(f.expectedId) > 999 ? 'Mô hình chỉ có các lớp 0–999.' : ''),
      video: video && video.size > MAX_VIDEO_MB * 1024 * 1024 ? `Video tối đa ${MAX_VIDEO_MB} MB.` : '',
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
      setBusy('Đang lưu ký hiệu…');
      saved = sign ? await vocabularyApi.update(sign.id, body) : await vocabularyApi.create(body);
      if (image) { setBusy('Đang tải ảnh lên…'); await vocabularyApi.uploadImage(saved.id, image); }
      // ai-service converts the clip to a web-friendly MP4 first; that takes a while for long clips.
      if (video) { setBusy('Đang chuyển mã và tải video lên…'); await vocabularyApi.uploadVideo(saved.id, video, expected ?? undefined); }
      onSaved(sign ? 'Đã cập nhật ký hiệu' : 'Đã thêm ký hiệu');
    } catch (err) {
      const msg = apiErrorMessage(err, 'Không lưu được ký hiệu.');
      setFailure(saved ? `Đã lưu ký hiệu nhưng tải ảnh/video thất bại: ${msg}` : msg);
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
      <p className="kicker">{sign ? 'Sửa ký hiệu' : 'Ký hiệu mới'}</p>
      <h2>{sign ? sign.word : 'Thêm ký hiệu'}</h2>
      {preset && !sign && <p className="muted" style={{ marginTop: 4 }}>Do học viên đề xuất — nhớ đánh dấu đề xuất là đã xem xét.</p>}
      {failure && <div style={{ margin: '12px 0' }}><Alert>{failure}</Alert></div>}
      <div className="form-grid" style={{ marginTop: 18 }}>
        {field('word', 'Từ', <input id="sf-word" className="tinput" value={f.word} onChange={set('word')} placeholder="Xin chào" autoFocus />)}
        {field('categoryId', 'Chủ đề', (
          <select id="sf-categoryId" className="tselect" value={f.categoryId} onChange={set('categoryId')}>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        ))}
      </div>
      {field('description', 'Cách ký', <input id="sf-description" className="tinput" value={f.description} onChange={set('description')} maxLength={255} placeholder="Bàn tay duỗi trước ngực, lòng tay hướng ra, vẫy hai lần." />)}
      {field('expectedId', 'Lớp mô hình AI (expectedId)', <input id="sf-expectedId" className="tinput" inputMode="numeric" value={f.expectedId} onChange={set('expectedId')} placeholder="0–999" />,
        sameClass.length
          ? <>Dùng chung với {sameClass.join(', ')} — hợp lệ khi đây là một ký hiệu nhiều nghĩa.</>
          : 'Chỉ số lớp của ký hiệu trong mô hình ONNX. Không có thì học viên không được chấm điểm ký hiệu này.')}
      <div className="form-grid">
        {field('video', 'Video hướng dẫn', (
          <div className="filepick">
            <label className="btn btn-ghost btn-sm"><Icon name="video" size={14} /> {video || sign?.videoTutorialUrl ? 'Đổi video' : 'Chọn video'}
              <input id="sf-video" type="file" accept="video/*" className="sr-only" onChange={e => { setVideo(e.target.files?.[0] || null); setErrors(p => ({ ...p, video: '' })); }} /></label>
            <span className="faint">{video ? video.name : sign?.videoTutorialUrl ? 'Đã có video' : `Tối đa ${MAX_VIDEO_MB} MB`}</span>
          </div>
        ))}
        {field('image', 'Ảnh minh họa', (
          <div className="filepick">
            <label className="btn btn-ghost btn-sm"><Icon name="upload" size={14} /> {image || sign?.imageUrl ? 'Đổi ảnh' : 'Chọn ảnh'}
              <input id="sf-image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={e => setImage(e.target.files?.[0] || null)} /></label>
            <span className="faint">{image ? image.name : sign?.imageUrl ? 'Đã có ảnh' : 'Không bắt buộc'}</span>
          </div>
        ))}
      </div>
      {sign?.videoTutorialUrl && !video && <video className="sign-video" src={sign.videoTutorialUrl} controls muted style={{ maxHeight: 180, marginBottom: 12 }} />}
      <div className="form-actions">
        <button className="btn" disabled={!!busy}>{busy ? <><Spinner /> {busy}</> : <><Icon name="check" size={15} /> Lưu</>}</button>
      </div>
    </form>
  );
}
