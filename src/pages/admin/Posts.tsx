import { type FormEvent, useState } from 'react';
import Icon from '../../components/Icon';
import PostView from '../../components/PostView';
import { Alert, EmptyState, Loading, Spinner } from '../../components/common';
import { useUI } from '../../context/UIContext';
import { adminApi } from '../../services';
import { apiErrorMessage } from '../../api/errors';
import type { BlogResponse, PageResponse } from '../../models';
import { excerpt, timeAgo } from '../../lib/format';
import { PageHead, Unavailable, useLoad } from './shared';

export default function AdminPosts() {
  const ui = useUI();
  const list = useLoad(() => adminApi.blogs(0, 100));

  const remove = (p: BlogResponse) => ui.openModal(
    <RemoveForm post={p} onDone={() => {
      ui.closeLayer();
      list.setData(d => d && ({ ...d, content: d.content.map(x => (x.id === p.id ? { ...x, status: 'REMOVED' } : x)) }) as PageResponse<BlogResponse>);
      ui.toast('Post removed — the author will see your reason', 'shield');
    }} />,
    'Remove post',
  );

  const announce = () => ui.openModal(<AnnounceForm onDone={() => { ui.closeLayer(); list.reload(); ui.toast('Announcement published', 'send'); }} />, 'New announcement');

  return (
    <>
      <PageHead kicker="Admin · social-service" title={<>Posts <em>&amp; moderation</em></>}>
        {!list.missing && <button className="btn btn-lacquer btn-sm" onClick={announce}><Icon name="plus" size={15} /> Announcement</button>}
      </PageHead>
      {list.missing ? <Unavailable endpoint="/api/admin/blogs" service="social-service" /> : list.loading && !list.data ? <Loading /> : list.error ? <Alert>{list.error}</Alert> : (
        list.data!.content.length === 0 ? <EmptyState title="No posts yet" body="Learner posts will appear here." /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Post</th><th>Author</th><th>Status</th><th>Engagement</th><th>Created</th><th></th></tr></thead>
              <tbody>
                {list.data!.content.map(p => (
                  <tr key={p.id}>
                    <td style={{ maxWidth: 380 }}>
                      <button className="textlink" style={{ color: 'var(--ink)', textAlign: 'left' }} onClick={() => ui.openModal(<PostView post={p} />, p.title)}>{p.title}</button>
                      <div className="faint" style={{ fontSize: 12.5 }}>{excerpt(p.content, 90)}</div>
                    </td>
                    <td>{p.authorName || '—'}</td>
                    <td><span className={`pill ${p.status === 'PUBLISHED' ? 'ink' : p.status === 'REMOVED' ? 'lacquer' : 'dashed'}`}>{p.status.toLowerCase()}</span></td>
                    <td className="muted">{p.likeCount} likes · {p.commentCount} comments</td>
                    <td className="muted">{timeAgo(p.createdAt)}</td>
                    <td><div className="actions">
                      {p.status === 'PUBLISHED' && <button className="btn btn-ghost btn-sm" onClick={() => remove(p)}><Icon name="shield" size={14} /> Remove</button>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </>
  );
}

export function RemoveForm({ post, onDone }: { post: { id: number; title: string }; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) { setError('Tell the author why — they will see this.'); return; }
    setBusy(true);
    try { await adminApi.removeBlog(post.id, reason.trim()); onDone(); }
    catch (err) { setError(apiErrorMessage(err, 'Could not remove the post.')); setBusy(false); }
  };
  return (
    <form onSubmit={submit}>
      <p className="kicker">Moderation</p>
      <h2>Remove “{post.title}”</h2>
      <p className="muted" style={{ margin: '8px 0 16px' }}>The post disappears from the common room. Its author sees the reason below.</p>
      {error && <div style={{ marginBottom: 12 }}><Alert>{error}</Alert></div>}
      <div className="field"><label htmlFor="rm-reason">Reason</label>
        <textarea id="rm-reason" className="tarea" value={reason} onChange={e => setReason(e.target.value)} placeholder="This post shares personal contact details, which the community rules do not allow." autoFocus /></div>
      <div className="form-actions"><button className="btn btn-lacquer" disabled={busy}>{busy ? <Spinner /> : <Icon name="shield" size={15} />} Remove post</button></div>
    </form>
  );
}

function AnnounceForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) { setError('An announcement needs a title and a body.'); return; }
    setBusy(true);
    try { await adminApi.createBlog({ title: title.trim(), content: content.trim(), status: 'PUBLISHED' }); onDone(); }
    catch (err) { setError(apiErrorMessage(err, 'Could not publish.')); setBusy(false); }
  };
  return (
    <form onSubmit={submit}>
      <p className="kicker">From the team</p>
      <h2>New announcement</h2>
      {error && <div style={{ margin: '12px 0' }}><Alert>{error}</Alert></div>}
      <div className="field" style={{ marginTop: 18 }}><label htmlFor="an-title">Title</label>
        <input id="an-title" className="tinput" value={title} onChange={e => setTitle(e.target.value)} placeholder="New in your Studio: faster scoring" autoFocus /></div>
      <div className="field"><label htmlFor="an-body">Body</label>
        <textarea id="an-body" className="tarea" style={{ minHeight: 180 }} value={content} onChange={e => setContent(e.target.value)} /></div>
      <div className="form-actions"><button className="btn" disabled={busy}>{busy ? <Spinner /> : <Icon name="send" size={15} />} Publish</button></div>
    </form>
  );
}
