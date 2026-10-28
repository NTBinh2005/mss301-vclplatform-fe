import { type FormEvent, useEffect, useState } from 'react';
import Icon from '../components/Icon';
import PostView from '../components/PostView';
import { Alert, EmptyState, Loading, Spinner } from '../components/common';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { blogApi } from '../services';
import { apiErrorMessage } from '../api/errors';
import type { BlogResponse, BlogStatus } from '../models';
import { excerpt, postBody, timeAgo } from '../lib/format';
import { CommunityHeader } from './Community';

const STATUS_PILL: Record<BlogStatus, [string, string]> = {
  PUBLISHED: ['Published', 'ink'],
  DRAFT: ['Draft', 'dashed'],
  HIDDEN: ['Removed', 'lacquer'],
};

export default function MyPosts() {
  const { user } = useAuth();
  const ui = useUI();
  const [posts, setPosts] = useState<BlogResponse[] | null>(null);
  const [error, setError] = useState('');

  // As the author, /blogs/user/{me} also returns drafts and posts a moderator removed.
  const load = () => blogApi.byAuthor(user!.userId, 0, 50)
    .then(r => { setPosts(r.content); setError(''); })
    .catch(err => { setPosts([]); setError(apiErrorMessage(err, 'Could not load your posts.')); });
  useEffect(() => { load(); }, []);

  const saved = (p: BlogResponse) => {
    setPosts(list => (list?.some(x => x.id === p.id) ? list.map(x => (x.id === p.id ? p : x)) : [p, ...(list || [])]));
    ui.closeLayer();
  };

  // The list only carries an excerpt, so fetch the full text before editing.
  const edit = async (p?: BlogResponse) => {
    let full = p;
    if (p) {
      try { full = await blogApi.get(p.id); } catch (err) { ui.toast(apiErrorMessage(err, 'Could not open the post'), 'alert'); return; }
    }
    ui.openModal(<PostEditor post={full} onSaved={saved} />, p ? 'Edit post' : 'New post');
  };

  const remove = async (p: BlogResponse) => {
    const ok = await ui.confirm({ title: `Delete “${p.title}”?`, body: 'The post and its comments will be gone for good.', confirmLabel: 'Delete post', danger: true });
    if (!ok) return;
    try { await blogApi.remove(p.id); setPosts(list => list?.filter(x => x.id !== p.id) ?? null); ui.toast('Post deleted', 'trash'); }
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
                  <p>{excerpt(postBody(p))}</p>
                  {p.status === 'PUBLISHED' && <p className="faint" style={{ fontSize: 12.5, marginTop: 4 }}>{p.likeCount} likes · {p.commentCount} comments</p>}
                  {p.status === 'HIDDEN' && <p className="removed-note"><Icon name="alert" size={13} /> Removed by a moderator{p.deletionReason ? `: ${p.deletionReason}` : ''}. It can no longer be edited or deleted.</p>}
                </div>
                <div className="row">
                  {p.status !== 'HIDDEN' && <button className="btn btn-ghost btn-sm" onClick={() => edit(p)}><Icon name="edit" size={14} /> Edit</button>}
                  {p.status !== 'HIDDEN' && <button className="iconbtn" onClick={() => remove(p)} aria-label={`Delete ${p.title}`}><Icon name="trash" size={17} /></button>}
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
  const [content, setContent] = useState(post ? postBody(post) : '');
  const [cover, setCover] = useState<File | null>(null);
  const [dropCover, setDropCover] = useState(false);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!cover) { setPreview(''); return; }
    const url = URL.createObjectURL(cover);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);
  const [error, setError] = useState('');

  const save = (status: 'DRAFT' | 'PUBLISHED') => async (e?: FormEvent) => {
    e?.preventDefault();
    if (!title.trim() || !content.trim()) { setError('A post needs a title and a body.'); return; }
    if (title.length > 255) { setError('The title can be at most 255 characters.'); return; }
    setBusy(true); setError('');
    try {
      const body = { title: title.trim(), content: content.trim(), status };
      // Publishing runs AI moderation and duplicate checks; the error message says what was wrong.
      let saved = post ? await blogApi.update(post.id, body) : await blogApi.create(body);
      if (cover) saved = await blogApi.uploadThumbnail(saved.id, cover);
      else if (dropCover && saved.thumbnailUrl) saved = await blogApi.removeThumbnail(saved.id);
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
        {(preview || (post?.thumbnailUrl && !dropCover)) && <img src={preview || post!.thumbnailUrl!} alt="" className="post-thumb" style={{ maxHeight: 160 }} />}
        <div className="filepick">
          <label className="btn btn-ghost btn-sm">
            <Icon name="upload" size={14} /> {preview || (post?.thumbnailUrl && !dropCover) ? 'Replace image' : 'Choose an image'}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={e => { setCover(e.target.files?.[0] || null); setDropCover(false); }} />
          </label>
          <span className="faint">{cover ? cover.name : 'JPG, PNG, WEBP or GIF up to 5 MB'}</span>
          {cover && <button type="button" className="linkbtn" onClick={() => setCover(null)}>Remove</button>}
          {!cover && post?.thumbnailUrl && !dropCover && <button type="button" className="linkbtn" onClick={() => setDropCover(true)}>Remove cover</button>}
        </div>
      </div>
      <div className="form-actions">
        <button className="btn btn-lacquer" disabled={busy}>{busy ? <Spinner /> : <Icon name="send" size={15} />} Publish</button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => save('DRAFT')()}>Save as draft</button>
      </div>
    </form>
  );
}
