import type { PoseLandmarker } from '@mediapipe/tasks-vision';

/* Signer framing for the Studio (ported from the SBA practice page).
   MediaPipe PoseLandmarker finds head, shoulders, arms and hands; the recorder
   copies a square around them, so the clip the AI model receives is a square,
   signer-centred crop — what its "resize short side + centre crop" preprocessing
   expects. While recording, the crop's centre and size are sampled so the
   active part of the movement can be cut out afterwards (startFrac/endFrac).
   Runs on the CPU (WASM): weak integrated GPUs were the problem with WebGL. */

const ASSETS = '/models/mediapipe_hands';
const LOAD_TIMEOUT_MS = 20000;

let posePromise: Promise<PoseLandmarker> | null = null;

export function loadPoseDetector(): Promise<PoseLandmarker> {
  if (!posePromise) {
    const load = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(`${ASSETS}/wasm`);
      return PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: `${ASSETS}/pose_landmarker_lite.task`, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
      });
    })();
    const timeout = new Promise<never>((_, reject) =>
      window.setTimeout(() => reject(new Error('The pose model took too long to load')), LOAD_TIMEOUT_MS));
    posePromise = Promise.race([load, timeout]);
    posePromise.catch(() => { posePromise = null; });
  }
  return posePromise;
}

// Nose, shoulders, elbows, wrists and hand tips bound the signing region.
const SIGNING_LANDMARKS = [0, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
const MIN_VISIBILITY = 0.3;
const CROP_PADDING = 0.25; // around the landmark box, as a share of its larger side
const CROP_SMOOTHING = 0.2; // lower = steadier, higher = snappier
const FRAMES_TO_LOSE_LOCK = 12;
export const DETECT_INTERVAL_MS = 66; // ~15 detections per second caps the CPU load

export interface Crop { cx: number; cy: number; side: number }
export interface MotionSample { t: number; x: number; y: number; s: number }

/* Keeps the smoothed crop between frames. `detect` returns the raw target
   (for motion sampling) or null when no confident pose was seen. */
export class SignerTracker {
  private crop: Crop | null = null;
  private missed = 0;
  private lastTs = 0;

  constructor(private detector: PoseLandmarker) {}

  detect(video: HTMLVideoElement, now: number): Crop | null {
    const vw = video.videoWidth, vh = video.videoHeight;
    // detectForVideo needs strictly increasing timestamps.
    let ts = Math.round(now);
    if (ts <= this.lastTs) ts = this.lastTs + 1;
    this.lastTs = ts;
    const pose = this.detector.detectForVideo(video, ts).landmarks?.[0];
    const pts = pose
      ? SIGNING_LANDMARKS.map(i => pose[i]).filter(p => p && (p.visibility === undefined || p.visibility >= MIN_VISIBILITY))
      : [];
    if (pts.length < 3) {
      if (++this.missed > FRAMES_TO_LOSE_LOCK) this.crop = null;
      return null;
    }
    this.missed = 0;
    const xs = pts.map(p => p.x * vw), ys = pts.map(p => p.y * vh);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const boxW = maxX - minX, boxH = maxY - minY;
    const target = {
      cx: minX + boxW / 2,
      cy: minY + boxH / 2,
      side: Math.min(Math.max(boxW, boxH) * (1 + 2 * CROP_PADDING), Math.min(vw, vh)),
    };
    const prev = this.crop;
    this.crop = prev ? {
      cx: prev.cx + (target.cx - prev.cx) * CROP_SMOOTHING,
      cy: prev.cy + (target.cy - prev.cy) * CROP_SMOOTHING,
      side: prev.side + (target.side - prev.side) * CROP_SMOOTHING,
    } : target;
    return target;
  }

  /** The square to copy from the video, clamped inside the frame; centred when no signer is locked. */
  source(vw: number, vh: number): { sx: number; sy: number; side: number } {
    const full = Math.min(vw, vh);
    if (!this.crop) return { sx: (vw - full) / 2, sy: (vh - full) / 2, side: full };
    const side = Math.min(this.crop.side, full);
    return {
      sx: Math.max(0, Math.min(vw - side, this.crop.cx - side / 2)),
      sy: Math.max(0, Math.min(vh - side, this.crop.cy - side / 2)),
      side,
    };
  }

  get locked() { return this.crop !== null; }
}

/* From the samples taken while recording, find [startFrac, endFrac] covering the
   main movement (10%–90% of the accumulated motion, padded 8% each side), so the
   backend samples its 16 frames from the sign itself, not the still hands around it. */
export function activeWindow(samples: MotionSample[], start: number, end: number): { startFrac: number; endFrac: number } {
  const FULL = { startFrac: 0, endFrac: 1 };
  const dur = end - start;
  if (samples.length < 5 || dur <= 0) return FULL;
  const motion = [0];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    motion.push(Math.hypot(b.x - a.x, b.y - a.y) + Math.abs(b.s - a.s));
  }
  const total = motion.reduce((x, y) => x + y, 0);
  if (total < 1e-3) return FULL;
  const cum: number[] = [];
  let acc = 0;
  for (const m of motion) { acc += m; cum.push(acc); }
  const lo = total * 0.1, hi = total * 0.9;
  let a = 0, b = samples.length - 1;
  for (let i = 0; i < cum.length; i++) if (cum[i] >= lo) { a = i; break; }
  for (let i = cum.length - 1; i >= 0; i--) if (cum[i] <= hi) { b = i; break; }
  const startFrac = Math.max(0, (samples[a].t - start) / dur - 0.08);
  const endFrac = Math.min(1, (samples[b].t - start) / dur + 0.08);
  return endFrac - startFrac < 0.2 ? FULL : { startFrac, endFrac };
}
