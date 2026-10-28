import { type FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import MentionInput, { type Mention } from './MentionInput';
import { Alert, Avatar, Loading, Spinner } from './common';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { blogApi, followApi } from '../services';
import { apiErrorMessage } from '../api/errors';
import type { BlogResponse, CommentResponse, LikerResponse, ReplyResponse, SocialUserResponse, UserBrief } from '../models';
import { nameOf, postBody, timeAgo } from '../lib/format';

const COMMENT_PAGE = 20;

/* Full post inside the modal layer: body, likes, follow, share, report and the
   comment thread with replies. `onChange` keeps the feed's counters in sync. */
export default function PostView({ post: initial, onChange }: { post: BlogResponse; onChange?: (p: BlogResponse) => void }) {
  const { user, isAdmin } = useAuth();
  const ui = useUI();
  const [post, setPost] = useState(initial);
  const [comments, setComments] = useState<CommentResponse[] | null>(null);
  const [page, setPage] = useState(0);
  const [lastPage, setLastPage] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [mention, setMention] = useState<Mention | null>(null);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<'none' | 'report' | 'share' | 'likers'>('none');
  const authorId = post.author?.userId;
  const isMine = authorId != null && authorId === user?.userId;
  const canModerate = isMine || isAdmin;

  const update = (p: BlogResponse) => { setPost(p); onChange?.(p); };

  const loadComments = async (p: number) => {
    try {
      const res = await blogApi.comments(initial.id, p, COMMENT_PAGE);
      setComments(list => (p === 0 ? res.content : [...(list || []), ...res.content]));
      setPage(p);
      setLastPage(res.last);
    } catch (err) {
      setComments(list => list || []);
      setError(apiErrorMessage(err, 'Could not load comments.'));
    }
  };

  useEffect(() => {
    // The feed only has an excerpt; the detail call brings the full text.
    blogApi.get(initial.id).then(update).catch(() => {});
    loadComments(0);
  }, [initial.id]);

  const like = async () => {
    try {
      const r = post.likedByMe ? await blogApi.unlike(post.id) : await blogApi.like(post.id);
      update({ ...post, likedByMe: r.liked, likeCount: r.likeCount });
    } catch (err) { ui.toast(apiErrorMessage(err, 'Could not like the post'), 'alert'); }
  };

  const follow = async () => {
    if (authorId == null) return;
    try {
      const r = post.followedAuthor ? await followApi.unfollow(authorId) : await followApi.follow(authorId);
      update({ ...post, followedAuthor: r.followedByMe, friendWithAuthor: r.friend });
      ui.toast(r.followedByMe ? `Following ${nameOf(post.author)}` : `Unfollowed ${nameOf(post.author)}`, 'users');
    } catch (err) { ui.toast(apiErrorMessage(err, 'Could not update follow'), 'alert'); }
  };

  const addComment = async (e: FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || busy) return;
    setBusy(true);
    try {
      const c = await blogApi.addComment(post.id, content, mention?.userId);
      setComments(list => [...(list || []), c]);
      setText(''); setMention(null);
      update({ ...post, commentCount: post.commentCount + 1 });
    } catch (err) { ui.toast(apiErrorMessage(err, 'Could not post the comment'), 'alert'); } finally { setBusy(false); }
  };

  const removeComment = async (c: CommentResponse) => {
    try {
      await blogApi.deleteComment(c.id);
      setComments(list => (list || []).filter(x => x.id !== c.id));
      update({ ...post, commentCount: Math.max(0, post.commentCount - 1) });
      ui.toast('Comment deleted', 'trash');
    } catch (err) { ui.toast(apiErrorMessage(err, 'Could not delete the comment'), 'alert'); }
  };

  const replaceComment = (c: CommentResponse) => setComments(list => (list || []).map(x => (x.id === c.id ? c : x)));

  const closeAnd = () => ui.closeLayer();

  return (
    <article>
      <div className="row" style={{ gap: 10, marginBottom: 6 }}>
        <Avatar name={nameOf(post.author)} url={post.author?.avatarUrl} size={30} />
        <span className="tagchip">
          {authorId != null
            ? <Link to={`/people/${authorId}`} onClick={closeAnd} className="textlink" style={{ color: 'inherit' }}>{nameOf(post.author, 'Anonymous')}</Link>
            : 'Anonymous'} · {timeAgo(post.createdAt)}
        </span>
        {post.status !== 'PUBLISHED' && <span className={`pill ${post.status === 'HIDDEN' ? 'lacquer' : 'dashed'}`}>{post.status === 'HIDDEN' ? 'Removed' : 'Draft'}</span>}
      </div>
      <h2>{post.title}</h2>
      {post.status === 'HIDDEN' && post.deletionReason && (
        <p className="removed-note"><Icon name="alert" size={13} /> Removed by a moderator: {post.deletionReason}</p>
      )}
      {post.thumbnailUrl && <img className="post-thumb" src={post.thumbnailUrl} alt="" />}
      <div className="post-body">{postBody(post)}</div>

      {post.status === 'PUBLISHED' && (
        <div className="post-actions">
          <button className={`chip ${post.likedByMe ? 'on' : ''}`} onClick={like} aria-pressed={post.likedByMe}>
            <Icon name="heart" size={15} /> {post.likeCount}
          </button>
          {post.likeCount > 0 && (
            <button className={`chip ${panel === 'likers' ? 'on' : ''}`} onClick={() => setPanel(p => (p === 'likers' ? 'none' : 'likers'))}>Who liked</button>
          )}
          <span className="chip static" aria-label={`${post.commentCount} comments`}><Icon name="comment" size={15} /> {post.commentCount}</span>
          <button className={`chip ${panel === 'share' ? 'on' : ''}`} onClick={() => setPanel(p => (p === 'share' ? 'none' : 'share'))}>
            <Icon name="share" size={15} /> Share{post.shareCount ? ` · ${post.shareCount}` : ''}
          </button>
          {!isMine && authorId != null && (
            <button className={`chip ${post.followedAuthor ? 'on' : ''}`} onClick={follow}>
              <Icon name="users" size={15} /> {post.followedAuthor ? (post.friendWithAuthor ? 'Friends' : 'Following') : 'Follow author'}
            </button>
          )}
          {!isMine && (
            <button className={`chip ${panel === 'report' ? 'on' : ''}`} onClick={() => setPanel(p => (p === 'report' ? 'none' : 'report'))}>
              <Icon name="flag" size={15} /> Report
            </button>
          )}
        </div>
      )}

      {panel === 'report' && <ReportForm postId={post.id} onDone={() => setPanel('none')} />}
      {panel === 'share' && <SharePanel post={post} onShared={n => update({ ...post, shareCount: n })} />}
      {panel === 'likers' && <Likers postId={post.id} onOpenPerson={closeAnd} />}

      <h3 className="serif" style={{ fontSize: 18, fontWeight: 600 }}>Comments</h3>
      {error && <Alert>{error}</Alert>}
      {comments === null ? <Loading label="Loading comments…" /> : comments.length === 0 && !error
        ? <p className="muted" style={{ fontSize: 14, padding: '10px 0' }}>No comments yet. Start the conversation.</p>
        : comments.map(c => (
          <Comment key={c.id} c={c} myId={user?.userId} canModerate={canModerate}
            onDelete={() => removeComment(c)}
            onChanged={replaceComment} onOpenPerson={closeAnd} />
        ))}
      {comments && !lastPage && (
        <button className="linkbtn" style={{ margin: '6px 0 12px' }} onClick={() => loadComments(page + 1)}>Show more comments</button>
      )}

      {post.status === 'PUBLISHED' && (
        <form className="inline-form" onSubmit={addComment}>
          <MentionInput value={text} mention={mention} label="Add a comment" placeholder="Add a comment… (type @ to mention someone)"
            onChange={(t, m) => { setText(t); setMention(m); }} />
          <button className="btn btn-sm" disabled={!text.trim() || busy}>{busy ? <Spinner /> : <Icon name="send" size={14} />} Post</button>
        </form>
      )}
    </article>
  );
}

function ReportForm({ postId, onDone }: { postId: number; onDone: () => void }) {
  const { toast } = useUI();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || busy) return;
    setBusy(true);
    try {
      await blogApi.report(postId, reason.trim());
      toast('Thanks — a moderator will take a look', 'flag');
      onDone();
    } catch (err) { toast(apiErrorMessage(err, 'Could not send the report'), 'alert'); setBusy(false); }
  };
  return (
    <form className="inline-form" onSubmit={submit} style={{ marginBottom: 16 }}>
      <input placeholder="What is wrong with this post?" value={reason} onChange={e => setReason(e.target.value)} aria-label="Report reason" maxLength={1000} autoFocus />
      <button className="btn btn-sm btn-lacquer" disabled={!reason.trim() || busy}>{busy ? <Spinner /> : null} Send report</button>
    </form>
  );
}

/* Copy the link, pin the post to your own page, or to a friend's (people who follow each other). */
function SharePanel({ post, onShared }: { post: BlogResponse; onShared: (count: number) => void }) {
  const { user } = useAuth();
  const { toast } = useUI();
  const [friends, setFriends] = useState<SocialUserResponse[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) followApi.friends(user.userId).then(r => setFriends(r.content)).catch(() => setFriends([]));
  }, [user]);

  const run = async (fn: () => Promise<{ shareCount: number }>, msg: string) => {
    setBusy(true);
    try { const r = await fn(); onShared(r.shareCount); toast(msg, 'share'); }
    catch (err) { toast(apiErrorMessage(err, 'Could not share the post'), 'alert'); }
    finally { setBusy(false); }
  };

  const copy = () => run(async () => {
    const url = `${window.location.origin}/blogs/${post.id}`;
    try { await navigator.clipboard.writeText(url); } catch { /* the toast still shows the link */ }
    return blogApi.share(post.id, 'COPY_URL');
  }, 'Link copied');

  return (
    <div className="share-panel">
      <button className="btn btn-ghost btn-sm" disabled={busy} onClick={copy}><Icon name="share" size={14} /> Copy link</button>
      <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(() => blogApi.share(post.id, 'PROFILE'), 'Shared to your page')}>
        <Icon name="user" size={14} /> Share to my page
      </button>
      {friends === null ? <Spinner /> : friends.length > 0 ? (
        <select className="tselect" style={{ width: 'auto' }} disabled={busy} value=""
          onChange={e => {
            const f = friends.find(x => x.userId === Number(e.target.value));
            if (f) run(() => blogApi.share(post.id, 'PROFILE', f.userId), `Shared to ${nameOf(f)}’s page`);
          }} aria-label="Share to a friend's page">
          <option value="">Share to a friend’s page…</option>
          {friends.map(f => <option key={f.userId} value={f.userId}>{nameOf(f)}</option>)}
        </select>
      ) : <span className="faint" style={{ fontSize: 13 }}>Follow each other with someone to share to their page.</span>}
    </div>
  );
}

function Likers({ postId, onOpenPerson }: { postId: number; onOpenPerson: () => void }) {
  const [list, setList] = useState<LikerResponse[] | null>(null);
  useEffect(() => { blogApi.likers(postId).then(r => setList(r.content)).catch(() => setList([])); }, [postId]);
  if (!list) return <Loading />;
  return (
    <div className="people-list" style={{ marginBottom: 16 }}>
      {list.map((l, i) => <PersonChip key={l.user?.userId ?? i} u={l.user} onClick={onOpenPerson} meta={timeAgo(l.likedAt)} />)}
      {list.length === 0 && <span className="faint">No likes yet.</span>}
    </div>
  );
}

export function PersonChip({ u, meta, onClick }: { u: UserBrief | null; meta?: string; onClick?: () => void }) {
  const inner = <><Avatar name={nameOf(u)} url={u?.avatarUrl} size={22} /> {nameOf(u)}{meta && <span className="faint"> · {meta}</span>}</>;
  return u ? <Link className="chip" to={`/people/${u.userId}`} onClick={onClick}>{inner}</Link> : <span className="chip static">{inner}</span>;
}

function Comment({ c, myId, canModerate, onDelete, onChanged, onOpenPerson }: {
  c: CommentResponse; myId?: number; canModerate: boolean;
  onDelete: () => void; onChanged: (c: CommentResponse) => void; onOpenPerson: () => void;
}) {
  const { toast } = useUI();
  const [replies, setReplies] = useState<ReplyResponse[] | null>(null);
  const [count, setCount] = useState(c.replyCount);
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState('');
  const [mention, setMention] = useState<Mention | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const mine = c.user?.userId != null && c.user.userId === myId;

  const like = async () => {
    try {
      const r = c.likedByMe ? await blogApi.unlikeComment(c.id) : await blogApi.likeComment(c.id);
      onChanged({ ...c, likedByMe: r.liked, likeCount: r.likeCount });
    } catch (err) { toast(apiErrorMessage(err, 'Could not like the comment'), 'alert'); }
  };
  const loadReplies = async () => {
    try { setReplies((await blogApi.replies(c.id)).content); } catch (err) { toast(apiErrorMessage(err, 'Could not load replies'), 'alert'); }
  };
  // Replying to a reply tags its author, so they are notified too.
  const startReply = (to?: UserBrief | null) => {
    setReplying(true);
    if (to?.username && to.userId !== myId) { setText(`@${to.username} `); setMention({ userId: to.userId, username: to.username }); }
    else { setText(''); setMention(null); }
    if (replies === null && count > 0) loadReplies();
  };
  const reply = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const r = await blogApi.addReply(c.id, text.trim(), mention?.userId);
      setReplies(list => [...(list || []), r]);
      setCount(n => n + 1);
      setText(''); setMention(null); setReplying(false);
    } catch (err) { toast(apiErrorMessage(err, 'Could not post the reply'), 'alert'); } finally { setBusy(false); }
  };
  const replaceReply = (r: ReplyResponse) => setReplies(list => (list || []).map(x => (x.id === r.id ? r : x)));
  const removeReply = async (r: ReplyResponse) => {
    try { await blogApi.deleteReply(r.id); setReplies(list => (list || []).filter(x => x.id !== r.id)); setCount(n => Math.max(0, n - 1)); toast('Reply deleted', 'trash'); }
    catch (err) { toast(apiErrorMessage(err, 'Could not delete the reply'), 'alert'); }
  };

  return (
    <div className="comment">
      <Avatar name={nameOf(c.user)} url={c.user?.avatarUrl} className="pavatar" />
      <div className="comment-body">
        <b>{c.user ? <Link to={`/people/${c.user.userId}`} onClick={onOpenPerson} style={{ color: 'inherit' }}>{nameOf(c.user)}</Link> : 'Someone'}</b>
        {editing
          ? <EditBox initial={c.content} onCancel={() => setEditing(false)}
              onSave={async content => { const u = await blogApi.updateComment(c.id, content, c.mentionedUser?.userId); onChanged(u); setEditing(false); }} />
          : <p><MentionTag u={c.mentionedUser} content={c.content} />{c.content}</p>}
        <div className="comment-meta">
          <span>{timeAgo(c.createdAt)}{c.updatedAt && c.updatedAt !== c.createdAt ? ' · edited' : ''}</span>
          <button className={c.likedByMe ? 'on' : ''} onClick={like}>{c.likeCount ? `${c.likeCount} ` : ''}Like</button>
          <button onClick={() => (replying ? setReplying(false) : startReply())}>Reply</button>
          {count > 0 && replies === null && <button onClick={loadReplies}>View {count} {count === 1 ? 'reply' : 'replies'}</button>}
          {mine && !editing && <button onClick={() => setEditing(true)}>Edit</button>}
          {(mine || canModerate) && <DeleteButton what="comment and its replies" onConfirm={onDelete} />}
        </div>
        {(replies?.length || replying) ? (
          <div className="replies">
            {replies?.map(r => (
              <Reply key={r.id} r={r} myId={myId} canModerate={canModerate} onReply={() => startReply(r.user)}
                onChanged={replaceReply} onDelete={() => removeReply(r)} onOpenPerson={onOpenPerson} />
            ))}
            {replying && (
              <form className="inline-form" onSubmit={reply}>
                <MentionInput value={text} mention={mention} label="Reply" autoFocus
                  placeholder={`Reply to ${nameOf(c.user, 'this comment')}…`} onChange={(t, m) => { setText(t); setMention(m); }} />
                <button className="btn btn-sm" disabled={!text.trim() || busy}>{busy ? <Spinner /> : null} Reply</button>
              </form>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Reply({ r, myId, canModerate, onReply, onChanged, onDelete, onOpenPerson }: {
  r: ReplyResponse; myId?: number; canModerate: boolean; onReply: () => void;
  onChanged: (r: ReplyResponse) => void; onDelete: () => void; onOpenPerson: () => void;
}) {
  const { toast } = useUI();
  const [editing, setEditing] = useState(false);
  const mine = r.user?.userId != null && r.user.userId === myId;
  const like = async () => {
    try {
      const x = r.likedByMe ? await blogApi.unlikeReply(r.id) : await blogApi.likeReply(r.id);
      onChanged({ ...r, likedByMe: x.liked, likeCount: x.likeCount });
    } catch (err) { toast(apiErrorMessage(err, 'Could not like the reply'), 'alert'); }
  };
  return (
    <div className="comment">
      <Avatar name={nameOf(r.user)} url={r.user?.avatarUrl} className="pavatar" />
      <div className="comment-body">
        <b>{r.user ? <Link to={`/people/${r.user.userId}`} onClick={onOpenPerson} style={{ color: 'inherit' }}>{nameOf(r.user)}</Link> : 'Someone'}</b>
        {editing
          ? <EditBox initial={r.content} onCancel={() => setEditing(false)}
              onSave={async content => { const u = await blogApi.updateReply(r.id, content, r.mentionedUser?.userId); onChanged(u); setEditing(false); }} />
          : <p><MentionTag u={r.mentionedUser} content={r.content} />{r.content}</p>}
        <div className="comment-meta">
          <span>{timeAgo(r.createdAt)}{r.updatedAt && r.updatedAt !== r.createdAt ? ' · edited' : ''}</span>
          <button className={r.likedByMe ? 'on' : ''} onClick={like}>{r.likeCount ? `${r.likeCount} ` : ''}Like</button>
          <button onClick={onReply}>Reply</button>
          {mine && !editing && <button onClick={() => setEditing(true)}>Edit</button>}
          {(mine || canModerate) && <DeleteButton what="reply" onConfirm={onDelete} />}
        </div>
      </div>
    </div>
  );
}

// Confirms in place: the modal layer is already showing the post.
function DeleteButton({ what, onConfirm }: { what: string; onConfirm: () => void }) {
  const [asking, setAsking] = useState(false);
  if (!asking) return <button onClick={() => setAsking(true)}>Delete</button>;
  return (
    <>
      <span style={{ color: 'var(--lacquer)' }}>Delete this {what}?</span>
      <button style={{ color: 'var(--lacquer)' }} onClick={() => { setAsking(false); onConfirm(); }}>Yes, delete</button>
      <button onClick={() => setAsking(false)}>Keep</button>
    </>
  );
}

// The text usually already starts with "@username"; only add a tag when it does not.
function MentionTag({ u, content }: { u: UserBrief | null; content: string }) {
  if (!u || (u.username && content.includes(`@${u.username}`))) return null;
  return <span className="tagchip">@{nameOf(u)} </span>;
}

function EditBox({ initial, onSave, onCancel }: { initial: string; onSave: (content: string) => Promise<void>; onCancel: () => void }) {
  const { toast } = useUI();
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try { await onSave(text.trim()); } catch (err) { toast(apiErrorMessage(err, 'Could not save the change'), 'alert'); setBusy(false); }
  };
  return (
    <form className="inline-form" onSubmit={submit}>
      <input value={text} onChange={e => setText(e.target.value)} aria-label="Edit" maxLength={2000} autoFocus />
      <button className="btn btn-sm" disabled={!text.trim() || busy}>{busy ? <Spinner /> : 'Save'}</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
    </form>
  );
}
