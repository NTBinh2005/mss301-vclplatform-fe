import { type FormEvent, useEffect, useState } from 'react';
import Icon from '../../components/Icon';
import { Alert, EmptyState, Loading, Spinner } from '../../components/common';
import { useUI } from '../../context/UIContext';
import { categoryApi, vocabularyApi } from '../../services';
import { apiErrorMessage } from '../../api/errors';
import type { CategoryResponse } from '../../models';
import { PageHead, useLoad } from './shared';

export default function AdminCategories() {
  const ui = useUI();
  const list = useLoad(async () => {
    const [cats, vocab] = await Promise.all([categoryApi.list(0, 200), vocabularyApi.list(0, 1000)]);
    return cats.content.map(c => ({ ...c, count: vocab.content.filter(v => v.categoryId === c.id).length }));
  });

  const edit = (c?: CategoryResponse) => ui.openModal(
    <CategoryForm category={c} onSaved={() => { ui.closeLayer(); list.reload(); ui.toast(c ? 'Đã cập nhật chủ đề' : 'Đã tạo chủ đề'); }} />,
    c ? 'Sửa chủ đề' : 'Chủ đề mới',
  );

  const remove = async (c: CategoryResponse & { count: number }) => {
    const ok = await ui.confirm({
      title: `Xóa chủ đề “${c.name}”?`,
      body: c.count ? `Chủ đề vẫn còn ${c.count} ký hiệu, học viên sẽ mất chương này.` : 'Chủ đề chưa có ký hiệu nào.',
      confirmLabel: 'Xóa chủ đề', danger: true,
    });
    if (!ok) return;
    try { await categoryApi.remove(c.id); list.reload(); ui.toast('Đã xóa chủ đề', 'trash'); }
    catch (err) { ui.toast(apiErrorMessage(err, 'Không xóa được chủ đề'), 'alert'); }
  };

  return (
    <>
      <PageHead kicker="Quản trị · learning-service" title={<>Chủ đề <em>&amp; chương</em></>}>
        <button className="btn btn-lacquer btn-sm" onClick={() => edit()}><Icon name="plus" size={15} /> Chủ đề mới</button>
      </PageHead>
      <p className="lede" style={{ marginTop: 0 }}>Mỗi chủ đề là một chương trong lộ trình của học viên, chia thành các bài ba ký hiệu.</p>
      {list.loading && !list.data ? <Loading /> : list.error ? <Alert>{list.error}</Alert> : list.data!.length === 0 ? (
        <EmptyState title="Chưa có chủ đề" body="Tạo chủ đề đầu tiên rồi thêm ký hiệu vào." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th></th><th>Chủ đề</th><th>Mô tả</th><th>Ký hiệu</th><th></th></tr></thead>
            <tbody>
              {list.data!.map(c => (
                <tr key={c.id}>
                  <td style={{ width: 56 }}>{c.imageUrl ? <img className="thumb" src={c.imageUrl} alt="" /> : <span className="thumb" style={{ display: 'inline-block' }} />}</td>
                  <td className="word">{c.name}</td>
                  <td className="muted">{c.description}</td>
                  <td>{c.count}</td>
                  <td><div className="actions">
                    <button className="iconbtn" onClick={() => edit(c)} aria-label={`Sửa ${c.name}`}><Icon name="edit" size={17} /></button>
                    <button className="iconbtn" onClick={() => remove(c)} aria-label={`Xóa ${c.name}`}><Icon name="trash" size={17} /></button>
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

function CategoryForm({ category, onSaved }: { category?: CategoryResponse; onSaved: () => void }) {
  const [name, setName] = useState(category?.name || '');
  const [description, setDescription] = useState(category?.description || '');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!image) { setPreview(''); return; }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Chủ đề cần có tên.'); return; }
    setBusy(true); setError('');
    const body = { name: name.trim(), description: description.trim() || undefined };
    try {
      const saved = category ? await categoryApi.update(category.id, body) : await categoryApi.create(body);
      // The image is stored in MinIO by learning-service once the topic exists.
      if (image) await categoryApi.uploadImage(saved.id, image);
      onSaved();
    } catch (err) { setError(apiErrorMessage(err, 'Không lưu được chủ đề.')); setBusy(false); }
  };

  const shown = preview || category?.imageUrl;
  return (
    <form onSubmit={submit} noValidate>
      <p className="kicker">{category ? 'Sửa chủ đề' : 'Chủ đề mới'}</p>
      <h2>{category ? category.name : 'Thêm chủ đề'}</h2>
      {error && <div style={{ margin: '12px 0' }}><Alert>{error}</Alert></div>}
      <div style={{ marginTop: 18 }}>
        <div className="field"><label htmlFor="cf-name">Tên</label>
          <input id="cf-name" className="tinput" value={name} onChange={e => setName(e.target.value)} maxLength={255} placeholder="Chào hỏi" autoFocus /></div>
        <div className="field"><label htmlFor="cf-desc">Mô tả</label>
          <input id="cf-desc" className="tinput" value={description} onChange={e => setDescription(e.target.value)} maxLength={255} placeholder="Những ký hiệu mở đầu mọi cuộc trò chuyện." /></div>
        <div className="field">
          <span className="label">Ảnh bìa</span>
          {shown && <img src={shown} alt="" className="post-thumb" style={{ maxHeight: 140 }} />}
          <div className="filepick">
            <label className="btn btn-ghost btn-sm"><Icon name="upload" size={14} /> {shown ? 'Đổi ảnh' : 'Chọn ảnh'}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={e => setImage(e.target.files?.[0] || null)} /></label>
            <span className="faint">{image ? image.name : 'JPG, PNG, WEBP hoặc GIF'}</span>
          </div>
        </div>
      </div>
      <div className="form-actions"><button className="btn" disabled={busy}>{busy ? <Spinner /> : <Icon name="check" size={15} />} Lưu</button></div>
    </form>
  );
}
