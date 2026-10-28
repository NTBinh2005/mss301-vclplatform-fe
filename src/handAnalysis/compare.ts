// So sanh CHUOI dac trung tay cua user voi mau tham chieu bang DTW.
// Diem "Hinh dang ngon" gom: do co + do xoe + ngon cai (Phase 3).
import { HandFeatures, Vec3 } from './types';
import {
  FINGER_DEADZONE,
  FINGER_MAXDIFF,
  SPREAD_DEADZONE,
  SPREAD_MAXDIFF,
  THUMB_DEADZONE,
  THUMB_MAXDIFF,
  W_SHAPE_CURL,
  W_SHAPE_SPREAD,
  W_SHAPE_THUMB,
  PALM_DEADZONE_DEG,
  PALM_MAXDIFF_DEG,
  PalmFacing,
} from './constants';
import { normalize } from './vec';
import { classifyPalmFacing } from './features';
import { dtwAlign } from './dtw';

export interface HandDiff {
  curlDiffs: number[];
  userCurls: number[];
  refCurls: number[];
  spreadDiff: number;      // sai lech xoe trung binh (0..1)
  userSpreadAvg: number;
  refSpreadAvg: number;
  thumbDiff: number;
  userThumb: number;
  refThumb: number;
  palmAngleDeg: number;
  shapeScore: number;      // 0..100 (co + xoe + ngon cai)
  palmScore: number;       // 0..100
  userFacing: PalmFacing;
  refFacing: PalmFacing;
}

const scoreWithDeadzone = (x: number, dead: number, max: number) =>
  Math.max(0, Math.min(1, (max - x) / (max - dead)));
const meanArr = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

function avgCurls(seq: HandFeatures[]): number[] {
  const s = [0, 0, 0, 0, 0];
  for (const f of seq) for (let i = 0; i < 5; i++) s[i] += f.curls[i];
  const n = seq.length || 1;
  return s.map((x) => x / n);
}
function avgSpread(seq: HandFeatures[]): number {
  let s = 0;
  for (const f of seq) s += meanArr(f.spreads);
  return seq.length ? s / seq.length : 0;
}
function avgThumb(seq: HandFeatures[]): number {
  let s = 0;
  for (const f of seq) s += f.thumbGap;
  return seq.length ? s / seq.length : 0;
}
function avgNormal(seq: HandFeatures[]): Vec3 {
  let x = 0, y = 0, z = 0;
  for (const f of seq) { x += f.palmNormal.x; y += f.palmNormal.y; z += f.palmNormal.z; }
  const n = seq.length || 1;
  return normalize({ x: x / n, y: y / n, z: z / n });
}

export function compareHand(userSeq: HandFeatures[], refSeq: HandFeatures[]): HandDiff {
  const { meanCurlDiff, meanSpreadDiff, meanThumbDiff, meanPalmAngle } = dtwAlign(userSeq, refSeq);

  const curlMatch = meanArr(meanCurlDiff.map((d) => scoreWithDeadzone(d, FINGER_DEADZONE, FINGER_MAXDIFF)));
  const spreadMatch = meanArr(meanSpreadDiff.map((d) => scoreWithDeadzone(d, SPREAD_DEADZONE, SPREAD_MAXDIFF)));
  const thumbMatch = scoreWithDeadzone(meanThumbDiff, THUMB_DEADZONE, THUMB_MAXDIFF);

  const shapeScore = Math.round(
    100 * (W_SHAPE_CURL * curlMatch + W_SHAPE_SPREAD * spreadMatch + W_SHAPE_THUMB * thumbMatch),
  );
  const palmScore = Math.round(100 * scoreWithDeadzone(meanPalmAngle, PALM_DEADZONE_DEG, PALM_MAXDIFF_DEG));

  return {
    curlDiffs: meanCurlDiff,
    userCurls: avgCurls(userSeq),
    refCurls: avgCurls(refSeq),
    spreadDiff: meanArr(meanSpreadDiff),
    userSpreadAvg: avgSpread(userSeq),
    refSpreadAvg: avgSpread(refSeq),
    thumbDiff: meanThumbDiff,
    userThumb: avgThumb(userSeq),
    refThumb: avgThumb(refSeq),
    palmAngleDeg: meanPalmAngle,
    shapeScore,
    palmScore,
    userFacing: classifyPalmFacing(avgNormal(userSeq)),
    refFacing: classifyPalmFacing(avgNormal(refSeq)),
  };
}
