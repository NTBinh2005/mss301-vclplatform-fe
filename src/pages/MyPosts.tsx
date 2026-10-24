import { type FormEvent, useEffect, useState } from 'react';
import Icon from '../components/Icon';
import PostView from '../components/PostView';
import { Alert, EmptyState, Loading, Spinner } from '../components/common';
import { useUI } from '../context/UIContext';
import { myBlogApi } from '../services';
import { apiErrorMessage } from '../api/errors';
import type { BlogResponse, BlogStatus } from '../models';
import { excerpt, timeAgo } from '../lib/format';
import { CommunityHeader } from './Community';

const STATUS_PILL: Record<BlogStatus, [string, string]> = {
  PUBLISHED: ['Published', 'ink'],
  DRAFT: ['Draft', 'dashed'],
  REMOVED: ['Removed', 'lacquer'],
};

export default function MyPosts() {
  const ui = useUI();
  const [posts, setPosts] = useState<BlogResponse[] | null>(null);
  const [error, setError] = useState('');

  const load = () => myBlogApi.list(0, 100)
    .then(r => { setPosts(r.content); setError(''); })
    .catch(err => { setPosts([]); setError(apiErrorMessage(err, 'Could not load your posts.')); });
  useEffect(() => { load(); }, []);

  const saved = (p: BlogResponse) => {
    setPosts(list => (list?.some(x => x.id === p.id) ? list.map(x => (x.id === p.id ? p : x)) : [p, ...(list || [])]));
    ui.closeLayer();
  };

  const edit = (p?: BlogResponse) => ui.openModal(<PostEditor post={p} onSaved={saved} />, p ? 'Edit post' : 'New post');

  const remove = async (p: BlogResponse) => {
    const ok = await ui.confirm({ title: `Delete “${p.title}”?`, body: 'The post and its comments will be gone for good.', confirmLabel: 'Delete post', danger: true });
    if (!ok) return;
    try { await myBlogApi.remove(p.id); setPosts(list => list?.filter(x => x.id !== p.id) ?? null); ui.toast('Post deleted', 'trash'); }
    catch (err) { ui.toast(apiErrorMessage(err, 'Could not delete the post'), 'alert'); }
  };

  return (
    <section className="view">
      <CommunityHeader tab="mine" />
      <div className="toolbar">
        <button className="btn btn-lacquer btn-sm" onClick={() => edit()}><Icon name="plus" size={15} /> New post</button>
        {posts && posts.length > 0 && (
          <span className="faint" style={{ fontSize: 13 }}>
            {posts.filter(p => p.status === 'PUBLISHED').length} published · {posts.filter(p => p.status === 'DRAFT').length} drafts
          </span>
        )}
      </div>
      {error && <Alert>{error}</Alert>}
      {posts === null ? <Loading /> : posts.length === 0 && !error ? (
        <EmptyState title="You have not written anything yet" body="Share a practice tip, a milestone, or a question for people one chapter ahead."
          action={<button className="btn btn-sm" onClick={() => edit()}>Write your first post</button>} />
      ) : (
        <div style={{ borderTop: '1px solid var(--line-2)', marginTop: 8 }}>
          {posts.map(p => {
            const [label, cls] = STATUS_PILL[p.status] || [p.status, ''];
            return (
              <div className="mypost" key={p.id}>
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ marginBottom: 4 }}><span className={`pill ${cls}`}>{label}</span><span className="faint" style={{ fontSize: 12.5 }}>Updated {timeAgo(p.updatedAt || p.createdAt)}</span></div>
                  <h4>{p.status === 'PUBLISHED'
                    ? <button className="title-btn" onClick={() => ui.openModal(<PostView post={p} />, p.title)}>{p.title}</button>
                    : p.title}</h4>
                  <p>{excerpt(p.content)}</p>
                  {p.status === 'PUBLISHED' && <p className="faint" style={{ fontSize: 12.5, marginTop: 4 }}>{p.likeCount} likes · {p.commentCount} comments</p>}
                  {p.status === 'REMOVED' && p.deletionReason && <p className="removed-note"><Icon name="alert" size={13} /> Removed by a moderator: {p.deletionReason}</p>}
                </div>
                <div className="row">
                  {p.status !== 'REMOVED' && <button className="btn btn-ghost btn-sm" onClick={() => edit(p)}><Icon name="edit" size={14} /> Edit</button>}
                  <button className="iconbtn" onClick={() => remove(p)} aria-label={`Delete ${p.title}`}><Icon name="trash" size={17} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PostEditor({ post, onSaved }: { post?: BlogResponse; onSaved: (p: BlogResponse) => void }) {
  const [title, setTitle] = useState(post?.title || '');
  const [content, setContent] = useState(post?.content || '');
  const [cover, setCover] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!cover) { setPreview(''); return; }
    const url = URL.createObjectURL(cover);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);
  const [error, setError] = useState('');

  const save = (status: BlogStatus) => async (e?: FormEvent) => {
    e?.preventDefault();
    if (!title.trim() || !content.trim()) { setError('A post needs a title and a body.'); return; }
    if (title.length > 255) { setError('The title can be at most 255 characters.'); return; }
    setBusy(true); setError('');
    try {
      const body = { title: title.trim(), content: content.trim(), status };
      let saved = post ? await myBlogApi.update(post.id, body) : await myBlogApi.create(body);
      if (cover) {
        const url = await myBlogApi.uploadThumbnail(saved.id, cover);
        saved = { ...saved, thumbnailUrl: typeof url === 'string' ? url : saved.thumbnailUrl };
      }
      onSaved(saved);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the post.'));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save('PUBLISHED')}>
      <p className="kicker">{post ? 'Edit post' : 'New post'}</p>
      <h2>{post ? 'Polish it' : 'Write for the common room'}</h2>
      {error && <div style={{ margin: '12px 0' }}><Alert>{error}</Alert></div>}
      <div className="field" style={{ marginTop: 18 }}>
        <label htmlFor="pe-title">Title</label>
        <input id="pe-title" className="tinput" value={title} onChange={e => setTitle(e.target.value)} placeholder="How I finally got “Cảm ơn” right" autoFocus />
      </div>
      <div className="field">
        <label htmlFor="pe-body">Body</label>
        <textarea id="pe-body" className="tarea" style={{ minHeight: 200 }} value={content} onChange={e => setContent(e.target.value)} />
      </div>
      <div className="field">
        <span className="label">Cover image (optional)</span>
        {(preview || post?.thumbnailUrl) && <img src={preview || post!.thumbnailUrl!} alt="" className="post-thumb" style={{ maxHeight: 160 }} />}
        <div className="filepick">
          <label className="btn btn-ghost btn-sm">
            <Icon name="upload" size={14} /> {preview || post?.thumbnailUrl ? 'Replace image' : 'Choose an image'}
            <input type="file" accept="image/*" className="sr-only" onChange={e => setCover(e.target.files?.[0] || null)} />
          </label>
          <span className="faint">{cover ? cover.name : 'JPG or PNG, landscape works best'}</span>
          {cover && <button type="button" className="linkbtn" onClick={() => setCover(null)}>Remove</button>}
        </div>
      </div>
      <div className="form-actions">
        <button className="btn btn-lacquer" disabled={busy}>{busy ? <Spinner /> : <Icon name="send" size={15} />} Publish</button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => save('DRAFT')()}>Save as draft</button>
      </div>
    </form>
  );
}
