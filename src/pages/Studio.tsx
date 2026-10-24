import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { Hand } from '../components/Hand';
import { EmptyState, Loading } from '../components/common';
import { useLearning } from '../context/LearningContext';
import { useUI } from '../context/UIContext';
import { practiceApi } from '../services';
import { apiErrorMessage } from '../api/errors';
import type { EvaluationResponse } from '../models';
import { usePrefs } from '../lib/prefs';
import type { Sign } from '../lib/signs';

const RECORD_MS = 5000;
const COUNT_FROM = 3;
type Phase = 'idle' | 'countdown' | 'recording' | 'analyzing' | 'result' | 'failed';
type Cam = 'starting' | 'on' | 'denied' | 'unsupported';

const VERDICT: Record<EvaluationResponse['status'], string> = {
  CORRECT: 'Signed correctly',
  ALMOST_CORRECT: 'Almost there',
  INCORRECT: 'Keep drilling',
};
const ANALYZE_STEPS = ['Uploading your clip…', 'Reading handshape…', 'Tracing movement path…', 'Comparing with the reference…'];

function pickMime(): string | undefined {
  const options = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
  return options.find(t => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t));
}

export default function Studio() {
  const L = useLearning();
  const { toast } = useUI();
  const { reduceMotion } = usePrefs();
  const [params, setParams] = useSearchParams();
  const requested = Number(params.get('sign')) || null;

  // The practice set: the sign asked for, then signs that need work, then the
  // next lesson. Only signs wired to the AI model (expectedId) can be scored.
  const set = useMemo(() => {
    const scorable = (s?: Sign): s is Sign => !!s && s.expectedId != null;
    const picks = [
      requested ? L.signById.get(requested) : undefined,
      ...L.due,
      ...(L.nextLesson?.signIds.map(id => L.signById.get(id)) ?? []),
    ].filter(scorable);
    const unique = [...new Map(picks.map(s => [s.id, s])).values()];
    return unique.length ? unique.slice(0, 10) : L.signs.filter(scorable).slice(0, 8);
  }, [requested, L.signById, L.due, L.nextLesson, L.signs]);

  const [idx, setIdx] = useState(0);
  useEffect(() => { setIdx(0); }, [requested]);
  const sign = set[Math.min(idx, set.length - 1)];

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timers = useRef<number[]>([]);
  const raf = useRef<number | null>(null);
  const [cam, setCam] = useState<Cam>('starting');
  const [phase, setPhase] = useState<Phase>('idle');
  const [count, setCount] = useState(COUNT_FROM);
  const [label, setLabel] = useState('Mirror view · guide on');
  const [result, setResult] = useState<EvaluationResponse | null>(null);
  const [failure, setFailure] = useState('');
  const [typed, setTyped] = useState('');
  const [drawn, setDrawn] = useState(false);

  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  const clearTimers = () => { timers.current.forEach(t => window.clearTimeout(t)); timers.current = []; };

  const startCam = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setCam('unsupported'); return; }
    setCam('starting');
    try {
      // 16:9 HD: low requested resolutions make many webcams crop tighter,
      // which cuts off the arms that sign language needs.
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
      setCam('on');
    } catch {
      setCam('denied');
    }
  }, []);

  useEffect(() => {
    startCam();
    return () => {
      clearTimers();
      if (raf.current) cancelAnimationFrame(raf.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [startCam]);

  // Type the model's message out like a coach note.
  useEffect(() => {
    const text = result?.message || '';
    if (reduceMotion || !text) { setTyped(text); return; }
    setTyped('');
    let i = 0;
    const t = window.setInterval(() => { i++; setTyped(text.slice(0, i)); if (i >= text.length) window.clearInterval(t); }, 14);
    return () => window.clearInterval(t);
  }, [result, reduceMotion]);

  // Record an UN-mirrored centred square: the model centre-crops a square after
  // resizing, so a square, signer-centred clip survives its preprocessing intact.
  const record = (s: Sign) => {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return;
    const side = Math.min(video.videoWidth, video.videoHeight) || 480;
    canvas.width = side; canvas.height = side;
    const ctx = canvas.getContext('2d')!;
    const draw = () => {
      const vw = video.videoWidth, vh = video.videoHeight;
      ctx.drawImage(video, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, side, side);
      raf.current = requestAnimationFrame(draw);
    };
    draw();

    const mimeType = pickMime();
    const recorder = new MediaRecorder(canvas.captureStream(30), mimeType ? { mimeType } : undefined);
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = async () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      setPhase('analyzing');
      ANALYZE_STEPS.forEach((step, i) => later(() => setLabel(step), i * 900));
      const type = recorder.mimeType || 'video/webm';
      const file = new File([new Blob(chunks, { type })], `practice.${type.includes('mp4') ? 'mp4' : 'webm'}`, { type });
      try {
        const res = await practiceApi.evaluate(file, s.expectedId!);
        clearTimers();
        setResult(res);
        setPhase('result');
        setLabel('Mirror view · guide on');
        if (res.status === 'CORRECT') toast(`“${s.word}” signed correctly`, 'seal');
        L.reload();
      } catch (err) {
        clearTimers();
        setFailure(apiErrorMessage(err, 'The evaluation failed. Please try again.'));
        setPhase('failed');
        setLabel('Mirror view · guide on');
      }
    };
    recorder.start();
    setPhase('recording');
    setLabel('Recording — sign it now');
    later(() => recorder.state !== 'inactive' && recorder.stop(), RECORD_MS);
  };

  const attempt = () => {
    if (!sign || cam !== 'on' || phase === 'countdown' || phase === 'recording' || phase === 'analyzing') return;
    setResult(null); setFailure(''); setDrawn(false);
    setPhase('countdown');
    setLabel('Get ready…');
    setCount(COUNT_FROM);
    for (let c = COUNT_FROM - 1; c >= 1; c--) later(() => setCount(c), (COUNT_FROM - c) * 800);
    later(() => record(sign), COUNT_FROM * 800);
  };

  const choose = (i: number) => {
    if (phase === 'countdown' || phase === 'recording' || phase === 'analyzing') return;
    setIdx(i); setPhase('idle'); setResult(null); setFailure('');
    if (requested && set[i]?.id !== requested) setParams({}, { replace: true });
  };

  useEffect(() => { if (phase === 'result') { const r = requestAnimationFrame(() => setDrawn(true)); return () => cancelAnimationFrame(r); } }, [phase]);

  if (L.loading) return <section className="view"><Loading /></section>;
  if (!sign) {
    return (
      <section className="view">
        <EmptyState title="Nothing to practise yet"
          body="None of the signs are connected to the AI model yet. An administrator needs to set each sign’s model class (expectedId)."
          action={<Link className="btn btn-sm" to="/dictionary">Browse the dictionary</Link>} />
      </section>
    );
  }

  const busy = phase === 'countdown' || phase === 'recording' || phase === 'analyzing';
  const C = 2 * Math.PI * 50;
  const score = result ? Math.round(result.confidence) : 0;
  const ghostFrame = { ...sign.frames[0], arc: sign.frames.find(f => f.arc)?.arc };

  return (
    <section className="view">
      <div className="studio">
        <div className="studio-head">
          <div>
            <p className="kicker">AI practice studio</p>
            <h1 className="display sm" style={{ color: 'var(--paper)' }}>Rehearse in the <em style={{ color: 'var(--lacquer)' }}>dark room</em>.</h1>
          </div>
          <p style={{ color: 'rgba(246,240,228,.55)', fontSize: 13.5, maxWidth: '36ch' }}>
            Sign for five seconds after the countdown. Only the clip you record is sent for scoring — the live preview never leaves your device.
          </p>
        </div>

        <div className="studio-grid">
          <div>
            <div className="cam-frame">
              <video ref={videoRef} autoPlay playsInline muted />
              <canvas ref={canvasRef} className="hidden-capture" aria-hidden="true" />
              {cam === 'on' && phase !== 'analyzing' && (
                <div className="cam-ghost" style={{ color: 'var(--paper)' }}><Hand frame={ghostFrame} size={170} ghost /></div>
              )}
              {cam === 'on' && sign.videoUrl && !busy && (
                <video className="ref-video" src={sign.videoUrl} autoPlay muted loop playsInline aria-label={`Reference video for ${sign.word}`} />
              )}
              {cam !== 'on' && (
                <div className="cam-off">
                  <Hand frame={{ shape: 'flat' }} size={110} ghost />
                  {cam === 'starting' && <p>Starting the camera…</p>}
                  {cam === 'denied' && <>
                    <p><strong style={{ color: 'var(--paper)' }}>Camera blocked.</strong><br />Allow camera access in your browser to record a practice clip.</p>
                    <button className="btn cream btn-sm" onClick={startCam}><Icon name="camera" size={15} /> Try again</button>
                  </>}
                  {cam === 'unsupported' && <p><strong style={{ color: 'var(--paper)' }}>This browser cannot record video.</strong><br />Try a recent Chrome, Edge or Firefox.</p>}
                </div>
              )}
              {phase === 'countdown' && <div className="cam-count" key={count}>{count}</div>}
              {phase === 'analyzing' && [...Array(9)].map((_, i) => (
                <span key={i} className="kp" style={{
                  left: `${28 + ((i * 37) % 44)}%`, top: `${20 + ((i * 53) % 55)}%`, animationDelay: `${i * 0.09}s`,
                  '--kx': `${((i * 7) % 32) - 16}px`, '--ky': `${((i * 11) % 28) - 14}px`,
                } as CSSProperties} />
              ))}
              <div className="cam-status">
                {phase === 'recording' && <span className="rec-dot" />}
                {phase === 'analyzing' && <span className="spin" style={{ width: 12, height: 12 }} />}
                <span>{label}</span>
              </div>
            </div>
            <p className="stage-caption">Match the ghost: same shape, same path, same pace. Stand back so both arms fit.</p>
          </div>

          <div>
            <p className="kicker">Practising{set.length > 1 ? ` · ${set.findIndex(s => s.id === sign.id) + 1} of ${set.length}` : ''}</p>
            <h2 style={{ fontFamily: 'var(--fd)', fontSize: 30, fontWeight: 600 }}>{sign.word}</h2>
            <p className="notation" style={{ color: 'rgba(246,240,228,.6)' }}>{sign.categoryName}{sign.description ? ` · ${sign.description}` : ''}</p>
            <div className="set-row">
              {set.map((s, i) => (
                <button key={s.id} className={`set-chip ${s.id === sign.id ? 'on' : ''}`} disabled={busy} onClick={() => choose(i)}>{s.word}</button>
              ))}
            </div>

            <div className="scorebox">
              {(phase === 'idle' || busy) && (
                <>
                  <p className="studio-intro">
                    The model watches the whole clip and ranks every sign it knows. You see how <strong style={{ color: 'var(--paper)' }}>confident</strong> it
                    is that you signed “{sign.word}”, and where your sign <strong style={{ color: 'var(--paper)' }}>ranked</strong> among its guesses.
                  </p>
                  <button className="btn cream" onClick={attempt} disabled={busy || cam !== 'on'}>
                    {busy ? <><span className="spin" /> {phase === 'analyzing' ? 'Scoring…' : 'Recording…'}</> : <><Icon name="camera" size={17} /> Start attempt</>}
                  </button>
                  {phase === 'analyzing' && <p className="stage-caption" style={{ textAlign: 'left' }}>The first score after the AI service starts can take up to a minute.</p>}
                </>
              )}

              {phase === 'failed' && (
                <>
                  <div className="coachnote" style={{ borderColor: 'var(--lacquer)', marginTop: 0 }}>
                    <span className="kicker" style={{ color: 'var(--lacquer)' }}>Could not score that one</span>{failure}
                  </div>
                  <div className="studio-actions"><button className="btn cream" onClick={attempt}><Icon name="refresh" size={16} /> Try again</button></div>
                </>
              )}

              {phase === 'result' && result && (
                <>
                  <div className="attempt-row">
                    <div className="dial" role="img" aria-label={`Confidence ${score} of 100, ${VERDICT[result.status]}`}>
                      <svg width="120" height="120" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="50" fill="none" stroke="var(--studio-line)" strokeWidth="7" />
                        <circle className="dial-arc" cx="60" cy="60" r="50" fill="none" strokeWidth="7" strokeDasharray={C}
                          strokeDashoffset={drawn ? C * (1 - score / 100) : C} />
                      </svg>
                      <span className="dial-num">{score}</span>
                    </div>
                    <div className="facts">
                      <div className="fact"><span>Result</span><b>{VERDICT[result.status]}</b></div>
                      <div className="fact"><span>Confidence</span><b>{result.confidence.toFixed(1)}%</b></div>
                      <div className="fact"><span>Rank among guesses</span><b>#{result.rank}</b></div>
                    </div>
                  </div>
                  <p style={{ fontFamily: 'var(--fd)', fontStyle: 'italic', fontSize: 19, marginTop: 16 }}>
                    {VERDICT[result.status]} — <span style={{ color: 'rgba(246,240,228,.65)' }}>{sign.word}</span>
                  </p>
                  <div className="coachnote"><span className="kicker">Mentor notes</span><span>{typed}</span></div>
                  <div className="studio-actions">
                    <button className="btn cream" onClick={attempt}><Icon name="refresh" size={16} /> Try again</button>
                    {set.length > 1 && (
                      <button className="btn cream-ghost" onClick={() => choose((idx + 1) % set.length)}>
                        Next sign <Icon name="arrowr" size={16} />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="session-strip">
              <span className="kicker">Recent</span>
              {L.attempts.length ? L.attempts.slice(0, 6).map(a => (
                <span key={a.attemptId} className={`try-stamp ${a.isCorrect ? 'ok' : ''}`} title={`${a.word} · ${a.isCorrect ? 'correct' : 'not yet'}`}>
                  {a.confidence != null ? Math.round(a.confidence) : a.isCorrect ? '✓' : '·'}
                  <span>{a.word.split(' ')[0].slice(0, 6)}</span>
                </span>
              )) : <span style={{ fontSize: 13, color: 'rgba(246,240,228,.5)' }}>No attempts yet — the first one is free.</span>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
