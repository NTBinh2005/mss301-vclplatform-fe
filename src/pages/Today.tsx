import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { Hand, SignPlayer } from '../components/Hand';
import ReviewSession from '../components/ReviewSession';
import { Alert, ArtBanner, EmptyState, Loading, SignMedia, SignThumb } from '../components/common';
import { useAuth } from '../context/AuthContext';
import { useLearning } from '../context/LearningContext';
import { useUI } from '../context/UIContext';
import { blogApi } from '../services';
import type { BlogResponse } from '../models';
import { dayPart, firstName, fmtLongDate, lastSevenDays, nameOf } from '../lib/format';
import { usePrefs } from '../lib/prefs';

export default function Today() {
  const { user } = useAuth();
  const L = useLearning();
  const ui = useUI();
  const navigate = useNavigate();
  const { goal, reduceMotion } = usePrefs();
  const [post, setPost] = useState<BlogResponse | null>(null);
  const [drawn, setDrawn] = useState(false);
  const [ask, setAsk] = useState('');

  useEffect(() => { blogApi.published(0, 1).then(p => setPost(p.content[0] ?? null)).catch(() => {}); }, []);
  useEffect(() => { const r = requestAnimationFrame(() => setDrawn(true)); return () => cancelAnimationFrame(r); }, []);

  if (L.loading) return <section className="view"><Loading label="Đang chuẩn bị ngày học của bạn…" /></section>;

  const streak = L.stats?.currentStreak ?? 0;
  const known = L.stats?.learnedCount ?? L.signs.filter(s => s.status === 'learned').length;
  const next = L.nextLesson;
  const review = () => ui.openModal(<ReviewSession queue={L.due} />, 'Ôn tập');

  // The backend counts a day toward the streak once the learner makes a Studio attempt.
  const best = L.stats?.longestStreak ?? 0;
  const week = L.stats?.weekActivity?.length === 7 ? L.stats.weekActivity : Array(7).fill(false);
  const days = lastSevenDays();
  const safeToday = L.attemptsToday > 0 || week[6];
  const goalPct = Math.min(100, Math.round((L.activityToday / goal) * 100));

  const learned = L.signs.filter(s => s.status === 'learned');
  const pool = learned.length ? learned : L.signs;
  const sod = pool.length ? pool[Math.floor(Date.now() / 864e5) % pool.length] : null;
  const featured = next ? L.signById.get(next.signIds[0]) : null;

  return (
    <section className="view">
      <span className="hero-hand" aria-hidden="true"><Hand frame={{ shape: 'open', rot: 10 }} size={460} /></span>
      {L.error && <div style={{ marginBottom: 20 }}><Alert>{L.error} <button className="linkbtn" onClick={L.reload}>Thử lại</button></Alert></div>}
      <div className="masthead">
        <div>
          <p className="kicker">{fmtLongDate(new Date())}</p>
          <h1 className="display">Chào buổi {dayPart()}, <em>{firstName(user?.fullName)}</em>.</h1>
          <p className="lede">
            Bạn đã biết <strong>{known} ký hiệu</strong> Ngôn ngữ Ký hiệu Việt Nam.{' '}
            {L.due.length
              ? <><strong>{L.due.length} ký hiệu bạn đã luyện vẫn cần tập thêm</strong> — trí nhớ phai nhanh nhất vào ngày thứ ba.</>
              : 'Hôm nay không có gì cần ôn. Học thêm điều mới bên dưới nhé.'}
          </p>
        </div>
        <ArtBanner variant="today" knownCount={known} dueCount={L.due.length} />
      </div>

      <section className="streak-card" aria-label="Chuỗi ngày học">
        <div className="streak-count">
          <span className={`streak-flame ${safeToday ? 'lit' : ''}`}><Icon name="flame" size={30} /></span>
          <div>
            <b>{streak}</b>
            <span>ngày liên tiếp</span>
            <small>{best > streak ? `Kỷ lục: ${best} ngày` : streak ? 'Kỷ lục của bạn' : 'Bắt đầu từ hôm nay'}</small>
          </div>
        </div>

        <ol className="streak-week" aria-label="Luyện tập trong 7 ngày qua">
          {week.map((on: boolean, i: number) => (
            <li key={i} className={`${on || (i === 6 && safeToday) ? 'on' : ''} ${i === 6 ? 'today' : ''}`}>
              <i>{(on || (i === 6 && safeToday)) && <Icon name="check" size={14} />}</i>
              <span>{i === 6 ? 'Hôm nay' : days[i]}</span>
            </li>
          ))}
        </ol>

        <div className="streak-status">
          {safeToday ? (
            <p><strong>Chuỗi hôm nay đã an toàn.</strong> Mai quay lại để lên {streak + 1} ngày.</p>
          ) : (
            <p><strong>{streak ? `Giữ chuỗi ${streak} ngày của bạn.` : 'Chưa có chuỗi ngày học.'}</strong> Chỉ cần một lần tập trong Phòng tập hôm nay.</p>
          )}
          <div className="goal-bar" aria-label={`Mục tiêu ngày ${L.activityToday}/${goal}`}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="kicker"><Icon name="target" size={12} /> Mục tiêu ngày</span>
              <span className="faint" style={{ fontSize: 12.5, fontWeight: 600 }}>{Math.min(L.activityToday, goal)}/{goal}</span>
            </div>
            <div className="skill-track"><div className="skill-fill" style={{ width: drawn ? `${goalPct}%` : 0, background: goalPct >= 100 ? 'var(--success)' : undefined }} /></div>
          </div>
          {!safeToday && <button className="btn btn-lacquer btn-sm" onClick={() => navigate('/studio')}><Icon name="video" size={15} /> Luyện ngay</button>}
        </div>
      </section>

      <div className="home-grid">
        <div className="home-main">
          <div className="rule-head"><h2>Học tiếp</h2><Link className="textlink" to="/learn">Toàn bộ lộ trình <Icon name="arrowr" size={14} /></Link></div>
          {next && featured ? (
            <article className="feature-lesson">
              <SignMedia sign={featured} size={190} autoplay={!reduceMotion} />
              <div>
                <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                  <span className="pill lacquer">Bài {next.n}</span>
                  <span className="kicker">{L.chapters[next.chapter].category.name}</span>
                </div>
                <h3 className="feature-title">{next.title}</h3>
                <p className="feature-sub">{next.signIds.map(id => L.signById.get(id)?.word).join(' · ')} — khoảng {next.minutes} phút</p>
                <Link className="btn btn-lacquer" to={`/lesson/${next.id}`}><Icon name="play" size={16} /> Học tiếp bài này</Link>
              </div>
            </article>
          ) : (
            <EmptyState title={L.lessons.length ? 'Đã học xong mọi bài' : 'Chưa có bài học'}
              body={L.lessons.length ? 'Bạn đã đi hết lộ trình. Hãy giữ tay nghề trong Phòng tập.' : 'Quản trị viên cần thêm chủ đề và ký hiệu trước.'}
              action={L.lessons.length ? <Link className="btn btn-sm" to="/studio">Mở Phòng tập</Link> : undefined} />
          )}

          <div className="rule-head">
            <h2>Cần ôn tập</h2>
            {L.due.length > 0 && <button className="textlink" onClick={review}>Ôn tất cả ({L.due.length}) <Icon name="arrowr" size={14} /></button>}
          </div>
          {L.due.length ? (
            <div className="filmstrip">
              {L.due.map(sg => (
                <button key={sg.id} className="strip-card" onClick={() => ui.openModal(<ReviewSession queue={[sg]} />, 'Ôn tập')}>
                  <SignThumb sign={sg} />
                  <span className="strip-word">{sg.word}</span><span className="strip-meta">{sg.categoryName}</span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="Đã ôn hết" body="Chưa có gì cần ôn — mọi ký hiệu bạn đã luyện đều từng làm đúng ít nhất một lần." />
          )}
        </div>

        <aside className="home-rail">
          <section className="rail-block mentor-block">
            <h2 className="rail-title"><span className="mentor-dot" />Hỏi Mentor</h2>
            <p>Huấn luyện viên biết rõ bạn đang ở đâu. Hãy hỏi kế hoạch, cách ký, hay xin chút động lực.</p>
            <div className="chip-row" style={{ marginTop: 12 }}>
              <button className="chip" onClick={() => ui.openMentor('Lên kế hoạch ôn tập hôm nay')}>Lên kế hoạch ôn tập</button>
              {sod && <button className="chip" onClick={() => ui.openMentor(`Ký “${sod.word}” thế nào?`)}>Ký “{sod.word}” thế nào?</button>}
              <button className="chip" onClick={() => ui.openMentor('Mình thấy bế tắc')}>Mình thấy bế tắc</button>
            </div>
            <form className="mentor-mini" onSubmit={e => { e.preventDefault(); if (ask.trim()) { ui.openMentor(ask.trim()); setAsk(''); } }}>
              <input placeholder="Hỏi bất cứ điều gì…" aria-label="Hỏi Mentor" value={ask} onChange={e => setAsk(e.target.value)} />
              <button className="iconbtn" aria-label="Gửi cho Mentor"><Icon name="send" size={16} /></button>
            </form>
          </section>

          {sod && (
            <section className="rail-block rail-card">
              <h2 className="rail-title"><Icon name="sparkles" size={17} /> Ký hiệu của ngày</h2>
              <div className="sod">
                <span className="sod-media">
                  {sod.imageUrl ? <SignThumb sign={sod} size={110} /> : <SignPlayer frames={sod.frames} size={96} autoplay={!reduceMotion} chrome={false} />}
                </span>
                <div style={{ minWidth: 0 }}>
                  <h3>{sod.word}</h3>
                  <p style={{ color: 'var(--ink-2)', fontSize: 14 }}>{sod.categoryName}</p>
                  {sod.description && <p className="notation">{sod.description}</p>}
                  {sod.expectedId != null
                    ? <Link className="textlink" to={`/studio?sign=${sod.id}`}>Luyện trong Phòng tập <Icon name="arrowr" size={14} /></Link>
                    : <Link className="textlink" to={`/dictionary?q=${encodeURIComponent(sod.word)}`}>Mở trong từ điển <Icon name="arrowr" size={14} /></Link>}
                </div>
              </div>
            </section>
          )}

          <section className="rail-block rail-card">
            <h2 className="rail-title"><Icon name="users" size={17} /> Từ cộng đồng</h2>
            {post ? (
              <Link className="pulse-item" to={`/community?post=${post.id}`}><span className="kicker">{nameOf(post.author)} · {post.likeCount} lượt thích</span><strong>{post.title}</strong></Link>
            ) : (
              <p>Chưa có bài viết — hãy là người đầu tiên chia sẻ mẹo.</p>
            )}
            <Link className="pulse-item" to="/request"><span className="kicker">Thiếu từ?</span><strong>Đề xuất thêm ký hiệu vào từ điển</strong></Link>
          </section>
        </aside>
      </div>
    </section>
  );
}
