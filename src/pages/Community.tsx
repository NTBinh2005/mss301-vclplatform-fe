import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon';
import PostView from '../components/PostView';
import { Alert, Avatar, EmptyState, Loading, Spinner } from '../components/common';
import { useAuth } from '../context/AuthContext';
import { useLearning } from '../context/LearningContext';
import { useUI } from '../context/UIContext';
import { blogApi, myBlogApi } from '../services';
import { apiErrorMessage } from '../api/errors';
import type { BlogNotificationResponse, BlogResponse, BlogSearchResponse } from '../models';
import { excerpt, timeAgo } from '../lib/format';

export function CommunityHeader({ tab }: { tab: 'room' | 'mine' }) {
  const navigate = useNavigate();
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p className="kicker">The common room</p>
          <h1 className="display sm">{tab === 'room' ? <>Learning is a <em>conversation</em>.</> : <>Your <em>posts</em>.</>}</h1>
        </div>
        <div className="seg" role="tablist">
          <button role="tab" aria-selected={tab === 'room'} className={tab === 'room' ? 'on' : ''} onClick={() => navigate('/community')}>Common room</button>
          <button role="tab" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'on' : ''} onClick={() => navigate('/community/mine')}>My posts</button>
        </div>
      </div>
      <p className="lede">
        {tab === 'room'
          ? 'Practice tips from people one chapter ahead of you, Deaf culture from people who live it, and milestones worth stealing courage from.'
          : 'Drafts stay private until you publish them. Posts removed by a moderator show the reason here.'}
      </p>
    </>
  );
}

export default function Community() {
  const { user } = useAuth();
  const L = useLearning();
  const ui = useUI();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [posts, setPosts] = useState<BlogResponse[] | null>(null);
  const [page, setPage] = useState(0);
  const [last, setLast] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<BlogSearchResponse | null>(null);
  const [notes, setNotes] = useState<BlogNotificationResponse[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async (p: number) => {
    try {
      const res = await blogApi.published(p, 10);
      setPosts(list => (p === 0 ? res.content : [...(list || []), ...res.content]));
      setPage(p);
      setLast(res.last ?? res.page + 1 >= res.totalPages);
      setError('');
    } catch (err) {
      setPosts(list => list || []);
      setError(apiErrorMessage(err, 'Could not load the common room.'));
    }
  }, []);

  useEffect(() => { load(0); }, [load]);
  useEffect(() => {
    blogApi.notifications(0, 6).then(r => setNotes(r.content)).catch(() => {});
    blogApi.unreadCount().then(setUnread).catch(() => {});
  }, []);

  const patch = useCallback((p: BlogResponse) => setPosts(list => list?.map(x => (x.id === p.id ? p : x)) ?? list), []);
  const open = useCallback((p: BlogResponse) => ui.openModal(<PostView post={p} onChange={patch} />, p.title), [ui, patch]);

  // Shared links land here as ?post=<id>.
  useEffect(() => {
    const id = Number(params.get('post'));
    if (!id) return;
    setParams({}, { replace: true });
    blogApi.get(id).then(open).catch(() => ui.toast('That post is no longer available', 'alert'));
  }, [params, setParams, open, ui]);

  const publish = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) { ui.toast('Give your post a title and some words first', 'flag'); return; }
    setPosting(true);
    try {
      const created = await myBlogApi.create({ title: title.trim(), content: content.trim(), status: 'PUBLISHED' });
      setPosts(list => [created, ...(list || [])]);
      setTitle(''); setContent('');
      ui.toast('Posted to the common room', 'send');
    } catch (err) {
      ui.toast(apiErrorMessage(err, 'Could not publish the post'), 'alert');
    } finally { setPosting(false); }
  };

  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (!q.trim()) { setFound(null); return; }
    try { setFound(await blogApi.search(q.trim(), 0, 10)); } catch (err) { ui.toast(apiErrorMessage(err, 'Search failed'), 'alert'); }
  };

  const markAll = async () => {
    try { await blogApi.markAllRead(); setUnread(0); setNotes(n => n.map(x => ({ ...x, read: true }))); } catch { /* ignore */ }
  };

  const openNote = async (n: BlogNotificationResponse) => {
    if (!n.read) { blogApi.markRead(n.id).catch(() => {}); setUnread(u => Math.max(0, u - 1)); setNotes(list => list.map(x => (x.id === n.id ? { ...x, read: true } : x))); }
    if (n.blogId) blogApi.get(n.blogId).then(open).catch(() => ui.toast('That post is no longer available', 'alert'));
  };

  const list = found ? found.blogs.content : posts || [];
  const featured = !found && list.length > 2 ? [...list].sort((a, b) => b.likeCount - a.likeCount)[0] : null;
  const feed = featured ? list.filter(p => p.id !== featured.id) : list;
  const discussions = [...(posts || [])].sort((a, b) => b.commentCount - a.commentCount).slice(0, 4).filter(p => p.commentCount > 0);
  const scorable = L.signs.filter(s => s.expectedId != null);
  const challenge = scorable.length ? scorable[Math.floor(Date.now() / (7 * 864e5)) % scorable.length] : null;

  return (
    <section className="view">
      <CommunityHeader tab="room" />

      <form className="compose" onSubmit={publish}>
        <div className="row">
          <Avatar name={user?.fullName} url={user?.avatarUrl} />
          <input placeholder="Share a tip, a win, or a question…" value={title} onChange={e => setTitle(e.target.value)} aria-label="Post title" maxLength={255} />
        </div>
        {title && (
          <>
            <textarea placeholder="Tell the story…" value={content} onChange={e => setContent(e.target.value)} aria-label="Post body" />
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setTitle(''); setContent(''); }}>Cancel</button>
              <button className="btn btn-sm" disabled={posting}>{posting ? <Spinner /> : <Icon name="send" size={15} />} Post</button>
            </div>
          </>
        )}
      </form>

      <div className="comm-grid" style={{ marginTop: 26 }}>
        <div>
          <form className="dict-search" onSubmit={search} style={{ maxWidth: 'none', marginBottom: 16 }}>
            <Icon name="search" size={17} />
            <input placeholder="Search posts and people…" value={q} onChange={e => { setQ(e.target.value); if (!e.target.value) setFound(null); }} aria-label="Search posts" />
            {q && <button type="button" className="clear-x" onClick={() => { setQ(''); setFound(null); }} aria-label="Clear search"><Icon name="x" size={15} /></button>}
          </form>
          {found && (
            <p className="result-line">
              {found.blogs.content.length} {found.blogs.content.length === 1 ? 'post' : 'posts'} for “{q.trim()}”
              <button className="linkbtn" onClick={() => { setQ(''); setFound(null); }}>Back to the feed</button>
            </p>
          )}
          {error && <Alert>{error}</Alert>}

          {found && found.users.content.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <p className="kicker" style={{ marginBottom: 8 }}>People</p>
              <div className="chip-row">
                {found.users.content.map(u => (
                  <span key={u.userId} className="chip static"><Avatar name={u.fullName || u.username} url={u.avatarUrl} size={22} /> {u.fullName || u.username}
                    <span className="faint">· {u.followerCount} followers</span></span>
                ))}
              </div>
            </div>
          )}

          {posts === null ? <Loading /> : (
            <>
              {featured && (
                <button className="feature-post" onClick={() => open(featured)}>
                  <span className="tagchip">Featured · most liked</span>
                  <h3>{featured.title}</h3>
                  <p>{excerpt(featured.content, 220)}</p>
                  <p className="pmeta" style={{ marginTop: 12 }}>
                    <b style={{ color: 'var(--ink)' }}>{featured.authorName}</b> · {timeAgo(featured.createdAt)} · {featured.likeCount} likes · {featured.commentCount} comments
                  </p>
                </button>
              )}
              <div style={{ marginTop: 10 }}>
                {feed.map(p => <PostRow key={p.id} p={p} onOpen={() => open(p)} />)}
              </div>
              {list.length === 0 && !error && (
                <EmptyState title={found ? 'No posts match' : 'The room is quiet'} body={found ? 'Try other words.' : 'Be the first to share a tip, a win or a question.'} />
              )}
              {!found && !last && <div style={{ textAlign: 'center', marginTop: 20 }}><button className="btn btn-ghost btn-sm" onClick={() => load(page + 1)}>Load more</button></div>}
            </>
          )}
        </div>

        <aside>
          {challenge && (
            <div className="challenge">
              <span className="tagchip">Weekly challenge</span>
              <h3>Sign “{challenge.word}” and share it</h3>
              <p>Get it scored in the Studio, then post how it went — what clicked, what didn’t.</p>
              <p className="subs">Everyone gets the same sign this week</p>
              <button className="btn btn-sm" onClick={() => { navigate(`/studio?sign=${challenge.id}`); ui.toast(`Challenge accepted — sign “${challenge.word}”`, 'flag'); }}>
                <Icon name="video" size={15} /> I’m in — take me to the Studio
              </button>
            </div>
          )}

          <div className="side-block">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ fontFamily: 'var(--fd)', fontSize: 17, margin: 0 }}>Notifications {unread > 0 && <span className="badge-dot">{unread}</span>}</h3>
              {unread > 0 && <button className="linkbtn" style={{ fontSize: 12.5 }} onClick={markAll}>Mark all read</button>}
            </div>
            {notes.length ? notes.map(n => (
              <button key={n.id} className={`notif ${n.read ? '' : 'unread'}`} onClick={() => openNote(n)}>
                <b>{n.actorName || 'Someone'}</b> {n.message}
                <span>{n.blogTitle ? `${n.blogTitle} · ` : ''}{timeAgo(n.createdAt)}</span>
              </button>
            )) : <p className="muted" style={{ fontSize: 13.5, marginTop: 8 }}>Mentions and shares will show up here.</p>}
          </div>

          {discussions.length > 0 && (
            <div className="side-block">
              <h3 style={{ fontFamily: 'var(--fd)', fontSize: 17 }}>Active discussions</h3>
              {discussions.map(p => (
                <button key={p.id} className="disc-item" style={{ width: '100%', textAlign: 'left' }} onClick={() => open(p)}>
                  <b>{p.title}</b><span>{p.authorName} · {p.commentCount} comments</span>
                </button>
              ))}
            </div>
          )}

          <div className="side-block">
            <h3 style={{ fontFamily: 'var(--fd)', fontSize: 17 }}>Your writing</h3>
            <p className="muted" style={{ fontSize: 13.5, marginBottom: 10 }}>Edit drafts, add a cover image, or see moderator notes.</p>
            <Link className="btn btn-ghost btn-sm" to="/community/mine"><Icon name="edit" size={14} /> My posts</Link>
          </div>
        </aside>
      </div>
    </section>
  );
}

// Stand-in artwork for posts without a cover image.
const THUMB_ICONS = ['book', 'video', 'star', 'users', 'flame', 'comment'] as const;

function PostRow({ p, onOpen }: { p: BlogResponse; onOpen: () => void }) {
  return (
    <button className="post" onClick={onOpen}>
      <span className="pthumb" aria-hidden="true">
        {p.thumbnailUrl ? <img src={p.thumbnailUrl} alt="" /> : <Icon name={THUMB_ICONS[p.id % THUMB_ICONS.length]} size={28} />}
      </span>
      <span style={{ minWidth: 0 }}>
        <h4>{p.title}</h4>
        <p>{excerpt(p.content)}</p>
        <span className="pmeta">
          <span>{p.authorName} · {timeAgo(p.createdAt)}</span>
          <span className="row" style={{ gap: 12 }}>
            <span className={p.likedByMe ? 'liked' : ''}><Icon name="heart" size={13} /> {p.likeCount}</span>
            <span><Icon name="comment" size={13} /> {p.commentCount}</span>
          </span>
        </span>
      </span>
    </button>
  );
}
