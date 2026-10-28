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
        <p className="kicker">Ôn tập xong</p>
        <h2>Nhớ chắc {ok}/{queue.length} ký hiệu.</h2>
        <p style={{ color: 'var(--ink-2)', margin: '10px 0 20px' }}>
          {ok === queue.length
            ? 'Trọn vẹn! Để ghi nhớ hẳn, hãy ký mỗi ký hiệu một lần trong Phòng tập.'
            : 'Những ký hiệu bạn còn lưỡng lự vẫn ở trong hàng đợi và sẽ quay lại.'}
        </p>
        <div className="row">
          <button className="btn" onClick={closeLayer}>Quay lại học</button>
          <button className="btn btn-ghost" onClick={() => { closeLayer(); navigate('/studio'); }}>
            <Icon name="video" size={15} /> Mở Phòng tập
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <p className="kicker">Thẻ {i + 1}/{queue.length} · từ hàng đợi ôn tập</p>
      <h2>Ký hiệu này nói gì?</h2>
      <div style={{ margin: '16px 0' }}><SignMedia sign={sign} size={160} /></div>
      {!revealed ? (
        <button className="btn" onClick={() => setRevealed(true)} data-autofocus><Icon name="seal" size={16} /> Xem nghĩa</button>
      ) : (
        <div>
          <p style={{ fontFamily: 'var(--fd)', fontSize: 26, fontWeight: 600 }}>{sign.word}</p>
          <p className="notation" style={{ margin: '4px 0 18px' }}>{sign.categoryName}{sign.description ? ` · ${sign.description}` : ''}</p>
          <div className="row">
            <button className="btn btn-ghost" onClick={() => answer(false)}><Icon name="refresh" size={15} /> Ôn lại — mình còn lưỡng lự</button>
            <button className="btn btn-lacquer" onClick={() => answer(true)}><Icon name="check" size={16} /> Mình đã nhớ ra</button>
          </div>
        </div>
      )}
    </>
  );
}
