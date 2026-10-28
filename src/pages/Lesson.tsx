import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { Hand } from '../components/Hand';
import { Loading, SignMedia, StatusTag } from '../components/common';
import { useLearning } from '../context/LearningContext';
import { updatePrefs, usePrefs } from '../lib/prefs';
import type { Sign } from '../lib/signs';
import NotFound from './NotFound';

interface Question { sign: Sign; options: string[] }

const shuffle = <T,>(a: T[]) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
};

/* A guided lesson: watch each sign, then a short recognition check, then claim it.
   Signs become LEARNED on the backend only through a correct Studio attempt, so
   finishing here is recorded on this device and points the learner to the Studio. */
// Keyed by id so moving to the next lesson starts from a clean slate.
export default function LessonRoute() {
  const { id } = useParams();
  return <LessonPage key={id} id={id} />;
}

function LessonPage({ id }: { id?: string }) {
  const L = useLearning();
  const navigate = useNavigate();
  const { completedLessons } = usePrefs();
  const lesson = L.lessons.find(l => l.id === id);
  const signs = useMemo(() => (lesson ? lesson.signIds.map(sid => L.signById.get(sid)).filter(Boolean) as Sign[] : []), [lesson, L.signById]);
  const [pos, setPos] = useState(0);
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState<Record<number, string>>({});
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (!complete) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setComplete(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [complete]);

  const questions = useMemo<Question[]>(() => signs.map(sign => {
    const others = shuffle([...new Set(L.signs.filter(s => s.word !== sign.word).map(s => s.word))]).slice(0, 2);
    return { sign, options: shuffle([...new Set([sign.word, ...others])]) };
  }), [signs, L.signs]);

  if (L.loading) return <section className="view"><Loading /></section>;
  if (!lesson) return <NotFound />;

  const chapter = L.chapters[lesson.chapter];
  if (L.stateOf(lesson) === 'locked') {
    return (
      <section className="view">
        <div className="lockview">
          <span className="st-stamp"><Icon name="lock" size={26} /></span>
          <h1 className="display sm">Bài {lesson.n} vẫn còn ở phía trước</h1>
          <p className="lede" style={{ margin: '10px auto 24px' }}>Hoàn thành bài trước trong “{chapter.category.name}” để mở khóa “{lesson.title}”.</p>
          <Link className="btn" to="/learn">Quay lại lộ trình</Link>
        </div>
      </section>
    );
  }

  const total = signs.length + 1;
  const next = () => { setPos(p => Math.min(p + 1, total - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const claim = () => {
    if (!completedLessons.includes(lesson.id)) {
      updatePrefs(p => ({ completedLessons: [...p.completedLessons, lesson.id], lessonsToday: p.lessonsToday + 1 }));
    }
    setComplete(true);
  };

  const nextLesson = L.lessons.find(l => l.id !== lesson.id && L.stateOf(l) === 'current');
  const score = questions.filter((q, i) => picked[i] === q.sign.word).length;

  return (
    <section className="view">
      <div className="lesson-top">
        <Link className="textlink" to="/learn"><Icon name="arrowl" size={15} /> Lộ trình</Link>
        <span className="kicker">Bài {lesson.n} · {chapter.category.name}</span>
        <div className="stepdots" role="tablist" aria-label="Các bước của bài">
          {Array.from({ length: total }, (_, i) => (
            <button key={i} className={`stepdot ${i < pos ? 'done' : i === pos ? 'now' : ''}`} aria-label={`Bước ${i + 1}`}
              onClick={() => { if (i <= pos) setPos(i); }}>{i < pos ? '✓' : i + 1}</button>
          ))}
        </div>
      </div>

      {pos < signs.length ? (
        <WatchStep sign={signs[pos]} idx={pos + 1} n={signs.length} onNext={next}
          onBack={pos > 0 ? () => setPos(p => p - 1) : undefined}
          onPractise={() => navigate(`/studio?sign=${signs[pos].id}`)} />
      ) : qi < questions.length ? (
        <QuizStep
          q={questions[qi]} n={qi + 1} total={questions.length} picked={picked[qi]}
          onPick={w => setPicked(p => ({ ...p, [qi]: w }))}
          onNext={() => setQi(i => i + 1)}
        />
      ) : (
        <div className="lstep" style={{ gridTemplateColumns: '1fr', textAlign: 'center' }}>
          <div style={{ maxWidth: 460, margin: '30px auto' }}>
            <span style={{ display: 'inline-block', opacity: 0.9 }}><Hand frame={{ shape: 'open', rot: -10 }} size={120} /></span>
            <h2 className="quiz-q">Bạn nhận ra {score}/{questions.length} ký hiệu. Hoàn thành bài nào.</h2>
            <button className="btn btn-lacquer" onClick={claim}><Icon name="seal" size={17} /> Hoàn thành “{lesson.title}”</button>
          </div>
        </div>
      )}

      {complete && (
        <div className="complete-veil" onClick={e => { if (e.target === e.currentTarget) setComplete(false); }}>
          <div className="complete-card" role="dialog" aria-modal="true" aria-label="Hoàn thành bài học">
            <div className="stamp-big"><Icon name="check" size={40} /></div>
            <h2 style={{ fontFamily: 'var(--fd)', fontSize: 30, fontWeight: 600 }}>Hoàn thành bài học</h2>
            <p style={{ color: 'var(--ink-2)', marginTop: 6 }}>“{lesson.title}” giờ đã là của bạn. Hãy ký từng ký hiệu trong Phòng tập để đánh dấu đã thuộc.</p>
            <div className="complete-stats">
              <span>Đã xem {signs.length} ký hiệu</span><span>Nhận ra {score}/{questions.length}</span>
              {L.stats && <span>Chuỗi {L.stats.currentStreak} ngày</span>}
            </div>
            <div className="complete-actions">
              <Link className="btn btn-ghost" to={`/studio?sign=${signs[0]?.id ?? ''}`}><Icon name="video" size={15} /> Luyện các ký hiệu này</Link>
              {nextLesson
                ? <Link className="btn btn-lacquer" to={`/lesson/${nextLesson.id}`}>Bài tiếp theo <Icon name="arrowr" size={16} /></Link>
                : <Link className="btn btn-lacquer" to="/learn">Quay lại lộ trình</Link>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function WatchStep({ sign, idx, n, onNext, onBack, onPractise }: {
  sign: Sign; idx: number; n: number; onNext: () => void; onBack?: () => void; onPractise: () => void;
}) {
  return (
    <div className="lstep">
      <SignMedia sign={sign} size={250} />
      <div>
        <p className="kicker">Ký hiệu {idx}/{n} · xem kỹ</p>
        <h2 className="sign-word">{sign.word}</h2>
        <p className="sign-en">{sign.categoryName}</p>
        <div style={{ marginTop: 12 }} className={`st-${sign.status}`}><StatusTag status={sign.status} /></div>
        <div className="transcript">
          <h4>Cách ký</h4>
          <p>{sign.description || 'Xem video minh họa vài lần. Chú ý hình dạng tay trước, rồi đường đi của tay, rồi tốc độ.'}</p>
        </div>
        <p className="example">
          <em>Xem ba lần: một lần cho hình dạng tay, một lần cho chuyển động, một lần cho nhịp.</em><br />
          <span>Sau đó làm chậm theo gương trước khi thử với tốc độ thật.</span>
        </p>
        <div className="lstep-nav">
          <div className="row">
            {onBack && <button className="iconbtn" onClick={onBack} aria-label="Ký hiệu trước" title="Ký hiệu trước"><Icon name="arrowl" size={17} /></button>}
            <button className="btn btn-ghost btn-sm" onClick={onPractise} disabled={sign.expectedId == null}
              title={sign.expectedId == null ? 'Ký hiệu này chưa được nối với mô hình AI' : undefined}>
              <Icon name="video" size={15} /> Thử trong Phòng tập
            </button>
          </div>
          <button className="btn" onClick={onNext}>{idx < n ? 'Đã hiểu — ký hiệu tiếp' : 'Đã hiểu — kiểm tra nhanh'} <Icon name="arrowr" size={16} /></button>
        </div>
      </div>
    </div>
  );
}

function QuizStep({ q, n, total, picked, onPick, onNext }: {
  q: Question; n: number; total: number; picked?: string; onPick: (w: string) => void; onNext: () => void;
}) {
  const answered = picked !== undefined;
  return (
    <div className="lstep" style={{ gridTemplateColumns: '1fr' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
        <p className="kicker">Kiểm tra · câu {n}/{total}</p>
        <h2 className="quiz-q">Ký hiệu này có nghĩa là gì?</h2>
        <div style={{ maxWidth: 360, marginBottom: 18 }}><SignMedia key={q.sign.id} sign={q.sign} size={170} /></div>
        {q.options.map(o => {
          const cls = answered ? (o === q.sign.word ? 'correct' : o === picked ? 'wrong' : '') : '';
          return <button key={o} className={`opt ${cls}`} disabled={answered} onClick={() => onPick(o)}>{o}</button>;
        })}
        <p className="qnote" aria-live="polite">{answered ? (picked === q.sign.word ? 'Chính xác — đọc tốt lắm.' : 'Chưa đúng. Đáp án đúng đã được tô sáng.') : ''}</p>
        {answered && <button className="btn" onClick={onNext} autoFocus>{n >= total ? 'Hoàn tất' : 'Câu tiếp theo'} <Icon name="arrowr" size={16} /></button>}
      </div>
    </div>
  );
}
