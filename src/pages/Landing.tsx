import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { Hand, SignPlayer, type Frame } from '../components/Hand';
import { Brand } from '../components/common';
import { useAuth } from '../context/AuthContext';
import { publicApi } from '../services';
import type { PublicStats } from '../models';

const HELLO: Frame[] = [{ shape: 'flat' }, { shape: 'flat', rot: 13, dx: 5 }, { shape: 'flat', rot: -9 }, { shape: 'flat', rot: 12, dx: 4 }];

export default function Landing() {
  const { status, isAdmin } = useAuth();
  const [stats, setStats] = useState<PublicStats | null>(null);
  const home = isAdmin ? '/admin' : '/today';

  useEffect(() => { publicApi.stats().then(setStats).catch(() => {}); }, []);

  return (
    <>
      <header className="landing-top">
        <Brand />
        <span className="spacer" />
        {status === 'authed' ? (
          <Link className="btn btn-sm" to={home}>Open SignMentor <Icon name="arrowr" size={15} /></Link>
        ) : (
          <>
            <Link className="textlink hide-sm" to="/login">Sign in</Link>
            <Link className="btn btn-lacquer btn-sm" to="/register">Start learning</Link>
          </>
        )}
      </header>
      <main>
        <section className="view">
          <div className="hero">
            <span className="hero-hand" aria-hidden="true"><Hand frame={{ shape: 'open', rot: 10 }} size={460} /></span>
            <div style={{ position: 'relative' }}>
              <p className="kicker">Vietnamese Sign Language · with an AI coach</p>
              <h1 className="display">Learn to talk with your <em>hands</em>.</h1>
              <p className="lede">
                Watch a sign, copy it in front of your camera, and get scored by a model trained on real signers.
                Short lessons, honest feedback, and a <strong>community one chapter ahead of you</strong>.
              </p>
              <div className="row" style={{ marginTop: 26 }}>
                <Link className="btn btn-lacquer" to={status === 'authed' ? home : '/register'}>
                  <Icon name="play" size={16} /> {status === 'authed' ? 'Continue learning' : 'Create a free account'}
                </Link>
                {status !== 'authed' && <Link className="btn btn-ghost" to="/login">I already have an account</Link>}
              </div>
              {stats && (
                <div className="figs" role="list" style={{ margin: '34px 0 0' }}>
                  <div className="fig" role="listitem"><b>{stats.totalVocabs}</b><span>signs to learn</span></div>
                  <div className="fig" role="listitem"><b>{stats.totalUsers ?? '—'}</b><span>learners</span></div>
                  <div className="fig" role="listitem"><b>{Math.round(stats.satisfactionRate)}%</b><span>would recommend</span></div>
                </div>
              )}
            </div>
            <div className="hero-stage">
              <SignPlayer frames={HELLO} size={220} autoplay />
              <p className="notation" style={{ marginTop: 10 }}><span className="hs-chip">B</span>Xin chào — flat hand, palm out, wave twice</p>
            </div>
          </div>

          <div className="rule-head"><h2>How it works</h2></div>
          <div className="steps-3">
            <div className="step-card"><b>01</b><h3>See it</h3><p>Every sign comes with a tutorial video and lives inside a short lesson of three, ordered the way conversations happen.</p></div>
            <div className="step-card"><b>02</b><h3>Sign it</h3><p>Open the Studio, sign in front of your camera for five seconds, and the model tells you how close you came.</p></div>
            <div className="step-card"><b>03</b><h3>Keep it</h3><p>Signs you have not nailed come back for review. Your streak, accuracy and achievements track the rest.</p></div>
          </div>

          <div className="cta-band">
            <div>
              <p className="kicker" style={{ color: 'rgba(246,240,228,.6)' }}>Five minutes a day</p>
              <h2 className="display sm">Your first <em>hello</em> is one lesson away.</h2>
            </div>
            <Link className="btn cream" to={status === 'authed' ? home : '/register'}>Get started <Icon name="arrowr" size={16} /></Link>
          </div>
        </section>
      </main>
      <footer>
        <span>SignMentor — made for Vietnamese Sign Language learners.</span>
        <span>MSS301 · VSL Platform</span>
      </footer>
    </>
  );
}
