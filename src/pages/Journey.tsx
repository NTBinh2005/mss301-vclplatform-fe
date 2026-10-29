import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { Alert, ArtBanner, EmptyState, Loading } from '../components/common';
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
      <div className="page-banner">
        <div className="page-banner-copy">
          <p className="kicker">Lộ trình của bạn</p>
          <h1 className="display sm">
            {chaptersDone === 0 ? <>Ai cũng bắt đầu<br /><em>từ đâu đó</em>.</>
              : left ? <>Xong {chaptersDone} chương,<br /><em>còn {left} chương</em>.</>
              : <>Hoàn thành mọi chương —<br /><em>lộ trình là của bạn</em>.</>}
          </h1>
          <p className="lede">
            Bạn đã học xong <strong>{done}/{L.lessons.length} bài</strong>. Mỗi chương là một chủ đề; mỗi bài gồm ba ký hiệu
            để xem, tự kiểm tra, rồi mang vào Phòng tập.
          </p>
          {L.lessons.length > 0 && (
            <div className="journey-prog" aria-label={`Đã hoàn thành ${pct}% lộ trình`}>
              <div className="skill-track"><div className="skill-fill" style={{ width: `${pct}%` }} /></div>
              <span>{pct}%</span>
              {L.nextLesson && <Link className="btn btn-lacquer btn-sm" to={`/lesson/${L.nextLesson.id}`}><Icon name="play" size={14} /> Bài {L.nextLesson.n}</Link>}
            </div>
          )}
        </div>
        <ArtBanner variant="journey" />
      </div>

      {L.chapters.length === 0 && <EmptyState title="Chưa có chương nào" body="Quản trị viên cần thêm chủ đề và ký hiệu trước khi bắt đầu lộ trình." />}

      <div style={{ marginTop: 26 }}>
        {L.chapters.map((c, ci) => {
          const dn = c.lessons.filter(l => L.stateOf(l) === 'done').length;
          return (
            <section className="chapter" key={c.category.id}>
              <div className="chap-head">
                <span className="chap-num">Chương {ci + 1}</span>
                <h2>{c.category.name}</h2>
                <span className="chap-prog">{c.lessons.length > 0 && dn === c.lessons.length ? <span className="pill ink">Hoàn thành</span> : `${dn}/${c.lessons.length} bài`}</span>
              </div>
              {c.category.description && <p style={{ color: 'var(--ink-2)', fontSize: 14.5 }}>{c.category.description}</p>}
              {c.lessons.length === 0 && <p className="mini-words" style={{ padding: '12px 0' }}>Chương này chưa có ký hiệu.</p>}
              {c.lessons.map(l => {
                const st = L.stateOf(l);
                return (
                  <div className={`station ${st}`} key={l.id}>
                    <span className="st-stamp"><Icon name={st === 'done' ? 'check' : st === 'current' ? 'play' : 'lock'} size={st === 'locked' ? 16 : 18} /></span>
                    <div className="st-main">
                      <h3>Bài {l.n} — {l.title}</h3>
                      <p className="st-meta">{l.minutes} phút · <span className="mini-words">{l.signIds.map(id => L.signById.get(id)?.word).join(' · ')}</span></p>
                    </div>
                    {st === 'current' && <Link className="btn btn-lacquer btn-sm st-cta" to={`/lesson/${l.id}`}>Học tiếp <Icon name="arrowr" size={15} /></Link>}
                    {st === 'done' && <Link className="textlink st-cta" to={`/lesson/${l.id}`}>Học lại</Link>}
                    {st === 'locked' && (
                      <button className="textlink st-cta" style={{ color: 'var(--ink-3)' }}
                        onClick={() => toast('Hoàn thành bài trước trong chương để mở khóa bài này', 'lock')}>Đã khóa</button>
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
