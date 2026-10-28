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
  const review = () => ui.openModal(<ReviewSession queue={due} />, 'Ôn tập');
  const push = (m: Omit<Msg, 'id'>) => setMsgs(list => [...list, { ...m, id: ++seq.current }]);

  const findSign = (q: string): Sign | undefined => {
    const quoted = q.match(/[“"']([^”"']+)[”"']/)?.[1];
    const tail = q.match(/(?:sign|ký hiệu|ký)\s+(.+?)(?:\s+(?:thế nào|như thế nào|ra sao))?\??$/i)?.[1];
    const needle = (quoted || tail || '').trim().toLowerCase();
    if (!needle) return signs.find(s => q.toLowerCase().includes(s.word.toLowerCase()));
    return signs.find(s => s.word.toLowerCase() === needle) || signs.find(s => s.word.toLowerCase().includes(needle));
  };

  const reply = (q: string) => {
    const lq = q.toLowerCase();
    const target = findSign(q);
    if (/review|ôn|plan|kế hoạch/.test(lq)) {
      push({
        me: false,
        body: <>Kế hoạch của bạn: <strong>{due.length} ký hiệu</strong> đang chờ ôn
          {due.length ? <> — bắt đầu với “{due[0].word}”, bạn đã luyện nhưng chưa làm đúng</> : null}.
          {nextLesson && <> Sau đó, Bài {nextLesson.n} mất khoảng {nextLesson.minutes} phút.</>} Hai phút ôn hôm nay tiết kiệm hai mươi phút ngày mai.</>,
        action: due.length ? { label: 'Bắt đầu ôn', run: review } : nextLesson ? { label: 'Mở bài học', run: go(`/lesson/${nextLesson.id}`) } : undefined,
      });
    } else if (target) {
      push({
        me: false,
        body: <>
          <div className="sp" style={{ alignItems: 'flex-start' }}><SignPlayer frames={target.frames} size={110} autoplay /></div>
          “{target.word}” · {target.categoryName}. {target.description || 'Xem video hướng dẫn trong Từ điển, rồi làm theo trước camera.'} Thử cùng mình nhé:
        </>,
        action: { label: 'Luyện trong Phòng tập', run: go(`/studio?sign=${target.id}`) },
      });
    } else if (/streak|day|ngày|chuỗi/.test(lq)) {
      push({
        me: false,
        body: <>Bạn đang có <strong>chuỗi {streak} ngày</strong>{stats?.longestStreak ? <> (kỷ lục là {stats.longestStreak})</> : null}. Hôm nay cần thêm {Math.max(0, goal - activityToday)} hoạt động để đạt mục tiêu — và chỉ một lần tập trong Phòng tập là giữ được chuỗi.</>,
      });
    } else if (/stuck|hard|difficult|khó|bế tắc|nản|frustrat/.test(lq)) {
      push({
        me: false,
        body: <>Bế tắc là dữ liệu, không phải thất bại. Thường là do bạn chỉ ôn để nhớ trong khi cần <em>làm</em> — hãy vào Phòng tập và ký thật — hoặc bạn đang mệt, khi đó một thẻ ôn nhẹ nhàng cũng là một buổi học tốt.</>,
        action: { label: 'Đến Phòng tập', run: go('/studio') },
      });
    } else if (/accura|score|điểm|chính xác/.test(lq) && stats) {
      push({
        me: false,
        body: <>Qua {stats.totalAttempts} lần tập, độ chính xác của bạn là <strong>{Math.round(stats.accuracyRate)}%</strong>, đã thuộc {stats.learnedCount}/{stats.totalVocabs} ký hiệu. Cách tiến bộ nhanh nhất là tập ngắn, thường xuyên với các ký hiệu còn “đang học”.</>,
      });
    } else {
      push({
        me: false,
        body: <>Nếu là mình, mình sẽ: ôn {due.length || 'vài'} ký hiệu{nextLesson ? <>, học xong Bài {nextLesson.n}</> : null}, rồi ba phút trong Phòng tập. Đó là cả vòng lặp — xem, ký, được sửa.</>,
        action: nextLesson ? { label: `Học tiếp bài ${nextLesson.n}`, run: go(`/lesson/${nextLesson.id}`) } : { label: 'Mở Phòng tập', run: go('/studio') },
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
      body: <>Chào {firstName(user?.fullName)} — {streak ? `ngày thứ ${streak} liên tiếp rồi đấy.` : 'rất vui được gặp bạn.'} {due.length
        ? `${due.length} ký hiệu đang dần bị quên; hai phút ôn tập sẽ giữ chúng lại.`
        : nextLesson ? `Hàng đợi ôn tập đã trống, hôm nay hãy học điều mới: Bài ${nextLesson.n} đang chờ.` : 'Hàng đợi ôn tập đã trống.'} Mình làm gì nhé?</>,
    });
    if (ask) send(ask);
  }, []); // greet once per open

  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [msgs, typing]);

  return (
    <div className="drawer" role="dialog" aria-modal="true" aria-label="Mentor, huấn luyện viên AI">
      <div className="drawer-head">
        <span className="mentor-dot" style={{ boxShadow: '0 0 0 5px rgba(20,101,90,.15)' }} />
        <div style={{ flex: 1 }}><h2>Mentor</h2><p>Huấn luyện viên ngôn ngữ ký hiệu · nắm rõ tiến độ của bạn</p></div>
        <button className="iconbtn" onClick={ui.closeLayer} aria-label="Đóng Mentor"><Icon name="x" /></button>
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
        <input placeholder="Hỏi về một ký hiệu, hoặc kế hoạch học…" aria-label="Nhắn cho Mentor" value={text} onChange={e => setText(e.target.value)} />
        <button className="iconbtn" style={{ background: 'var(--mentor)', color: 'var(--paper)' }} aria-label="Gửi"><Icon name="send" size={16} /></button>
      </form>
    </div>
  );
}
