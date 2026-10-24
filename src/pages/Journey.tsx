import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { Alert, EmptyState, Loading } from '../components/common';
import { useLearning } from '../context/LearningContext';
import { useUI } from '../context/UIContext';

export default function Journey() {
  const L = useLearning();
  const { toast } = useUI();
  if (L.loading) return <section className="view"><Loading /></section>;

  const done = L.lessons.filter(l => L.stateOf(l) === 'done').length;
  const chaptersDone = L.chapters.filter(c => c.lessons.length && c.lessons.every(l => L.stateOf(l) === 'done')).length;
  const left = L.chapters.length - chaptersDone;
  const pct = L.lessons.length ? Math.round((done / L.lessons.length) * 100) : 0;

  return (
    <section className="view">
      {L.error && <div style={{ marginBottom: 20 }}><Alert>{L.error}</Alert></div>}
      <p className="kicker">Your journey</p>
      <h1 className="display sm">
        {chaptersDone === 0 ? <>Every signer starts<br /><em>somewhere</em>.</>
          : left ? <>{chaptersDone} {chaptersDone === 1 ? 'chapter' : 'chapters'} down,<br /><em>{left} to go</em>.</>
          : <>Every chapter done —<br /><em>the trail is yours</em>.</>}
      </h1>
      <p className="lede">
        You have finished <strong>{done} of {L.lessons.length} lessons</strong>. Each chapter is a topic; each lesson is three signs
        you watch, check yourself on, then take to the Studio.
      </p>
      {L.lessons.length > 0 && (
        <div className="journey-prog" aria-label={`${pct}% of the journey complete`}>
          <div className="skill-track"><div className="skill-fill" style={{ width: `${pct}%` }} /></div>
          <span>{pct}%</span>
          {L.nextLesson && <Link className="btn btn-lacquer btn-sm" to={`/lesson/${L.nextLesson.id}`}><Icon name="play" size={14} /> Lesson {L.nextLesson.n}</Link>}
        </div>
      )}

      {L.chapters.length === 0 && <EmptyState title="No chapters yet" body="An administrator needs to add categories and signs before the journey can begin." />}

      <div style={{ marginTop: 26 }}>
        {L.chapters.map((c, ci) => {
          const dn = c.lessons.filter(l => L.stateOf(l) === 'done').length;
          return (
            <section className="chapter" key={c.category.id}>
              <div className="chap-head">
                <span className="chap-num">Ch. {ci + 1}</span>
                <h2>{c.category.name}</h2>
                <span className="chap-prog">{c.lessons.length > 0 && dn === c.lessons.length ? <span className="pill ink">Complete</span> : `${dn}/${c.lessons.length} lessons`}</span>
              </div>
              {c.category.description && <p style={{ color: 'var(--ink-2)', fontSize: 14.5 }}>{c.category.description}</p>}
              {c.lessons.length === 0 && <p className="mini-words" style={{ padding: '12px 0' }}>No signs in this chapter yet.</p>}
              {c.lessons.map(l => {
                const st = L.stateOf(l);
                return (
                  <div className={`station ${st}`} key={l.id}>
                    <span className="st-stamp"><Icon name={st === 'done' ? 'check' : st === 'current' ? 'play' : 'lock'} size={st === 'locked' ? 16 : 18} /></span>
                    <div className="st-main">
                      <h3>Lesson {l.n} — {l.title}</h3>
                      <p className="st-meta">{l.minutes} min · <span className="mini-words">{l.signIds.map(id => L.signById.get(id)?.word).join(' · ')}</span></p>
                    </div>
                    {st === 'current' && <Link className="btn btn-lacquer btn-sm st-cta" to={`/lesson/${l.id}`}>Continue <Icon name="arrowr" size={15} /></Link>}
                    {st === 'done' && <Link className="textlink st-cta" to={`/lesson/${l.id}`}>Revisit</Link>}
                    {st === 'locked' && (
                      <button className="textlink st-cta" style={{ color: 'var(--ink-3)' }}
                        onClick={() => toast('Finish the previous lesson in this chapter to unlock this one', 'lock')}>Locked</button>
                    )}
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </section>
  );
}
