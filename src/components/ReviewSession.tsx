import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { SignMedia } from './common';
import { useUI } from '../context/UIContext';
import { updatePrefs } from '../lib/prefs';
import type { Sign } from '../lib/signs';

/* Flashcards over the review queue. "Knowing" a card only clears it for today
   on this device; the sign stays LEARNING on the backend until it is signed
   correctly in the Studio. */
export default function ReviewSession({ queue }: { queue: Sign[] }) {
  const { closeLayer } = useUI();
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const [ok, setOk] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const sign = queue[i];

  const answer = (knew: boolean) => {
    if (knew) {
      setOk(n => n + 1);
      updatePrefs(p => ({ reviewedToday: p.reviewedToday.includes(sign.id) ? p.reviewedToday : [...p.reviewedToday, sign.id] }));
    }
    setRevealed(false);
    setI(n => n + 1);
  };

  if (!sign) {
    return (
      <>
        <p className="kicker">Review complete</p>
        <h2>{ok} of {queue.length} recalled with confidence.</h2>
        <p style={{ color: 'var(--ink-2)', margin: '10px 0 20px' }}>
          {ok === queue.length
            ? 'A clean sweep. To lock them in for good, sign them once for the Studio.'
            : 'The ones you hesitated on stay in the queue. They will come back.'}
        </p>
        <div className="row">
          <button className="btn" onClick={closeLayer}>Back to learning</button>
          <button className="btn btn-ghost" onClick={() => { closeLayer(); navigate('/studio'); }}>
            <Icon name="video" size={15} /> Open the Studio
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <p className="kicker">Flashcard {i + 1} of {queue.length} · from your review queue</p>
      <h2>What does this sign say?</h2>
      <div style={{ margin: '16px 0' }}><SignMedia sign={sign} size={160} /></div>
      {!revealed ? (
        <button className="btn" onClick={() => setRevealed(true)} data-autofocus><Icon name="seal" size={16} /> Reveal meaning</button>
      ) : (
        <div>
          <p style={{ fontFamily: 'var(--fd)', fontSize: 26, fontWeight: 600 }}>{sign.word}</p>
          <p className="notation" style={{ margin: '4px 0 18px' }}>{sign.categoryName}{sign.description ? ` · ${sign.description}` : ''}</p>
          <div className="row">
            <button className="btn btn-ghost" onClick={() => answer(false)}><Icon name="refresh" size={15} /> Again — I hesitated</button>
            <button className="btn btn-lacquer" onClick={() => answer(true)}><Icon name="check" size={16} /> I signed it in my head</button>
          </div>
        </div>
      )}
    </>
  );
}
