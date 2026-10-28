import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { Hand, SignPlayer } from '../components/Hand';
import ReviewSession from '../components/ReviewSession';
import { Alert, EmptyState, Loading, SignMedia, SignThumb } from '../components/common';
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

  if (L.loading) return <section className="view"><Loading label="Getting your day ready…" /></section>;

  const streak = L.stats?.currentStreak ?? 0;
  const known = L.stats?.learnedCount ?? L.signs.filter(s => s.status === 'learned').length;
  const next = L.nextLesson;
  const review = () => ui.openModal(<ReviewSession queue={L.due} />, 'Review');

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
      {L.error && <div style={{ marginBottom: 20 }}><Alert>{L.error} <button className="linkbtn" onClick={L.reload}>Try again</button></Alert></div>}
      <div className="masthead">
        <div>
          <p className="kicker">{fmtLongDate(new Date())}</p>
          <h1 className="display">Good {dayPart()}, <em>{firstName(user?.fullName)}</em>.</h1>
          <p className="lede">
            You know <strong>{known} {known === 1 ? 'sign' : 'signs'}</strong> in Vietnamese Sign Language.{' '}
            {L.due.length
              ? <><strong>{L.due.length} of your practised signs still need work</strong> — memory fades fastest at day three.</>
              : 'Nothing is due today. Learn something new below.'}
          </p>
        </div>
      </div>

      <section className="streak-card" aria-label="Your streak">
        <div className="streak-count">
          <span className={`streak-flame ${safeToday ? 'lit' : ''}`}><Icon name="flame" size={30} /></span>
          <div>
            <b>{streak}</b>
            <span>day streak</span>
            <small>{best > streak ? `Best: ${best} days` : streak ? 'Your best yet' : 'Start one today'}</small>
          </div>
        </div>

        <ol className="streak-week" aria-label="Practice in the last 7 days">
          {week.map((on: boolean, i: number) => (
            <li key={i} className={`${on || (i === 6 && safeToday) ? 'on' : ''} ${i === 6 ? 'today' : ''}`}>
              <i>{(on || (i === 6 && safeToday)) && <Icon name="check" size={14} />}</i>
              <span>{i === 6 ? 'Today' : days[i]}</span>
            </li>
          ))}
        </ol>

        <div className="streak-status">
          {safeToday ? (
            <p><strong>Streak safe for today.</strong> Come back tomorrow to make it {streak + 1}.</p>
          ) : (
            <p><strong>{streak ? `Keep your ${streak}-day streak alive.` : 'No streak yet.'}</strong> One Studio attempt today counts.</p>
          )}
          <div className="goal-bar" aria-label={`Daily goal ${L.activityToday} of ${goal}`}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="kicker">Daily goal</span><span className="faint" style={{ fontSize: 12.5 }}>{Math.min(L.activityToday, goal)}/{goal}</span>
            </div>
            <div className="skill-track"><div className="skill-fill" style={{ width: drawn ? `${goalPct}%` : 0, background: goalPct >= 100 ? 'var(--mentor)' : undefined }} /></div>
          </div>
          {!safeToday && <button className="btn btn-lacquer btn-sm" onClick={() => navigate('/studio')}><Icon name="video" size={15} /> Practise now</button>}
        </div>
      </section>

      <div className="home-grid">
        <div className="home-main">
          <div className="rule-head"><h2>Continue learning</h2><Link className="textlink" to="/learn">Full journey <Icon name="arrowr" size={14} /></Link></div>
          {next && featured ? (
            <article className="feature-lesson">
              <SignMedia sign={featured} size={190} autoplay={!reduceMotion} />
              <div>
                <p className="kicker">Lesson {next.n} · {L.chapters[next.chapter].category.name}</p>
                <h3 className="feature-title">{next.title}</h3>
                <p className="feature-sub">{next.signIds.map(id => L.signById.get(id)?.word).join(' · ')} — about {next.minutes} min</p>
                <Link className="btn btn-lacquer" to={`/lesson/${next.id}`}><Icon name="play" size={16} /> Continue lesson</Link>
              </div>
            </article>
          ) : (
            <EmptyState title={L.lessons.length ? 'Every lesson is done' : 'No lessons yet'}
              body={L.lessons.length ? 'You have walked the whole journey. Keep your signs sharp in the Studio.' : 'An administrator needs to add categories and signs first.'}
              action={L.lessons.length ? <Link className="btn btn-sm" to="/studio">Open the Studio</Link> : undefined} />
          )}

          <div className="rule-head">
            <h2>Due for review</h2>
            {L.due.length > 0 && <button className="textlink" onClick={review}>Review all ({L.due.length}) <Icon name="arrowr" size={14} /></button>}
          </div>
          {L.due.length ? (
            <div className="filmstrip">
              {L.due.map(sg => (
                <button key={sg.id} className="strip-card" onClick={() => ui.openModal(<ReviewSession queue={[sg]} />, 'Review')}>
                  <SignThumb sign={sg} />
                  <span className="strip-word">{sg.word}</span><span className="strip-meta">{sg.categoryName}</span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="All caught up" body="Nothing is due right now — every sign you practised has landed at least once." />
          )}
        </div>

        <aside className="home-rail">
          <section className="rail-block mentor-block">
            <h2 className="rail-title"><span className="mentor-dot" />Ask Mentor</h2>
            <p>Your coach knows exactly where you are. Ask for a plan, a sign, or a pep talk.</p>
            <div className="chip-row" style={{ marginTop: 12 }}>
              <button className="chip" onClick={() => ui.openMentor('Plan my review for today')}>Plan my review</button>
              {sod && <button className="chip" onClick={() => ui.openMentor(`How do I sign “${sod.word}”?`)}>How do I sign “{sod.word}”?</button>}
              <button className="chip" onClick={() => ui.openMentor('I feel stuck')}>I feel stuck</button>
            </div>
            <form className="mentor-mini" onSubmit={e => { e.preventDefault(); if (ask.trim()) { ui.openMentor(ask.trim()); setAsk(''); } }}>
              <input placeholder="Ask anything…" aria-label="Ask Mentor" value={ask} onChange={e => setAsk(e.target.value)} />
              <button className="iconbtn" aria-label="Send to Mentor"><Icon name="send" size={16} /></button>
            </form>
          </section>

          {sod && (
            <section className="rail-block">
              <h2 className="rail-title">Sign of the day</h2>
              <div className="sod">
                <span className="sod-media">
                  {sod.imageUrl ? <SignThumb sign={sod} size={110} /> : <SignPlayer frames={sod.frames} size={96} autoplay={!reduceMotion} chrome={false} />}
                </span>
                <div style={{ minWidth: 0 }}>
                  <h3>{sod.word}</h3>
                  <p style={{ color: 'var(--ink-2)', fontSize: 14 }}>{sod.categoryName}</p>
                  {sod.description && <p className="notation">{sod.description}</p>}
                  {sod.expectedId != null
                    ? <Link className="textlink" to={`/studio?sign=${sod.id}`}>Practise in Studio <Icon name="arrowr" size={14} /></Link>
                    : <Link className="textlink" to={`/dictionary?q=${encodeURIComponent(sod.word)}`}>Open in the dictionary <Icon name="arrowr" size={14} /></Link>}
                </div>
              </div>
            </section>
          )}

          <section className="rail-block">
            <h2 className="rail-title">From the common room</h2>
            {post ? (
              <Link className="pulse-item" to={`/community?post=${post.id}`}><span className="kicker">{nameOf(post.author)} · {post.likeCount} {post.likeCount === 1 ? 'like' : 'likes'}</span><strong>{post.title}</strong></Link>
            ) : (
              <p>No posts yet — be the first to share a tip.</p>
            )}
            <Link className="pulse-item" to="/request"><span className="kicker">Missing a word?</span><strong>Request a sign for the dictionary</strong></Link>
          </section>
        </aside>
      </div>
    </section>
  );
}
