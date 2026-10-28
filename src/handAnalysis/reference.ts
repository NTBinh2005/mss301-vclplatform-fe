// Dung & tai mau tham chieu (SignReference) cho tung tu vung.
//
// Chien luoc tai (uu tien tu cao xuong thap):
//   1. localStorage cache
//   2. file precompute /references/{classId}.json
//   3. dung tu VIDEO MAU cua tu vung (videoUrl) ngay trong browser
//
// Mau va clip user deu qua CUNG code trich landmark + rut dac trung + cat doan
// nghi -> toan hoc khop tuyet doi, so bang DTW.
import { SignReference, FrameObservation, HandObservation, HandFeatures } from './types';
import { extractFromSource } from './landmarks';
import { computeFeatures } from './features';

// v4: dac trung them do xoe ngon + ngon cai (Phase 3) -> doi format, doi prefix.
const CACHE_PREFIX = 'handref:v4:';

// Dich chuyen tong the giua 2 frame (toa do ANH) - do "hoat dong" cua ban tay.
function landmarkMotion(a: HandObservation, b: HandObservation): number {
  const n = Math.min(a.landmarks.length, b.landmarks.length);
  let s = 0;
  for (let i = 0; i < n; i++) {
    const dx = a.landmarks[i].x - b.landmarks[i].x;
    const dy = a.landmarks[i].y - b.landmarks[i].y;
    s += Math.hypot(dx, dy);
  }
  return n ? s / n : 0;
}

// Phase 2: cat doan "nghi" dau/cuoi - giu cua so bao phu 10..90% dong luong
// chuyen dong. Ky hieu gan nhu tinh (it chuyen dong) thi giu nguyen.
function trimActive(obs: HandObservation[]): HandObservation[] {
  if (obs.length <= 6) return obs;
  const act = [0];
  for (let i = 1; i < obs.length; i++) act.push(landmarkMotion(obs[i - 1], obs[i]));
  const total = act.reduce((a, b) => a + b, 0);
  if (total < 1e-4) return obs; // gan nhu tinh -> khong cat

  const cum: number[] = [];
  let s = 0;
  for (const a of act) { s += a; cum.push(s); }
  const lo = total * 0.1, hi = total * 0.9;
  let a = 0, b = obs.length - 1;
  for (let i = 0; i < cum.length; i++) if (cum[i] >= lo) { a = i; break; }
  for (let i = cum.length - 1; i >= 0; i--) if (cum[i] <= hi) { b = i; break; }
  if (b - a < Math.floor(obs.length * 0.4)) return obs; // cat qua nhieu -> giu nguyen
  return obs.slice(a, b + 1);
}

function featureSeq(obs: HandObservation[]): HandFeatures[] {
  return trimActive(obs).map(computeFeatures);
}

// Xay chuoi dac trung theo tung ban tay tu cac frame (dung cho ca mau va user).
export function buildSequences(
  frames: FrameObservation[],
): { handCount: 1 | 2; right?: HandFeatures[]; left?: HandFeatures[] } {
  const rightObs: HandObservation[] = [];
  const leftObs: HandObservation[] = [];
  const anyObs: HandObservation[] = [];
  let nonEmpty = 0;

  for (const hands of frames) {
    if (!hands.length) continue;
    nonEmpty++;
    const r = hands.find((h) => h.handedness === 'Right');
    const l = hands.find((h) => h.handedness === 'Left');
    if (r) rightObs.push(r);
    if (l) leftObs.push(l);
    anyObs.push(hands.reduce((a, b) => (b.score > a.score ? b : a)));
  }
  if (nonEmpty === 0) return { handCount: 1 };

  const twoHands = rightObs.length >= nonEmpty * 0.4 && leftObs.length >= nonEmpty * 0.4;
  if (twoHands) {
    return { handCount: 2, right: featureSeq(rightObs), left: featureSeq(leftObs) };
  }
  // Ky hieu 1 tay: gop tat ca (bo qua nhan trai/phai) thanh 1 chuoi.
  return { handCount: 1, right: featureSeq(anyObs) };
}

export async function buildReferenceFromSampleVideo(
  classId: number,
  videoUrl: string,
): Promise<SignReference | null> {
  const frames = await extractFromSource(videoUrl);
  const { handCount, right, left } = buildSequences(frames);
  if (!right?.length && !left?.length) return null;
  return { classId, handCount, right, left, source: 'sample-video' };
}

export async function loadReference(classId: number, videoUrl?: string): Promise<SignReference | null> {
  const cached = readCache(classId);
  if (cached) return cached;

  try {
    const res = await fetch(`/references/${classId}.json`, { cache: 'force-cache' });
    if (res.ok) {
      const ref = (await res.json()) as SignReference;
      writeCache(classId, ref);
      return ref;
    }
  } catch {
    /* khong co file precompute - bo qua */
  }

  if (videoUrl) {
    try {
      const ref = await buildReferenceFromSampleVideo(classId, videoUrl);
      if (ref) writeCache(classId, ref);
      return ref;
    } catch {
      /* loi tai/giai ma video mau */
    }
  }
  return null;
}

function readCache(classId: number): SignReference | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + classId);
    return raw ? (JSON.parse(raw) as SignReference) : null;
  } catch {
    return null;
  }
}

function writeCache(classId: number, ref: SignReference) {
  try {
    localStorage.setItem(CACHE_PREFIX + classId, JSON.stringify(ref));
  } catch {
    /* het quota - bo qua */
  }
}
