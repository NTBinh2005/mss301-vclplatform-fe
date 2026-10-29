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
import { activeWindow, DETECT_INTERVAL_MS, loadPoseDetector, type MotionSample, SignerTracker } from '../lib/signerFraming';
import { analyzeHands, type HandFeedback } from '../handAnalysis';

// A detection slower than this, three times running, means the CPU cannot keep up: fall back to a centred crop.
const SLOW_DETECT_MS = 1200;

const RECORD_MS = 5000;
const COUNT_FROM = 3;
type Phase = 'idle' | 'countdown' | 'recording' | 'analyzing' | 'result' | 'failed';
type Cam = 'starting' | 'on' | 'denied' | 'unsupported';

const VERDICT: Record<EvaluationResponse['status'], string> = {
  CORRECT: 'Ký đúng',
  ALMOST_CORRECT: 'Gần đúng rồi',
  INCORRECT: 'Luyện thêm nhé',
};
const ANALYZE_STEPS = ['Đang tải clip lên…', 'Đang đọc hình dạng tay…', 'Đang dò quỹ đạo chuyển động…', 'Đang so với mẫu…'];

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
  const [label, setLabel] = useState('Chế độ gương · có khung hướng dẫn');
  const [result, setResult] = useState<EvaluationResponse | null>(null);
  const [failure, setFailure] = useState('');
  const [typed, setTyped] = useState('');
  const [drawn, setDrawn] = useState(false);
  const [pose, setPose] = useState<'loading' | 'ready' | 'off'>('loading');
  const [handFb, setHandFb] = useState<HandFeedback | null>(null);
  const [handBusy, setHandBusy] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const tracker = useRef<SignerTracker | null>(null);
  const recording = useRef(false);
  const samples = useRef<MotionSample[]>([]);
  const recordStart = useRef(0);

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

  // Load the pose model once the camera is on. Without it the Studio still works with a centred crop.
  useEffect(() => {
    if (cam !== 'on' || tracker.current) return;
    let cancelled = false;
    loadPoseDetector()
      .then(d => { if (!cancelled) { tracker.current = new SignerTracker(d); setPose('ready'); } })
      .catch(() => { if (!cancelled) setPose('off'); });
    return () => { cancelled = true; };
  }, [cam]);

  // Continuously draw an UN-mirrored square of the signer onto the capture canvas.
  // The model centre-crops a square after resizing, so a square, signer-centred
  // clip survives its preprocessing intact. The dashed guide over the (mirrored)
  // preview shows exactly what is being recorded.
  useEffect(() => {
    if (cam !== 'on') return;
    let active = true, lastDetect = 0, slow = 0;
    const loop = (now: number) => {
      if (!active) return;
      const video = videoRef.current, canvas = canvasRef.current;
      if (video && canvas && video.readyState >= 2 && video.videoWidth > 0) {
        const vw = video.videoWidth, vh = video.videoHeight;
        const t = tracker.current;
        if (t && now - lastDetect >= DETECT_INTERVAL_MS) {
          lastDetect = now;
          const started = performance.now();
          try {
            const target = t.detect(video, now);
            if (target && recording.current) samples.current.push({ t: now, x: target.cx, y: target.cy, s: target.side });
          } catch { /* a single failed frame is not worth stopping for */ }
          if (performance.now() - started > SLOW_DETECT_MS) {
            if (++slow >= 3) { tracker.current = null; setPose('off'); }
          } else slow = 0;
        }
        const src = t ? t.source(vw, vh) : { sx: (vw - Math.min(vw, vh)) / 2, sy: (vh - Math.min(vw, vh)) / 2, side: Math.min(vw, vh) };
        const out = Math.min(vw, vh);
        if (canvas.width !== out) { canvas.width = out; canvas.height = out; }
        canvas.getContext('2d')!.drawImage(video, src.sx, src.sy, src.side, src.side, 0, 0, out, out);

        const frame = frameRef.current, guide = guideRef.current;
        if (frame && guide) {
          // Map video pixels onto the object-fit:cover, mirrored preview.
          const w = frame.clientWidth, h = frame.clientHeight, scale = Math.max(w / vw, h / vh);
          const ox = (w - vw * scale) / 2, oy = (h - vh * scale) / 2;
          guide.style.left = `${ox + (vw - src.sx - src.side) * scale}px`;
          guide.style.top = `${oy + src.sy * scale}px`;
          guide.style.width = guide.style.height = `${src.side * scale}px`;
          guide.style.opacity = t?.locked ? '1' : '0';
        }
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => { active = false; if (raf.current) cancelAnimationFrame(raf.current); };
  }, [cam]);

  const record = (s: Sign) => {
    const canvas = canvasRef.current;
    if (!canvas || !streamRef.current) return;

    const mimeType = pickMime();
    const recorder = new MediaRecorder(canvas.captureStream(30), mimeType ? { mimeType } : undefined);
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = async () => {
      recording.current = false;
      const { startFrac, endFrac } = activeWindow(samples.current, recordStart.current, performance.now());
      setPhase('analyzing');
      ANALYZE_STEPS.forEach((step, i) => later(() => setLabel(step), i * 900));
      const type = recorder.mimeType || 'video/webm';
      const blob = new Blob(chunks, { type });
      const file = new File([blob], `practice.${type.includes('mp4') ? 'mp4' : 'webm'}`, { type });

      // Hand-shape notes run in the browser alongside the AI score and never block it.
      if (s.expectedId != null && pose !== 'off') {
        setHandBusy(true);
        analyzeHands({ clipBlob: blob, classId: s.expectedId, sampleVideoUrl: s.videoUrl || undefined })
          .then(setHandFb)
          .catch(() => setHandFb(null))
          .finally(() => setHandBusy(false));
      }

      try {
        const res = await practiceApi.evaluate(file, s.id, startFrac, endFrac);
        clearTimers();
        setResult(res);
        setPhase('result');
        setLabel('Chế độ gương · có khung hướng dẫn');
        if (res.status === 'CORRECT') toast(`Ký đúng “${s.word}”`, 'seal');
        L.reload();
      } catch (err) {
        clearTimers();
        setFailure(apiErrorMessage(err, 'Chấm điểm thất bại. Vui lòng thử lại.'));
        setPhase('failed');
        setLabel('Chế độ gương · có khung hướng dẫn');
      }
    };
    samples.current = [];
    recordStart.current = performance.now();
    recording.current = true;
    recorder.start();
    setPhase('recording');
    setLabel('Đang quay — ký ngay bây giờ');
    later(() => recorder.state !== 'inactive' && recorder.stop(), RECORD_MS);
  };

  const attempt = () => {
    if (!sign || cam !== 'on' || phase === 'countdown' || phase === 'recording' || phase === 'analyzing') return;
    setResult(null); setFailure(''); setDrawn(false); setHandFb(null);
    setPhase('countdown');
    setLabel('Chuẩn bị…');
    setCount(COUNT_FROM);
    for (let c = COUNT_FROM - 1; c >= 1; c--) later(() => setCount(c), (COUNT_FROM - c) * 800);
    later(() => record(sign), COUNT_FROM * 800);
  };

  const choose = (i: number) => {
    if (phase === 'countdown' || phase === 'recording' || phase === 'analyzing') return;
    setIdx(i); setPhase('idle'); setResult(null); setFailure(''); setHandFb(null);
    if (requested && set[i]?.id !== requested) setParams({}, { replace: true });
  };

  useEffect(() => { if (phase === 'result') { const r = requestAnimationFrame(() => setDrawn(true)); return () => cancelAnimationFrame(r); } }, [phase]);

  if (L.loading) return <section className="view"><Loading /></section>;
  if (!sign) {
    return (
      <section className="view">
        <EmptyState title="Chưa có gì để luyện"
          body="Chưa ký hiệu nào được nối với mô hình AI. Quản trị viên cần đặt lớp mô hình (expectedId) cho từng ký hiệu."
          action={<Link className="btn btn-sm" to="/dictionary">Xem từ điển</Link>} />
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
            <p className="kicker">Phòng tập AI</p>
            <h1 className="display sm" style={{ color: 'var(--paper)' }}>Tập dượt trong <em style={{ color: 'var(--lacquer)' }}>phòng tối</em>.</h1>
          </div>
          <p style={{ color: 'rgba(246,240,228,.65)', fontSize: 13.5, maxWidth: '38ch' }}>
            Ký trong năm giây sau khi đếm ngược. Chỉ đoạn clip bạn quay mới được gửi đi chấm — hình xem trực tiếp không rời khỏi máy bạn.
          </p>
        </div>

        <div className="studio-grid">
          <div>
            <div className="cam-frame" ref={frameRef}>
              <video ref={videoRef} autoPlay playsInline muted />
              <canvas ref={canvasRef} className="hidden-capture" aria-hidden="true" />
              <div ref={guideRef} className="cam-guide" aria-hidden="true" />
              {cam === 'on' && phase !== 'analyzing' && (
                <div className="cam-ghost" style={{ color: 'var(--paper)' }}><Hand frame={ghostFrame} size={170} ghost /></div>
              )}
              {cam === 'on' && sign.videoUrl && !busy && (
                <video className="ref-video" src={sign.videoUrl} autoPlay muted loop playsInline aria-label={`Video mẫu của ${sign.word}`} />
              )}
              {cam !== 'on' && (
                <div className="cam-off">
                  <Hand frame={{ shape: 'flat' }} size={110} ghost />
                  {cam === 'starting' && <p>Đang bật camera…</p>}
                  {cam === 'denied' && <>
                    <p><strong style={{ color: 'var(--paper)' }}>Camera bị chặn.</strong><br />Hãy cho phép trình duyệt dùng camera để quay clip luyện tập.</p>
                    <button className="btn cream btn-sm" onClick={startCam}><Icon name="camera" size={15} /> Thử lại</button>
                  </>}
                  {cam === 'unsupported' && <p><strong style={{ color: 'var(--paper)' }}>Trình duyệt này không quay được video.</strong><br />Hãy dùng Chrome, Edge hoặc Firefox bản mới.</p>}
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
            <p className="stage-caption">
              Làm theo bàn tay mờ: cùng hình dạng, cùng đường đi, cùng nhịp. Đứng lùi lại để thấy cả hai tay.
              {cam === 'on' && (pose === 'ready' ? ' Khung vuông nét đứt đi theo bạn — đó là phần được chấm.'
                : pose === 'loading' ? ' Đang tải bộ theo dõi người ký…' : ' Máy này không chạy được bộ theo dõi người ký; phần giữa khung hình sẽ được chấm.')}
            </p>
          </div>

          <div className="studio-panel">
            <p className="kicker">Đang luyện{set.length > 1 ? ` · ${set.findIndex(s => s.id === sign.id) + 1}/${set.length}` : ''}</p>
            <h2 style={{ fontFamily: 'var(--fd)', fontSize: 32, fontWeight: 600 }}>{sign.word}</h2>
            <p className="notation" style={{ color: 'rgba(246,240,228,.65)' }}>{sign.categoryName}{sign.description ? ` · ${sign.description}` : ''}</p>
            <div className="set-row">
              {set.map((s, i) => (
                <button key={s.id} className={`set-chip ${s.id === sign.id ? 'on' : ''}`} disabled={busy} onClick={() => choose(i)}>{s.word}</button>
              ))}
            </div>

            <div className="scorebox">
              {(phase === 'idle' || busy) && (
                <>
                  <p className="studio-intro">
                    Mô hình xem cả đoạn clip và xếp hạng mọi ký hiệu nó biết. Bạn sẽ thấy nó <strong style={{ color: 'var(--paper)' }}>tin chắc</strong> đến đâu
                    rằng bạn đã ký “{sign.word}”, và ký hiệu của bạn <strong style={{ color: 'var(--paper)' }}>xếp hạng</strong> thứ mấy trong các dự đoán.
                  </p>
                  <button className="btn cream" onClick={attempt} disabled={busy || cam !== 'on'}>
                    {busy ? <><span className="spin" /> {phase === 'analyzing' ? 'Đang chấm…' : 'Đang quay…'}</> : <><Icon name="camera" size={17} /> Bắt đầu lượt tập</>}
                  </button>
                  {phase === 'analyzing' && <p className="stage-caption" style={{ textAlign: 'left' }}>Lần chấm đầu tiên sau khi dịch vụ AI khởi động có thể mất tới một phút.</p>}
                </>
              )}

              {phase === 'failed' && (
                <>
                  <div className="coachnote" style={{ borderColor: 'var(--lacquer)', marginTop: 0 }}>
                    <span className="kicker" style={{ color: 'var(--lacquer)' }}>Không chấm được lượt này</span>{failure}
                  </div>
                  <div className="studio-actions"><button className="btn cream" onClick={attempt}><Icon name="refresh" size={16} /> Thử lại</button></div>
                </>
              )}

              {phase === 'result' && result && (
                <>
                  <div className={`attempt-row verdict-${result.status}`}>
                    <div className={`dial verdict-${result.status}`} role="img" aria-label={`Độ tin cậy ${score}/100, ${VERDICT[result.status]}`}>
                      <svg width="120" height="120" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="50" fill="none" stroke="var(--studio-line)" strokeWidth="8" />
                        <circle className="dial-arc" cx="60" cy="60" r="50" fill="none" strokeWidth="8" strokeDasharray={C}
                          strokeDashoffset={drawn ? C * (1 - score / 100) : C} />
                      </svg>
                      <span className="dial-num">{score}</span>
                    </div>
                    <div className="facts">
                      <div className="fact"><span>Kết quả</span><b className={`verdict-text verdict-${result.status}`}>{VERDICT[result.status]}</b></div>
                      <div className="fact"><span>Độ tin cậy</span><b>{result.confidence.toFixed(1)}%</b></div>
                      <div className="fact"><span>Hạng trong các dự đoán</span><b>#{result.rank}</b></div>
                    </div>
                  </div>
                  <p className="verdict-headline" style={{ fontFamily: 'var(--fd)', fontStyle: 'italic', fontSize: 19, marginTop: 16 }}>
                    {VERDICT[result.status]} — <span style={{ color: 'rgba(246,240,228,.65)' }}>{sign.word}</span>
                  </p>
                  <div className={`coachnote verdict-${result.status}`}><span className="kicker">Nhận xét từ AI</span><span>{typed}</span></div>
                  <HandNotes feedback={handFb} busy={handBusy} />
                  <div className="studio-actions">
                    <button className="btn cream" onClick={attempt}><Icon name="refresh" size={16} /> Thử lại</button>
                    {set.length > 1 && (
                      <button className="btn cream-ghost" onClick={() => choose((idx + 1) % set.length)}>
                        Ký hiệu tiếp <Icon name="arrowr" size={16} />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="session-strip">
              <span className="kicker">Gần đây</span>
              {L.attempts.length ? L.attempts.slice(0, 6).map(a => (
                <span key={a.attemptId} className={`try-stamp ${a.isCorrect ? 'ok' : ''}`} title={`${a.word} · ${a.isCorrect ? 'đúng' : 'chưa đúng'}`}>
                  {a.confidence != null ? Math.round(a.confidence) : a.isCorrect ? '✓' : '·'}
                  <span>{a.word.split(' ')[0].slice(0, 6)}</span>
                </span>
              )) : <span style={{ fontSize: 13, color: 'rgba(246,240,228,.55)' }}>Chưa có lượt tập nào — thử ngay lượt đầu tiên.</span>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* Hand-shape notes computed in the browser from MediaPipe hand landmarks
   (finger curl/spread, thumb, palm direction), compared with the tutorial video. */
function HandNotes({ feedback, busy }: { feedback: HandFeedback | null; busy: boolean }) {
  if (busy) return <div className="hand-fb"><span className="spin" style={{ width: 12, height: 12 }} /> Đang đọc hình dạng tay của bạn…</div>;
  if (!feedback) return null;
  if (!feedback.available) return <div className="hand-fb"><span className="kicker">Hình dạng tay</span><p style={{ marginTop: 6 }}>{feedback.note}</p></div>;
  return (
    <div className="hand-fb">
      <span className="kicker">Hình dạng tay · từ tọa độ bàn tay</span>
      <div className="scores">
        <span><b>{feedback.handShapeScore}%</b> hình dạng ngón</span>
        <span><b>{feedback.palmScore}%</b> hướng lòng bàn tay</span>
      </div>
      <ul>{feedback.comments.map((c, i) => <li key={i} className={c.severity}>{c.text}</li>)}</ul>
    </div>
  );
}
