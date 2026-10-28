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

const FILTERS: [BlogStatus | '', string][] = [['', 'All'], ['PUBLISHED', 'Published'], ['HIDDEN', 'Removed'], ['DRAFT', 'Drafts']];
const PILL: Record<BlogStatus, [string, string]> = { PUBLISHED: ['published', 'ink'], HIDDEN: ['removed', 'lacquer'], DRAFT: ['draft', 'dashed'] };

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
    <RemoveForm post={p} onDone={() => { ui.closeLayer(); list.reload(); ui.toast('Post removed — the author will see your reason', 'shield'); }} />,
    'Remove post',
  );

  const restore = async (p: BlogResponse) => {
    try { replace(await adminApi.restoreBlog(p.id)); ui.toast('Post restored to the common room', 'check'); }
    catch (err) { ui.toast(apiErrorMessage(err, 'Could not restore the post'), 'alert'); }
  };

  const remove = async (p: BlogResponse) => {
    const ok = await ui.confirm({
      title: `Delete “${p.title}” for good?`, body: 'Posts with open reports or removed by a moderator cannot be deleted — remove them instead so the record is kept.',
      confirmLabel: 'Delete post', danger: true,
    });
    if (!ok) return;
    try { await blogApi.remove(p.id); list.reload(); ui.toast('Post deleted', 'trash'); }
    catch (err) { ui.toast(apiErrorMessage(err, 'Could not delete the post'), 'alert'); }
  };

  const announce = () => ui.openModal(<AnnounceForm onDone={() => { ui.closeLayer(); list.reload(); ui.toast('Announcement published', 'send'); }} />, 'New announcement');

  return (
    <>
      <PageHead kicker="Admin · social-service" title={<>Posts <em>&amp; moderation</em></>}>
        {!list.missing && <button className="btn btn-lacquer btn-sm" onClick={announce}><Icon name="plus" size={15} /> Announcement</button>}
      </PageHead>
      <div className="toolbar">
        <div className="seg" role="tablist">
          {FILTERS.map(([s, label]) => (
            <button key={label} role="tab" aria-selected={status === s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{label}</button>
          ))}
        </div>
        <label className="dict-search"><Icon name="search" size={17} /><input placeholder="Search titles…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search posts" /></label>
        {list.data && <span className="faint" style={{ fontSize: 13 }}>{list.data.totalElements} posts</span>}
      </div>
      {list.missing ? <Unavailable endpoint="/api/blogs/admin" service="social-service" /> : list.loading && !list.data ? <Loading /> : list.error ? <Alert>{list.error}</Alert> : (
        list.data!.content.length === 0 ? <EmptyState title="No posts here" body="Try another filter." /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Post</th><th>Author</th><th>Status</th><th>Engagement</th><th>Created</th><th></th></tr></thead>
              <tbody>
                {list.data!.content.map(p => {
                  const [label, cls] = PILL[p.status] || [p.status, ''];
                  return (
                    <tr key={p.id}>
                      <td style={{ maxWidth: 380 }}>
                        <button className="textlink" style={{ color: 'var(--ink)', textAlign: 'left' }} onClick={() => ui.openModal(<PostView post={p} onChange={replace} />, p.title)}>{p.title}</button>
                        <div className="faint" style={{ fontSize: 12.5 }}>{excerpt(postBody(p), 90)}</div>
                        {p.status === 'HIDDEN' && p.deletionReason && <div className="removed-note" style={{ fontSize: 12.5 }}>Reason: {p.deletionReason}</div>}
                      </td>
                      <td>{nameOf(p.author, '—')}</td>
                      <td><span className={`pill ${cls}`}>{label}</span></td>
                      <td className="muted">{p.likeCount} likes · {p.commentCount} comments · {p.shareCount} shares</td>
                      <td className="muted">{timeAgo(p.createdAt)}</td>
                      <td><div className="actions">
                        {p.status === 'PUBLISHED' && <button className="btn btn-ghost btn-sm" onClick={() => hide(p)}><Icon name="shield" size={14} /> Remove</button>}
                        {p.status === 'HIDDEN' && <button className="btn btn-ghost btn-sm" onClick={() => restore(p)}><Icon name="refresh" size={14} /> Restore</button>}
                        {p.status !== 'HIDDEN' && <button className="iconbtn" onClick={() => remove(p)} aria-label={`Delete ${p.title}`}><Icon name="trash" size={17} /></button>}
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
    if (!reason.trim()) { setError('Tell the author why — they will see this.'); return; }
    setBusy(true);
    try {
      if (reportId != null) await adminApi.resolveReport(reportId, reason.trim());
      else await adminApi.hideBlog(post.id, reason.trim());
      onDone();
    } catch (err) { setError(apiErrorMessage(err, 'Could not remove the post.')); setBusy(false); }
  };
  return (
    <form onSubmit={submit}>
      <p className="kicker">Moderation</p>
      <h2>Remove “{post.title}”</h2>
      <p className="muted" style={{ margin: '8px 0 16px' }}>The post disappears from the common room. Its author sees the reason below and can no longer edit it.</p>
      {error && <div style={{ marginBottom: 12 }}><Alert>{error}</Alert></div>}
      <div className="field"><label htmlFor="rm-reason">Reason</label>
        <textarea id="rm-reason" className="tarea" value={reason} maxLength={1000} onChange={e => setReason(e.target.value)} placeholder="This post shares personal contact details, which the community rules do not allow." autoFocus /></div>
      <div className="form-actions"><button className="btn btn-lacquer" disabled={busy}>{busy ? <Spinner /> : <Icon name="shield" size={15} />} Remove post</button></div>
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
    if (!title.trim() || !content.trim()) { setError('An announcement needs a title and a body.'); return; }
    setBusy(true);
    try {
      const created = await blogApi.create({ title: title.trim(), content: content.trim(), status: 'PUBLISHED' });
      if (cover) await blogApi.uploadThumbnail(created.id, cover);
      onDone();
    } catch (err) { setError(apiErrorMessage(err, 'Could not publish.')); setBusy(false); }
  };
  return (
    <form onSubmit={submit}>
      <p className="kicker">From the team</p>
      <h2>New announcement</h2>
      {error && <div style={{ margin: '12px 0' }}><Alert>{error}</Alert></div>}
      <div className="field" style={{ marginTop: 18 }}><label htmlFor="an-title">Title</label>
        <input id="an-title" className="tinput" value={title} maxLength={255} onChange={e => setTitle(e.target.value)} placeholder="New in your Studio: faster scoring" autoFocus /></div>
      <div className="field"><label htmlFor="an-body">Body</label>
        <textarea id="an-body" className="tarea" style={{ minHeight: 180 }} value={content} onChange={e => setContent(e.target.value)} /></div>
      <div className="field">
        <span className="label">Cover image (optional)</span>
        <div className="filepick">
          <label className="btn btn-ghost btn-sm"><Icon name="upload" size={14} /> {cover ? 'Replace image' : 'Choose an image'}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={e => setCover(e.target.files?.[0] || null)} /></label>
          <span className="faint">{cover ? cover.name : 'JPG, PNG, WEBP or GIF up to 5 MB'}</span>
        </div>
      </div>
      <div className="form-actions"><button className="btn" disabled={busy}>{busy ? <Spinner /> : <Icon name="send" size={15} />} Publish</button></div>
    </form>
  );
}
