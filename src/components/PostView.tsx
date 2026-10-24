import { type FormEvent, useEffect, useState } from 'react';
import Icon from './Icon';
import { Alert, Avatar, Loading, Spinner } from './common';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { blogApi } from '../services';
import { apiErrorMessage } from '../api/errors';
import type { BlogCommentResponse, BlogReplyResponse, BlogResponse } from '../models';
import { timeAgo } from '../lib/format';

/* Full post inside the modal layer: body, likes, follow, share, report and the
   comment thread with replies. `onChange` keeps the feed's counters in sync. */
export default function PostView({ post: initial, onChange }: { post: BlogResponse; onChange?: (p: BlogResponse) => void }) {
  const { user } = useAuth();
  const { toast } = useUI();
  const [post, setPost] = useState(initial);
  const [comments, setComments] = useState<BlogCommentResponse[] | null>(null);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  const isMine = post.authorId === user?.userId;

  const update = (p: BlogResponse) => { setPost(p); onChange?.(p); };

  useEffect(() => {
    blogApi.get(initial.id).then(update).catch(() => {});
    blogApi.comments(initial.id).then(setComments).catch(err => { setComments([]); setError(apiErrorMessage(err, 'Could not load comments.')); });
  }, [initial.id]);

  const like = async () => {
    try {
      const r = await blogApi.toggleLike(post.id);
      update({ ...post, likedByMe: r.liked, likeCount: r.likeCount });
    } catch (err) { toast(apiErrorMessage(err, 'Could not like the post'), 'alert'); }
  };

  const follow = async () => {
    if (!post.authorId) return;
    try {
      const r = post.followedAuthor ? await blogApi.unfollow(post.authorId) : await blogApi.follow(post.authorId);
      update({ ...post, followedAuthor: r.followedByMe, friendWithAuthor: r.friend });
      toast(r.followedByMe ? `Following ${post.authorName}` : `Unfollowed ${post.authorName}`, 'users');
    } catch (err) { toast(apiErrorMessage(err, 'Could not update follow'), 'alert'); }
  };

  const share = async () => {
    const url = `${window.location.origin}/community?post=${post.id}`;
    try { await navigator.clipboard.writeText(url); toast('Link copied', 'share'); } catch { toast(url, 'share'); }
    blogApi.shareLink(post.id).catch(() => {});
  };

  const report = async (e: FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    try {
      await blogApi.report(post.id, reason.trim());
      setReporting(false); setReason('');
      toast('Thanks — a moderator will take a look', 'flag');
    } catch (err) { toast(apiErrorMessage(err, 'Could not send the report'), 'alert'); }
  };

  const addComment = async (e: FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || busy) return;
    setBusy(true);
    try {
      const c = await blogApi.addComment(post.id, content);
      setComments(list => [...(list || []), { ...c, replies: [], replyCount: 0 }]);
      setText('');
      update({ ...post, commentCount: post.commentCount + 1 });
    } catch (err) { toast(apiErrorMessage(err, 'Could not post the comment'), 'alert'); } finally { setBusy(false); }
  };

  const removeComment = async (c: BlogCommentResponse) => {
    try {
      await blogApi.deleteComment(post.id, c.id);
      setComments(list => (list || []).filter(x => x.id !== c.id));
      update({ ...post, commentCount: Math.max(0, post.commentCount - 1) });
    } catch (err) { toast(apiErrorMessage(err, 'Could not delete the comment'), 'alert'); }
  };

  return (
    <article>
      <span className="tagchip">{post.authorName || 'Anonymous'} · {timeAgo(post.createdAt)}</span>
      <h2>{post.title}</h2>
      {post.thumbnailUrl && <img className="post-thumb" src={post.thumbnailUrl} alt="" />}
      <div className="post-body">{post.content}</div>

      <div className="post-actions">
        <button className={`chip ${post.likedByMe ? 'on' : ''}`} onClick={like} aria-pressed={post.likedByMe}>
          <Icon name="heart" size={15} /> {post.likeCount}
        </button>
        <span className="chip" aria-label={`${post.commentCount} comments`}><Icon name="comment" size={15} /> {post.commentCount}</span>
        <button className="chip" onClick={share}><Icon name="share" size={15} /> Share</button>
        {!isMine && post.authorId && (
          <button className={`chip ${post.followedAuthor ? 'on' : ''}`} onClick={follow}>
            <Icon name="users" size={15} /> {post.followedAuthor ? (post.friendWithAuthor ? 'Friends' : 'Following') : 'Follow author'}
          </button>
        )}
        {!isMine && <button className="chip" onClick={() => setReporting(r => !r)}><Icon name="flag" size={15} /> Report</button>}
      </div>

      {reporting && (
        <form className="inline-form" onSubmit={report} style={{ marginBottom: 16 }}>
          <input placeholder="What is wrong with this post?" value={reason} onChange={e => setReason(e.target.value)} aria-label="Report reason" autoFocus />
          <button className="btn btn-sm btn-lacquer" disabled={!reason.trim()}>Send report</button>
        </form>
      )}

      <h3 className="serif" style={{ fontSize: 18, fontWeight: 600 }}>Comments</h3>
      {error && <Alert>{error}</Alert>}
      {comments === null ? <Loading label="Loading comments…" /> : comments.length === 0 && !error
        ? <p className="muted" style={{ fontSize: 14, padding: '10px 0' }}>No comments yet. Start the conversation.</p>
        : comments.map(c => <Comment key={c.id} c={c} myId={user?.userId} onDelete={() => removeComment(c)} />)}

      <form className="inline-form" onSubmit={addComment}>
        <input placeholder="Add a comment…" value={text} onChange={e => setText(e.target.value)} aria-label="Add a comment" />
        <button className="btn btn-sm" disabled={!text.trim() || busy}>{busy ? <Spinner /> : <Icon name="send" size={14} />} Post</button>
      </form>
    </article>
  );
}

function Comment({ c, myId, onDelete }: { c: BlogCommentResponse; myId?: number; onDelete: () => void }) {
  const { toast } = useUI();
  const [liked, setLiked] = useState(c.likedByMe);
  const [likes, setLikes] = useState(c.likeCount);
  const [replies, setReplies] = useState<BlogReplyResponse[] | null>(c.replies?.length ? c.replies : null);
  const [count, setCount] = useState(c.replyCount);
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState('');

  const like = async () => {
    try { const r = await blogApi.toggleCommentLike(c.id); setLiked(r.liked); setLikes(r.likeCount); }
    catch (err) { toast(apiErrorMessage(err, 'Could not like the comment'), 'alert'); }
  };
  const loadReplies = async () => {
    try { setReplies((await blogApi.replies(c.id)).content); } catch (err) { toast(apiErrorMessage(err, 'Could not load replies'), 'alert'); }
  };
  const reply = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      const r = await blogApi.addReply(c.id, text.trim());
      setReplies(list => [...(list || []), r]);
      setCount(n => n + 1);
      setText(''); setReplying(false);
    } catch (err) { toast(apiErrorMessage(err, 'Could not post the reply'), 'alert'); }
  };
  const removeReply = async (r: BlogReplyResponse) => {
    try { await blogApi.deleteReply(r.id); setReplies(list => (list || []).filter(x => x.id !== r.id)); setCount(n => Math.max(0, n - 1)); }
    catch (err) { toast(apiErrorMessage(err, 'Could not delete the reply'), 'alert'); }
  };

  return (
    <div className="comment">
      <Avatar name={c.userName} url={c.userAvatar} className="pavatar" />
      <div className="comment-body">
        <b>{c.userName || 'Someone'}</b>
        <p>{c.content}</p>
        <div className="comment-meta">
          <span>{timeAgo(c.createdAt)}</span>
          <button className={liked ? 'on' : ''} onClick={like}>{likes ? `${likes} ` : ''}Like</button>
          <button onClick={() => setReplying(r => !r)}>Reply</button>
          {count > 0 && replies === null && <button onClick={loadReplies}>View {count} {count === 1 ? 'reply' : 'replies'}</button>}
          {c.userId === myId && <button onClick={onDelete}>Delete</button>}
        </div>
        {(replies?.length || replying) ? (
          <div className="replies">
            {replies?.map(r => (
              <div className="comment" key={r.id}>
                <Avatar name={r.userName} url={r.userAvatar} className="pavatar" />
                <div className="comment-body">
                  <b>{r.userName || 'Someone'}</b>
                  <p>{r.mentionedUserName && <span className="tagchip">@{r.mentionedUserName} </span>}{r.content}</p>
                  <div className="comment-meta">
                    <span>{timeAgo(r.createdAt)}</span>
                    {r.userId === myId && <button onClick={() => removeReply(r)}>Delete</button>}
                  </div>
                </div>
              </div>
            ))}
            {replying && (
              <form className="inline-form" onSubmit={reply}>
                <input placeholder={`Reply to ${c.userName || 'this comment'}…`} value={text} onChange={e => setText(e.target.value)} aria-label="Reply" autoFocus />
                <button className="btn btn-sm" disabled={!text.trim()}>Reply</button>
              </form>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
