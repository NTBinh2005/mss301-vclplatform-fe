import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import PostView from '../components/PostView';
import { Alert, Avatar, EmptyState, Loading } from '../components/common';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { blogApi, followApi, userApi } from '../services';
import { apiErrorMessage } from '../api/errors';
import type { BlogResponse, FollowStatusResponse, SharedBlogResponse, SocialUserResponse, UserSummary } from '../models';
import { excerpt, nameOf, postBody, timeAgo } from '../lib/format';

type Tab = 'posts' | 'shared' | 'followers' | 'following' | 'friends';
const TABS: [Tab, string][] = [['posts', 'Bài viết'], ['shared', 'Được chia sẻ'], ['followers', 'Người theo dõi'], ['following', 'Đang theo dõi'], ['friends', 'Bạn bè']];

/* Someone's public page: who they are, their published posts, posts shared onto
   their page, and their followers / following / friends. */
export default function People() {
  const { id } = useParams();
  const userId = Number(id);
  const { user: me } = useAuth();
  const ui = useUI();
  const [person, setPerson] = useState<UserSummary | null>(null);
  const [rel, setRel] = useState<FollowStatusResponse | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('posts');
  const isMe = me?.userId === userId;

  useEffect(() => {
    setPerson(null); setRel(null); setError(''); setTab('posts');
    if (!userId) { setError('Không có người dùng này.'); return; }
    userApi.get(userId).then(setPerson).catch(err => setError(apiErrorMessage(err, 'Không tìm thấy người dùng này.')));
    followApi.stats(userId).then(setRel).catch(() => {});
  }, [userId]);

  const toggleFollow = async () => {
    if (!rel) return;
    try {
      setRel(rel.followedByMe ? await followApi.unfollow(userId) : await followApi.follow(userId));
    } catch (err) { ui.toast(apiErrorMessage(err, 'Không cập nhật được theo dõi'), 'alert'); }
  };

  if (error) return <section className="view"><Alert>{error}</Alert></section>;
  if (!person) return <section className="view"><Loading /></section>;
  const name = nameOf(person);

  return (
    <section className="view">
      <Link className="textlink" to="/community"><Icon name="arrowl" size={15} /> Cộng đồng</Link>
      <div className="row" style={{ gap: 18, marginTop: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <Avatar name={name} url={person.avatarUrl} size={72} />
        <div style={{ minWidth: 0 }}>
          <p className="kicker">@{person.username}{rel?.followsMe && !isMe ? ' · đang theo dõi bạn' : ''}</p>
          <h1 className="display sm">{name}</h1>
          {rel && (
            <p className="faint" style={{ fontSize: 13.5 }}>
              {rel.followerCount} người theo dõi · đang theo dõi {rel.followingCount} · {rel.friendCount} bạn bè
            </p>
          )}
        </div>
        <span className="spacer" />
        {isMe
          ? <Link className="btn btn-ghost btn-sm" to="/profile"><Icon name="edit" size={14} /> Sửa hồ sơ</Link>
          : rel && (
            <button className={`btn btn-sm ${rel.followedByMe ? 'btn-ghost' : ''}`} onClick={toggleFollow}>
              <Icon name="users" size={14} /> {rel.followedByMe ? (rel.friend ? 'Bạn bè · bỏ theo dõi' : 'Đang theo dõi · bỏ theo dõi') : rel.followsMe ? 'Theo dõi lại' : 'Theo dõi'}
            </button>
          )}
      </div>

      <div className="seg" role="tablist" style={{ marginTop: 24 }}>
        {TABS.map(([t, label]) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{label}</button>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        {tab === 'posts' && <PostsTab userId={userId} />}
        {tab === 'shared' && <SharedTab userId={userId} />}
        {(tab === 'followers' || tab === 'following' || tab === 'friends') && <PeopleTab userId={userId} kind={tab} />}
      </div>
    </section>
  );
}

function usePaged<T>(load: (page: number) => Promise<{ content: T[]; last: boolean }>) {
  const [items, setItems] = useState<T[] | null>(null);
  const [page, setPage] = useState(0);
  const [last, setLast] = useState(true);
  const [error, setError] = useState('');
  const fetchPage = useCallback(async (p: number) => {
    try {
      const r = await load(p);
      setItems(list => (p === 0 ? r.content : [...(list || []), ...r.content]));
      setPage(p); setLast(r.last); setError('');
    } catch (err) { setItems(list => list || []); setError(apiErrorMessage(err, 'Không tải được danh sách này.')); }
  }, [load]);
  useEffect(() => { setItems(null); fetchPage(0); }, [fetchPage]);
  return { items, error, last, more: () => fetchPage(page + 1), setItems };
}

function PostsTab({ userId }: { userId: number }) {
  const ui = useUI();
  const load = useCallback((p: number) => blogApi.byAuthor(userId, p, 10), [userId]);
  const { items, error, last, more, setItems } = usePaged<BlogResponse>(load);
  const patch = (b: BlogResponse) => setItems(list => list?.map(x => (x.id === b.id ? b : x)) ?? list);
  // Owners and admins also get drafts / removed posts here; the public page shows published ones.
  const visible = items?.filter(p => p.status === 'PUBLISHED') ?? null;
  if (!visible) return <Loading />;
  return (
    <>
      {error && <Alert>{error}</Alert>}
      {visible.length === 0 && !error && <EmptyState title="Chưa có bài viết" body="Bài đã đăng sẽ hiện ở đây." />}
      {visible.map(p => (
        <button key={p.id} className="post" onClick={() => ui.openModal(<PostView post={p} onChange={patch} />, p.title)}>
          <span className="pthumb" aria-hidden="true">{p.thumbnailUrl ? <img src={p.thumbnailUrl} alt="" /> : <Icon name="book" size={28} />}</span>
          <span style={{ minWidth: 0 }}>
            <h4>{p.title}</h4>
            <p>{excerpt(postBody(p))}</p>
            <span className="pmeta"><span>{timeAgo(p.createdAt)}</span><span>{p.likeCount} lượt thích · {p.commentCount} bình luận</span></span>
          </span>
        </button>
      ))}
      {!last && <div style={{ textAlign: 'center', marginTop: 16 }}><button className="btn btn-ghost btn-sm" onClick={more}>Xem thêm</button></div>}
    </>
  );
}

function SharedTab({ userId }: { userId: number }) {
  const ui = useUI();
  const load = useCallback((p: number) => blogApi.sharedOnProfile(userId, p, 10), [userId]);
  const { items, error, last, more } = usePaged<SharedBlogResponse>(load);
  if (!items) return <Loading />;
  return (
    <>
      {error && <Alert>{error}</Alert>}
      {items.length === 0 && !error && <EmptyState title="Chưa có bài được chia sẻ" body="Bài được chủ trang hoặc bạn bè chia sẻ lên trang này sẽ hiện ở đây." />}
      {items.map(s => (
        <button key={s.shareId} className="post" onClick={() => ui.openModal(<PostView post={s.blog} />, s.blog.title)}>
          <span className="pthumb" aria-hidden="true">{s.blog.thumbnailUrl ? <img src={s.blog.thumbnailUrl} alt="" /> : <Icon name="share" size={28} />}</span>
          <span style={{ minWidth: 0 }}>
            <span className="kicker">{nameOf(s.sharedBy)} đã chia sẻ · {timeAgo(s.sharedAt)}</span>
            <h4>{s.blog.title}</h4>
            <p>{excerpt(postBody(s.blog))}</p>
            <span className="pmeta"><span>{nameOf(s.blog.author)}</span><span>{s.blog.likeCount} lượt thích</span></span>
          </span>
        </button>
      ))}
      {!last && <div style={{ textAlign: 'center', marginTop: 16 }}><button className="btn btn-ghost btn-sm" onClick={more}>Xem thêm</button></div>}
    </>
  );
}

function PeopleTab({ userId, kind }: { userId: number; kind: 'followers' | 'following' | 'friends' }) {
  const load = useCallback((p: number) => followApi[kind](userId, p, 30), [userId, kind]);
  const { items, error, last, more } = usePaged<SocialUserResponse>(load);
  if (!items) return <Loading />;
  return (
    <>
      {error && <Alert>{error}</Alert>}
      {items.length === 0 && !error && <EmptyState title="Chưa có ai" body={kind === 'friends' ? 'Bạn bè là hai người theo dõi lẫn nhau.' : 'Chưa có ai để hiển thị.'} />}
      <div className="people-list">
        {items.map(u => (
          <Link key={u.userId} className="person-row" to={`/people/${u.userId}`}>
            <Avatar name={nameOf(u)} url={u.avatarUrl} size={40} />
            <span style={{ minWidth: 0 }}>
              <b>{nameOf(u)}</b> <span className="faint">@{u.username}</span><br />
              <span className="faint" style={{ fontSize: 12.5 }}>
                {u.followerCount} người theo dõi{u.friend ? ' · bạn bè' : u.followedByMe ? ' · bạn đang theo dõi' : u.followsMe ? ' · đang theo dõi bạn' : ''}
              </span>
            </span>
          </Link>
        ))}
      </div>
      {!last && <div style={{ textAlign: 'center', marginTop: 16 }}><button className="btn btn-ghost btn-sm" onClick={more}>Xem thêm</button></div>}
    </>
  );
}
