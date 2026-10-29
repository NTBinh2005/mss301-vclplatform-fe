import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon';
import PostView from '../components/PostView';
import { Alert, ArtBanner, Avatar, EmptyState, Loading, Spinner } from '../components/common';
import { useAuth } from '../context/AuthContext';
import { useLearning } from '../context/LearningContext';
import { useUI } from '../context/UIContext';
import { blogApi, notificationApi } from '../services';
import { apiErrorMessage } from '../api/errors';
import type { BlogResponse, BlogSearchResponse, NotificationResponse } from '../models';
import { excerpt, nameOf, notificationText, postBody, timeAgo } from '../lib/format';

export function CommunityHeader({ tab }: { tab: 'room' | 'mine' }) {
  const navigate = useNavigate();
  return (
    <div className="page-banner">
      <div className="page-banner-copy">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p className="kicker">Cộng đồng</p>
            <h1 className="display sm">{tab === 'room' ? <>Học là một cuộc <em>trò chuyện</em>.</> : <>Bài viết <em>của bạn</em>.</>}</h1>
          </div>
          <div className="seg" role="tablist">
            <button role="tab" aria-selected={tab === 'room'} className={tab === 'room' ? 'on' : ''} onClick={() => navigate('/community')}>Cộng đồng</button>
            <button role="tab" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'on' : ''} onClick={() => navigate('/community/mine')}>Bài của tôi</button>
          </div>
        </div>
        <p className="lede">
          {tab === 'room'
            ? 'Mẹo luyện tập từ những người đi trước bạn một chương, văn hóa Điếc từ chính người trong cuộc, và những cột mốc truyền cảm hứng.'
            : 'Bản nháp chỉ mình bạn thấy cho tới khi đăng. Bài bị quản trị viên gỡ sẽ hiện lý do tại đây.'}
        </p>
      </div>
      <ArtBanner variant="community" />
    </div>
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
  const [notes, setNotes] = useState<NotificationResponse[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async (p: number) => {
    try {
      const res = await blogApi.published(p, 10);
      setPosts(list => (p === 0 ? res.content : [...(list || []), ...res.content]));
      setPage(p);
      setLast(res.last);
      setError('');
    } catch (err) {
      setPosts(list => list || []);
      setError(apiErrorMessage(err, 'Không tải được bảng tin cộng đồng.'));
    }
  }, []);

  useEffect(() => { load(0); }, [load]);
  useEffect(() => {
    notificationApi.list(0, 8).then(r => setNotes(r.content)).catch(() => {});
    notificationApi.unreadCount().then(setUnread).catch(() => {});
  }, []);

  const patch = useCallback((p: BlogResponse) => setPosts(list => list?.map(x => (x.id === p.id ? p : x)) ?? list), []);
  const open = useCallback((p: BlogResponse) => ui.openModal(<PostView post={p} onChange={patch} />, p.title), [ui, patch]);

  // Shared links land here as ?post=<id>.
  useEffect(() => {
    const id = Number(params.get('post'));
    if (!id) return;
    setParams({}, { replace: true });
    blogApi.get(id).then(open).catch(() => ui.toast('Bài viết này không còn nữa', 'alert'));
  }, [params, setParams, open, ui]);

  const publish = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) { ui.toast('Hãy đặt tiêu đề và viết vài dòng trước đã', 'flag'); return; }
    setPosting(true);
    try {
      const created = await blogApi.create({ title: title.trim(), content: content.trim(), status: 'PUBLISHED' });
      setPosts(list => [created, ...(list || [])]);
      setTitle(''); setContent('');
      ui.toast('Đã đăng lên cộng đồng', 'send');
    } catch (err) {
      ui.toast(apiErrorMessage(err, 'Không đăng được bài viết'), 'alert');
    } finally { setPosting(false); }
  };

  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (!q.trim()) { setFound(null); return; }
    try { setFound(await blogApi.search(q.trim(), 0, 10)); } catch (err) { ui.toast(apiErrorMessage(err, 'Tìm kiếm thất bại'), 'alert'); }
  };

  const markAll = async () => {
    try { await notificationApi.markAllRead(); setUnread(0); setNotes(n => n.map(x => ({ ...x, read: true }))); } catch { /* ignore */ }
  };

  const openNote = async (n: NotificationResponse) => {
    if (!n.read) { notificationApi.markRead(n.id).catch(() => {}); setUnread(u => Math.max(0, u - 1)); setNotes(list => list.map(x => (x.id === n.id ? { ...x, read: true } : x))); }
    if (n.blogId) blogApi.get(n.blogId).then(open).catch(() => ui.toast('Bài viết này không còn nữa', 'alert'));
    else if (n.type === 'FOLLOW' && n.actor) navigate(`/people/${n.actor.userId}`);
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
          <input placeholder="Chia sẻ một mẹo, một thành tích hay một câu hỏi…" value={title} onChange={e => setTitle(e.target.value)} aria-label="Tiêu đề bài viết" maxLength={255} />
        </div>
        {title && (
          <>
            <textarea placeholder="Kể câu chuyện của bạn…" value={content} onChange={e => setContent(e.target.value)} aria-label="Nội dung bài viết" />
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setTitle(''); setContent(''); }}>Hủy</button>
              <button className="btn btn-sm" disabled={posting}>{posting ? <Spinner /> : <Icon name="send" size={15} />} Đăng</button>
            </div>
          </>
        )}
      </form>

      <div className="comm-grid" style={{ marginTop: 26 }}>
        <div>
          <form className="dict-search" onSubmit={search} style={{ maxWidth: 'none', marginBottom: 16 }}>
            <Icon name="search" size={17} />
            <input placeholder="Tìm bài viết và mọi người…" value={q} onChange={e => { setQ(e.target.value); if (!e.target.value) setFound(null); }} aria-label="Tìm bài viết" />
            {q && <button type="button" className="clear-x" onClick={() => { setQ(''); setFound(null); }} aria-label="Xóa tìm kiếm"><Icon name="x" size={15} /></button>}
          </form>
          {found && (
            <p className="result-line">
              {found.blogs.content.length} bài viết cho “{q.trim()}”
              <button className="linkbtn" onClick={() => { setQ(''); setFound(null); }}>Quay lại bảng tin</button>
            </p>
          )}
          {error && <Alert>{error}</Alert>}

          {found && found.users.content.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <p className="kicker" style={{ marginBottom: 8 }}>Mọi người</p>
              <div className="chip-row">
                {found.users.content.map(u => (
                  <Link key={u.userId} className="chip" to={`/people/${u.userId}`}><Avatar name={nameOf(u)} url={u.avatarUrl} size={22} /> {nameOf(u)}
                    <span className="faint">· {u.followerCount} người theo dõi{u.friend ? ' · bạn bè' : u.followedByMe ? ' · đang theo dõi' : ''}</span></Link>
                ))}
              </div>
            </div>
          )}

          {posts === null ? <Loading /> : (
            <>
              {featured && (
                <button className="feature-post" onClick={() => open(featured)}>
                  <span className="tagchip">Nổi bật · nhiều lượt thích nhất</span>
                  <h3>{featured.title}</h3>
                  <p>{excerpt(postBody(featured), 220)}</p>
                  <p className="pmeta" style={{ marginTop: 12 }}>
                    <b style={{ color: 'var(--ink)' }}>{nameOf(featured.author)}</b> · {timeAgo(featured.createdAt)} · {featured.likeCount} lượt thích · {featured.commentCount} bình luận
                  </p>
                </button>
              )}
              <div style={{ marginTop: 10 }}>
                {feed.map(p => <PostRow key={p.id} p={p} onOpen={() => open(p)} />)}
              </div>
              {list.length === 0 && !error && (
                <EmptyState title={found ? 'Không có bài phù hợp' : 'Cộng đồng đang yên ắng'} body={found ? 'Thử từ khóa khác.' : 'Hãy là người đầu tiên chia sẻ một mẹo, thành tích hay câu hỏi.'} />
              )}
              {!found && !last && <div style={{ textAlign: 'center', marginTop: 20 }}><button className="btn btn-ghost btn-sm" onClick={() => load(page + 1)}>Xem thêm</button></div>}
            </>
          )}
        </div>

        <aside>
          {challenge && (
            <div className="challenge">
              <div className="challenge-photo" aria-hidden="true">
                <img src="/banners/challenge-banner.jpg" alt="" />
              </div>
              <span className="tagchip">Thử thách tuần</span>
              <h3>Ký “{challenge.word}” và chia sẻ</h3>
              <p>Chấm điểm trong Phòng tập, rồi đăng bài kể lại — chỗ nào ổn, chỗ nào chưa.</p>
              <p className="subs">Tuần này ai cũng có chung một ký hiệu</p>
              <button className="btn btn-sm" onClick={() => { navigate(`/studio?sign=${challenge.id}`); ui.toast(`Nhận thử thách — ký “${challenge.word}”`, 'flag'); }}>
                <Icon name="video" size={15} /> Tham gia — đến Phòng tập
              </button>
            </div>
          )}

          <div className="side-block">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ fontFamily: 'var(--fd)', fontSize: 17, margin: 0 }}>Thông báo {unread > 0 && <span className="badge-dot">{unread}</span>}</h3>
              {unread > 0 && <button className="linkbtn" style={{ fontSize: 12.5 }} onClick={markAll}>Đánh dấu đã đọc hết</button>}
            </div>
            {notes.length ? notes.map(n => (
              <button key={n.id} className={`notif ${n.read ? '' : 'unread'}`} onClick={() => openNote(n)}>
                <b>{nameOf(n.actor)}</b> {notificationText(n.type)}
                <span>{n.blogTitle ? `${n.blogTitle} · ` : ''}{timeAgo(n.createdAt)}</span>
              </button>
            )) : <p className="muted" style={{ fontSize: 13.5, marginTop: 8 }}>Lượt thích, bình luận, lượt nhắc tên và người theo dõi mới sẽ hiện ở đây.</p>}
          </div>

          {discussions.length > 0 && (
            <div className="side-block">
              <h3 style={{ fontFamily: 'var(--fd)', fontSize: 17 }}>Thảo luận sôi nổi</h3>
              {discussions.map(p => (
                <button key={p.id} className="disc-item" style={{ width: '100%', textAlign: 'left' }} onClick={() => open(p)}>
                  <b>{p.title}</b><span>{nameOf(p.author)} · {p.commentCount} bình luận</span>
                </button>
              ))}
            </div>
          )}

          <div className="side-block">
            <h3 style={{ fontFamily: 'var(--fd)', fontSize: 17 }}>Bài viết của bạn</h3>
            <p className="muted" style={{ fontSize: 13.5, marginBottom: 10 }}>Sửa bản nháp, thêm ảnh bìa, hoặc xem ghi chú của quản trị viên.</p>
            <Link className="btn btn-ghost btn-sm" to="/community/mine"><Icon name="edit" size={14} /> Bài của tôi</Link>
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
        <p>{excerpt(postBody(p))}</p>
        <span className="pmeta">
          <span>{nameOf(p.author)} · {timeAgo(p.createdAt)}</span>
          <span className="row" style={{ gap: 12 }}>
            <span className={p.likedByMe ? 'liked' : ''}><Icon name="heart" size={13} /> {p.likeCount}</span>
            <span><Icon name="comment" size={13} /> {p.commentCount}</span>
          </span>
        </span>
      </span>
    </button>
  );
}
