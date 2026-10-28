import { type FormEvent, useEffect, useState } from 'react';
import Icon from '../../components/Icon';
import PostView from '../../components/PostView';
import { Alert, EmptyState, Loading, Spinner } from '../../components/common';
import { useUI } from '../../context/UIContext';
import { adminApi, blogApi } from '../../services';
import { apiErrorMessage } from '../../api/errors';
import type { BlogResponse, BlogStatus, PageResponse } from '../../models';
import { excerpt, nameOf, postBody, timeAgo } from '../../lib/format';
import { PageHead, Unavailable, useLoad } from './shared';

const FILTERS: [BlogStatus | '', string][] = [['', 'Tất cả'], ['PUBLISHED', 'Đã đăng'], ['HIDDEN', 'Bị gỡ'], ['DRAFT', 'Bản nháp']];
const PILL: Record<BlogStatus, [string, string]> = { PUBLISHED: ['đã đăng', 'ink'], HIDDEN: ['bị gỡ', 'lacquer'], DRAFT: ['nháp', 'dashed'] };

export default function AdminPosts() {
  const ui = useUI();
  const [status, setStatus] = useState<BlogStatus | ''>('');
  const [q, setQ] = useState('');
  const [keyword, setKeyword] = useState('');
  const list = useLoad(() => adminApi.blogs({ status: status || undefined, keyword: keyword || undefined, size: 50 }));

  useEffect(() => { list.reload(); }, [status, keyword]);
  useEffect(() => { const t = window.setTimeout(() => setKeyword(q.trim()), 350); return () => window.clearTimeout(t); }, [q]);

  const replace = (p: BlogResponse) =>
    list.setData(d => d && ({ ...d, content: d.content.map(x => (x.id === p.id ? { ...x, ...p, excerpt: x.excerpt } : x)) }) as PageResponse<BlogResponse>);

  const hide = (p: BlogResponse) => ui.openModal(
    <RemoveForm post={p} onDone={() => { ui.closeLayer(); list.reload(); ui.toast('Đã gỡ bài — tác giả sẽ thấy lý do của bạn', 'shield'); }} />,
    'Gỡ bài viết',
  );

  const restore = async (p: BlogResponse) => {
    try { replace(await adminApi.restoreBlog(p.id)); ui.toast('Đã khôi phục bài viết', 'check'); }
    catch (err) { ui.toast(apiErrorMessage(err, 'Không khôi phục được bài viết'), 'alert'); }
  };

  const remove = async (p: BlogResponse) => {
    const ok = await ui.confirm({
      title: `Xóa vĩnh viễn “${p.title}”?`, body: 'Bài đang bị tố cáo hoặc đã bị gỡ thì không xóa được — hãy gỡ bài để giữ lại hồ sơ.',
      confirmLabel: 'Xóa bài', danger: true,
    });
    if (!ok) return;
    try { await blogApi.remove(p.id); list.reload(); ui.toast('Đã xóa bài viết', 'trash'); }
    catch (err) { ui.toast(apiErrorMessage(err, 'Không xóa được bài viết'), 'alert'); }
  };

  const announce = () => ui.openModal(<AnnounceForm onDone={() => { ui.closeLayer(); list.reload(); ui.toast('Đã đăng thông báo', 'send'); }} />, 'Thông báo mới');

  return (
    <>
      <PageHead kicker="Quản trị · social-service" title={<>Bài viết <em>&amp; kiểm duyệt</em></>}>
        {!list.missing && <button className="btn btn-lacquer btn-sm" onClick={announce}><Icon name="plus" size={15} /> Thông báo</button>}
      </PageHead>
      <div className="toolbar">
        <div className="seg" role="tablist">
          {FILTERS.map(([s, label]) => (
            <button key={label} role="tab" aria-selected={status === s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{label}</button>
          ))}
        </div>
        <label className="dict-search"><Icon name="search" size={17} /><input placeholder="Tìm theo tiêu đề…" value={q} onChange={e => setQ(e.target.value)} aria-label="Tìm bài viết" /></label>
        {list.data && <span className="faint" style={{ fontSize: 13 }}>{list.data.totalElements} bài viết</span>}
      </div>
      {list.missing ? <Unavailable endpoint="/api/blogs/admin" service="social-service" /> : list.loading && !list.data ? <Loading /> : list.error ? <Alert>{list.error}</Alert> : (
        list.data!.content.length === 0 ? <EmptyState title="Không có bài viết" body="Thử bộ lọc khác." /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Bài viết</th><th>Tác giả</th><th>Trạng thái</th><th>Tương tác</th><th>Ngày tạo</th><th></th></tr></thead>
              <tbody>
                {list.data!.content.map(p => {
                  const [label, cls] = PILL[p.status] || [p.status, ''];
                  return (
                    <tr key={p.id}>
                      <td style={{ maxWidth: 380 }}>
                        <button className="textlink" style={{ color: 'var(--ink)', textAlign: 'left' }} onClick={() => ui.openModal(<PostView post={p} onChange={replace} />, p.title)}>{p.title}</button>
                        <div className="faint" style={{ fontSize: 12.5 }}>{excerpt(postBody(p), 90)}</div>
                        {p.status === 'HIDDEN' && p.deletionReason && <div className="removed-note" style={{ fontSize: 12.5 }}>Lý do: {p.deletionReason}</div>}
                      </td>
                      <td>{nameOf(p.author, '—')}</td>
                      <td><span className={`pill ${cls}`}>{label}</span></td>
                      <td className="muted">{p.likeCount} thích · {p.commentCount} bình luận · {p.shareCount} chia sẻ</td>
                      <td className="muted">{timeAgo(p.createdAt)}</td>
                      <td><div className="actions">
                        {p.status === 'PUBLISHED' && <button className="btn btn-ghost btn-sm" onClick={() => hide(p)}><Icon name="shield" size={14} /> Gỡ bài</button>}
                        {p.status === 'HIDDEN' && <button className="btn btn-ghost btn-sm" onClick={() => restore(p)}><Icon name="refresh" size={14} /> Khôi phục</button>}
                        {p.status !== 'HIDDEN' && <button className="iconbtn" onClick={() => remove(p)} aria-label={`Xóa ${p.title}`}><Icon name="trash" size={17} /></button>}
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </>
  );
}

/* Removes a post with a reason the author sees. From a report, the report is resolved
   (which also closes every other open report on that post); otherwise the post is hidden directly. */
export function RemoveForm({ post, reportId, onDone }: { post: { id: number; title: string }; reportId?: number; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) { setError('Hãy cho tác giả biết lý do — họ sẽ thấy nội dung này.'); return; }
    setBusy(true);
    try {
      if (reportId != null) await adminApi.resolveReport(reportId, reason.trim());
      else await adminApi.hideBlog(post.id, reason.trim());
      onDone();
    } catch (err) { setError(apiErrorMessage(err, 'Không gỡ được bài viết.')); setBusy(false); }
  };
  return (
    <form onSubmit={submit}>
      <p className="kicker">Kiểm duyệt</p>
      <h2>Gỡ “{post.title}”</h2>
      <p className="muted" style={{ margin: '8px 0 16px' }}>Bài viết sẽ biến mất khỏi cộng đồng. Tác giả thấy lý do bên dưới và không sửa bài được nữa.</p>
      {error && <div style={{ marginBottom: 12 }}><Alert>{error}</Alert></div>}
      <div className="field"><label htmlFor="rm-reason">Lý do</label>
        <textarea id="rm-reason" className="tarea" value={reason} maxLength={1000} onChange={e => setReason(e.target.value)} placeholder="Bài viết chia sẻ thông tin liên lạc cá nhân, vi phạm quy tắc cộng đồng." autoFocus /></div>
      <div className="form-actions"><button className="btn btn-lacquer" disabled={busy}>{busy ? <Spinner /> : <Icon name="shield" size={15} />} Gỡ bài viết</button></div>
    </form>
  );
}

// Admin posts skip AI moderation, so an announcement publishes straight away.
function AnnounceForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [cover, setCover] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) { setError('Thông báo cần có tiêu đề và nội dung.'); return; }
    setBusy(true);
    try {
      const created = await blogApi.create({ title: title.trim(), content: content.trim(), status: 'PUBLISHED' });
      if (cover) await blogApi.uploadThumbnail(created.id, cover);
      onDone();
    } catch (err) { setError(apiErrorMessage(err, 'Không đăng được.')); setBusy(false); }
  };
  return (
    <form onSubmit={submit}>
      <p className="kicker">Từ đội ngũ</p>
      <h2>Thông báo mới</h2>
      {error && <div style={{ margin: '12px 0' }}><Alert>{error}</Alert></div>}
      <div className="field" style={{ marginTop: 18 }}><label htmlFor="an-title">Tiêu đề</label>
        <input id="an-title" className="tinput" value={title} maxLength={255} onChange={e => setTitle(e.target.value)} placeholder="Mới trong Phòng tập: chấm điểm nhanh hơn" autoFocus /></div>
      <div className="field"><label htmlFor="an-body">Nội dung</label>
        <textarea id="an-body" className="tarea" style={{ minHeight: 180 }} value={content} onChange={e => setContent(e.target.value)} /></div>
      <div className="field">
        <span className="label">Ảnh bìa (không bắt buộc)</span>
        <div className="filepick">
          <label className="btn btn-ghost btn-sm"><Icon name="upload" size={14} /> {cover ? 'Đổi ảnh' : 'Chọn ảnh'}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={e => setCover(e.target.files?.[0] || null)} /></label>
          <span className="faint">{cover ? cover.name : 'JPG, PNG, WEBP hoặc GIF, tối đa 5 MB'}</span>
        </div>
      </div>
      <div className="form-actions"><button className="btn" disabled={busy}>{busy ? <Spinner /> : <Icon name="send" size={15} />} Đăng</button></div>
    </form>
  );
}
