import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { Hand } from '../components/Hand';
import { Brand } from '../components/common';
import { useAuth } from '../context/AuthContext';

/* Rendered inside a shell (e.g. an unknown lesson id) or, for unknown URLs,
   on its own — then it brings a minimal top bar so the page is not stranded. */
export default function NotFound({ standalone = false }: { standalone?: boolean }) {
  const { status, isAdmin } = useAuth();
  const home = status !== 'authed' ? '/' : isAdmin ? '/admin' : '/today';
  const body = (
    <section className="view">
      <div className="lockview">
        <span style={{ display: 'inline-block', opacity: 0.25, marginBottom: 12 }}><Hand frame={{ shape: 'flat', rot: -12, arc: 'side' }} size={110} /></span>
        <p className="kicker">Lỗi 404</p>
        <h1 className="display sm" style={{ marginTop: 8 }}>Trang này đã “ký” đi mất rồi.</h1>
        <p className="lede" style={{ margin: '10px auto 24px' }}>Địa chỉ này không khớp với trang nào. Có thể trang đã được chuyển đi hoặc đường dẫn bị gõ sai.</p>
        <Link className="btn" to={home}><Icon name="arrowl" size={15} /> Quay về {status !== 'authed' ? 'trang đầu' : isAdmin ? 'trang quản trị' : 'Hôm nay'}</Link>
      </div>
    </section>
  );
  if (!standalone) return body;
  return (
    <>
      <header className="landing-top"><Brand to={home} /></header>
      <main id="app">{body}</main>
    </>
  );
}
