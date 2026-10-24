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
        <p className="kicker">Error 404</p>
        <h1 className="display sm" style={{ marginTop: 8 }}>This page signed away.</h1>
        <p className="lede" style={{ margin: '10px auto 24px' }}>The address does not match anything here. It may have moved, or the link was mistyped.</p>
        <Link className="btn" to={home}><Icon name="arrowl" size={15} /> Back to {status !== 'authed' ? 'the start' : isAdmin ? 'the back office' : 'Today'}</Link>
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
