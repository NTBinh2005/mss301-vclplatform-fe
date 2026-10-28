import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { usePrefs } from '../lib/prefs';

/* The generative ink hand — the product's visual voice (ported from design.html). */

export type Shape = 'open' | 'flat' | 'cup' | 'fist' | 'point' | 'v' | 'three';
export type Arc = 'wave' | 'up' | 'circle' | 'out' | 'down' | 'side';
export interface Frame { shape: Shape; rot?: number; dx?: number; dy?: number; arc?: Arc | null }

const SHAPES: Record<Shape, { f: [number, number, number][]; t: [number, number] }> = {
  open: { f: [[76, -14, 58], [92, -5, 72], [108, 6, 66], [124, 15, 48]], t: [34, 124] },
  flat: { f: [[76, -6, 62], [92, -2, 68], [108, 3, 64], [124, 8, 54]], t: [34, 124] },
  cup: { f: [[76, -16, 44], [92, -5, 52], [108, 6, 52], [124, 18, 44]], t: [38, 132] },
  fist: { f: [[76, -4, 16], [92, 0, 16], [108, 4, 16], [124, 8, 14]], t: [100, 142] },
  point: { f: [[80, -6, 60], [92, 0, 16], [108, 4, 16], [124, 8, 14]], t: [76, 158] },
  v: { f: [[80, -10, 60], [104, 10, 64], [104, 4, 16], [124, 10, 14]], t: [34, 124] },
  three: { f: [[76, -12, 58], [92, 0, 68], [108, 10, 62], [124, 8, 14]], t: [34, 124] },
};

const ARCS: Record<Arc, { d: string; a: string }> = {
  wave: { d: 'M28 58C55 20 145 20 172 58', a: 'M160 44 172 58 154 62' },
  up: { d: 'M100 96C100 70 100 50 100 22', a: 'M90 34 100 22 110 34' },
  circle: { d: 'M148 64A52 52 0 1 1 100 26', a: 'M112 18 100 26 112 36' },
  out: { d: 'M120 140C160 120 172 84 168 44', a: 'M157 56 168 44 176 58' },
  down: { d: 'M70 50C60 90 60 120 70 150', a: 'M60 138 70 150 80 138' },
  side: { d: 'M50 120C80 96 130 96 164 116', a: 'M150 104 164 116 148 122' },
};

export const SHAPE_NAMES = Object.keys(SHAPES) as Shape[];
export const ARC_NAMES = Object.keys(ARCS) as Arc[];

export function Hand({ frame, size = 200, ghost = false }: { frame?: Frame; size?: number; ghost?: boolean }) {
  const f = frame || { shape: 'open' };
  const shape = SHAPES[f.shape] || SHAPES.open;
  const rot = f.rot || 0, dx = f.dx || 0, dy = f.dy || 0;
  const col = ghost ? 'currentColor' : 'var(--ink)';
  const arcCol = ghost ? 'currentColor' : 'var(--lacquer)';
  const arc = f.arc ? ARCS[f.arc] : null;
  return (
    <svg viewBox="0 0 200 220" width={size} height={Math.round(size * 1.1)} aria-hidden="true">
      <g transform={`rotate(${rot} 100 150) translate(${dx} ${dy})`}>
        <line x1="66" y1="146" x2={shape.t[0]} y2={shape.t[1]} stroke={col} strokeWidth="16" strokeLinecap="round" />
        {shape.f.map(([x, a, l], i) => {
          const r = (a * Math.PI) / 180;
          return (
            <line key={i} x1={x} y1="124" x2={(x + Math.sin(r) * l).toFixed(1)} y2={(124 - Math.cos(r) * l).toFixed(1)}
              stroke={col} strokeWidth="15" strokeLinecap="round" />
          );
        })}
        <rect x="58" y="112" width="84" height="76" rx="26" fill={col} />
        <rect x="84" y="178" width="34" height="28" rx="10" fill={col} />
      </g>
      {arc && (
        <g transform={`rotate(${rot} 100 150)`}>
          <path className={ghost ? 'arc-dash' : undefined} d={arc.d} fill="none" stroke={arcCol} strokeWidth="3.5"
            strokeLinecap="round" strokeDasharray={ghost ? undefined : '.5 8'} />
          <path d={arc.a} fill="none" stroke={arcCol} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
    </svg>
  );
}

/* SignPlayer: the flipbook of a sign. */
interface PlayerProps {
  frames: Frame[];
  size?: number;
  autoplay?: boolean;
  chrome?: boolean;
  hover?: boolean;
  ghost?: boolean;
}

export function SignPlayer({ frames, size = 200, autoplay = false, chrome = true, hover = false, ghost = false }: PlayerProps) {
  const { reduceMotion } = usePrefs();
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    timer.current = window.setInterval(() => setI(n => (n + 1) % frames.length), 430);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [playing, frames.length]);

  useEffect(() => { if (autoplay && !reduceMotion) setPlaying(true); }, [autoplay, reduceMotion]);

  const hoverProps = hover ? {
    onMouseEnter: () => setPlaying(true),
    onMouseLeave: () => setPlaying(false),
    onFocus: () => setPlaying(true),
    onBlur: () => setPlaying(false),
  } : {};

  return (
    <div className={`sp ${hover ? 'sp--hover' : ''}`} {...hoverProps}>
      <div className="sp-stage" style={{ color: ghost ? 'var(--paper)' : 'var(--ink)' }}>
        <Hand frame={frames[i]} size={size} ghost={ghost} />
      </div>
      {chrome && (
        <div className="sp-bar">
          <button type="button" className="sp-toggle" aria-label="Phát hoặc dừng hoạt ảnh ký hiệu" onClick={() => setPlaying(p => !p)}>
            <Icon name={playing ? 'pause' : 'play'} />
          </button>
          <div className="sp-dots">
            {frames.map((_, k) => (
              <button type="button" key={k} className={`sp-dot ${k === i ? 'on' : ''}`} aria-label={`Frame ${k + 1}`}
                onClick={() => { setPlaying(false); setI(k); }} />
            ))}
          </div>
          <span className="sp-count">{i + 1}/{frames.length}</span>
        </div>
      )}
    </div>
  );
}
