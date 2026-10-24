import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { SignPlayer } from './Hand';
import ReviewSession from './ReviewSession';
import { useAuth } from '../context/AuthContext';
import { useLearning } from '../context/LearningContext';
import { useUI } from '../context/UIContext';
import { firstName } from '../lib/format';
import { usePrefs } from '../lib/prefs';
import type { Sign } from '../lib/signs';

/* Mentor is a rule-based coach that reads the learner's real progress. The
   backend has no chat endpoint yet; swap `reply()` for an API call when it does. */

interface Msg { id: number; me: boolean; body: ReactNode; action?: { label: string; run: () => void } }

export default function MentorDrawer({ ask }: { ask?: string }) {
  const { user } = useAuth();
  const learning = useLearning();
  const { goal, reduceMotion } = usePrefs();
  const ui = useUI();
  const navigate = useNavigate();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const seq = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const asked = useRef(false);

  const { due, nextLesson, stats, signs, activityToday } = learning;
  const streak = stats?.currentStreak ?? 0;

  const go = (path: string) => () => { ui.closeLayer(); navigate(path); };
  const review = () => ui.openModal(<ReviewSession queue={due} />, 'Review');
  const push = (m: Omit<Msg, 'id'>) => setMsgs(list => [...list, { ...m, id: ++seq.current }]);

  const findSign = (q: string): Sign | undefined => {
    const quoted = q.match(/[“"']([^”"']+)[”"']/)?.[1];
    const tail = q.match(/sign\s+(.+?)\??$/i)?.[1];
    const needle = (quoted || tail || '').trim().toLowerCase();
    if (!needle) return signs.find(s => q.toLowerCase().includes(s.word.toLowerCase()));
    return signs.find(s => s.word.toLowerCase() === needle) || signs.find(s => s.word.toLowerCase().includes(needle));
  };

  const reply = (q: string) => {
    const lq = q.toLowerCase();
    const target = findSign(q);
    if (/review|ôn|plan/.test(lq)) {
      push({
        me: false,
        body: <>Here is your plan: <strong>{due.length} signs</strong> are waiting for review
          {due.length ? <> — start with “{due[0].word}”, you have practised it but not nailed it yet</> : null}.
          {nextLesson && <> After that, Lesson {nextLesson.n} takes about {nextLesson.minutes} minutes.</>} Two minutes of review now saves twenty tomorrow.</>,
        action: due.length ? { label: 'Start the review', run: review } : nextLesson ? { label: 'Open the lesson', run: go(`/lesson/${nextLesson.id}`) } : undefined,
      });
    } else if (target) {
      push({
        me: false,
        body: <>
          <div className="sp" style={{ alignItems: 'flex-start' }}><SignPlayer frames={target.frames} size={110} autoplay /></div>
          “{target.word}” · {target.categoryName}. {target.description || 'Watch the tutorial video in the Dictionary, then copy it in front of the camera.'} Try it with me:
        </>,
        action: { label: 'Practise in Studio', run: go(`/studio?sign=${target.id}`) },
      });
    } else if (/streak|day|ngày/.test(lq)) {
      push({
        me: false,
        body: <>You are on a <strong>{streak}-day streak</strong>{stats?.longestStreak ? <> (your best is {stats.longestStreak})</> : null}. Today needs {Math.max(0, goal - activityToday)} more {goal - activityToday === 1 ? 'activity' : 'activities'} to hit your goal — and one Studio attempt keeps the streak alive.</>,
      });
    } else if (/stuck|hard|difficult|khó|frustrat/.test(lq)) {
      push({
        me: false,
        body: <>Being stuck is data, not failure. Usually it means you are drilling recall when you need production — so go to the Studio and <em>do</em> the signs — or you are tired, in which case one calm flashcard is a perfectly good session.</>,
        action: { label: 'Take me to the Studio', run: go('/studio') },
      });
    } else if (/accura|score|điểm/.test(lq) && stats) {
      push({
        me: false,
        body: <>Across {stats.totalAttempts} attempts you are at <strong>{Math.round(stats.accuracyRate)}% accuracy</strong>, with {stats.learnedCount} of {stats.totalVocabs} signs learned. The fastest way up is short, frequent attempts on the signs still marked “learning”.</>,
      });
    } else {
      push({
        me: false,
        body: <>Here is what I would do next: review {due.length || 'a few'} signs{nextLesson ? <>, finish Lesson {nextLesson.n}</> : null}, then three minutes in the Studio. That is the whole loop — see, sign, get corrected.</>,
        action: nextLesson ? { label: `Continue Lesson ${nextLesson.n}`, run: go(`/lesson/${nextLesson.id}`) } : { label: 'Open the Studio', run: go('/studio') },
      });
    }
  };

  const send = (q: string) => {
    push({ me: true, body: q });
    setTyping(true);
    window.setTimeout(() => { setTyping(false); reply(q); }, reduceMotion ? 200 : 900);
  };

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    push({
      me: false,
      body: <>Chào {firstName(user?.fullName)} — {streak ? `day ${streak}, and counting.` : 'good to see you.'} {due.length
        ? `${due.length} signs are slipping toward the exit; a two-minute review would catch them.`
        : nextLesson ? `Your review queue is clear, so today is for new ground: Lesson ${nextLesson.n} is waiting.` : 'Your review queue is clear.'} What shall we do?</>,
    });
    if (ask) send(ask);
  }, []); // greet once per open

  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [msgs, typing]);

  return (
    <div className="drawer" role="dialog" aria-modal="true" aria-label="Mentor, AI coach">
      <div className="drawer-head">
        <span className="mentor-dot" style={{ boxShadow: '0 0 0 5px rgba(20,101,90,.15)' }} />
        <div style={{ flex: 1 }}><h2>Mentor</h2><p>Your sign-language coach · knows your progress</p></div>
        <button className="iconbtn" onClick={ui.closeLayer} aria-label="Close Mentor"><Icon name="x" /></button>
      </div>
      <div className="msgs" ref={box}>
        {msgs.map(m => (
          <div key={m.id} className={`msg ${m.me ? 'me' : 'bot'}`}>
            {m.body}
            {m.action && <div><button className="btn btn-sm btn-lacquer" onClick={m.action.run}>{m.action.label}</button></div>}
          </div>
        ))}
        {typing && <div className="msg bot"><span className="typing"><i /><i /><i /></span></div>}
      </div>
      <form className="drawer-form" onSubmit={e => { e.preventDefault(); const v = text.trim(); if (v) { send(v); setText(''); } }}>
        <input placeholder="Ask about any sign, or your plan…" aria-label="Message Mentor" value={text} onChange={e => setText(e.target.value)} />
        <button className="iconbtn" style={{ background: 'var(--mentor)', color: 'var(--paper)' }} aria-label="Send"><Icon name="send" size={16} /></button>
      </form>
    </div>
  );
}
