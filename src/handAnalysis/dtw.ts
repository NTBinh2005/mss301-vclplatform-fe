// DTW (Dynamic Time Warping) can chinh 2 chuoi dac trung tay theo thoi gian
// roi gop sai lech doc theo duong can. Xu ly duoc ky nhanh/cham + dong tac
// bien doi trong luc ky - chinh xac hon nhieu so voi gop median toan clip.
import { HandFeatures } from './types';
import { angleDeg } from './vec';

// Trong so ket hop cac thanh phan khi tinh khoang cach 2 frame.
const W_CURL = 1.0;
const W_SPREAD = 0.6;
const W_THUMB = 0.5;
const W_PALM = 0.5;

const meanAbs = (a: number[], b: number[]) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return a.length ? s / a.length : 0;
};

// Khoang cach giua 2 frame: co ngon + xoe ngon + ngon cai + huong long ban tay.
function frameDist(u: HandFeatures, r: HandFeatures): number {
  const cd = meanAbs(u.curls, r.curls);
  const sd = meanAbs(u.spreads, r.spreads);
  const td = Math.abs(u.thumbGap - r.thumbGap);
  const pd = angleDeg(u.palmNormal, r.palmNormal) / 180;
  return W_CURL * cd + W_SPREAD * sd + W_THUMB * td + W_PALM * pd;
}

export interface DtwResult {
  meanCurlDiff: number[];   // sai lech tung ngon [5]
  meanSpreadDiff: number[]; // sai lech tung cap xoe [4]
  meanThumbDiff: number;    // sai lech khoang cach ngon cai
  meanPalmAngle: number;    // goc long ban tay (do)
  pathLen: number;
}

export function dtwAlign(U: HandFeatures[], R: HandFeatures[]): DtwResult {
  const m = U.length, n = R.length;
  if (m === 0 || n === 0) {
    return {
      meanCurlDiff: [1, 1, 1, 1, 1],
      meanSpreadDiff: [1, 1, 1, 1],
      meanThumbDiff: 1,
      meanPalmAngle: 180,
      pathLen: 0,
    };
  }

  const D: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(Infinity));
  D[0][0] = 0;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const c = frameDist(U[i - 1], R[j - 1]);
      D[i][j] = c + Math.min(D[i - 1][j], D[i][j - 1], D[i - 1][j - 1]);
    }
  }

  // Truy vet nguoc, gop sai lech tung thanh phan doc duong can.
  let i = m, j = n;
  const curlSum = [0, 0, 0, 0, 0];
  const spreadSum = [0, 0, 0, 0];
  let thumbSum = 0, palmSum = 0, cnt = 0;
  while (i > 0 && j > 0) {
    const u = U[i - 1], r = R[j - 1];
    for (let k = 0; k < 5; k++) curlSum[k] += Math.abs(u.curls[k] - r.curls[k]);
    for (let k = 0; k < 4; k++) spreadSum[k] += Math.abs(u.spreads[k] - r.spreads[k]);
    thumbSum += Math.abs(u.thumbGap - r.thumbGap);
    palmSum += angleDeg(u.palmNormal, r.palmNormal);
    cnt++;
    const diag = D[i - 1][j - 1], up = D[i - 1][j], left = D[i][j - 1];
    if (diag <= up && diag <= left) { i--; j--; }
    else if (up <= left) { i--; }
    else { j--; }
  }
  const c = cnt || 1;
  return {
    meanCurlDiff: curlSum.map((s) => s / c),
    meanSpreadDiff: spreadSum.map((s) => s / c),
    meanThumbDiff: thumbSum / c,
    meanPalmAngle: palmSum / c,
    pathLen: cnt,
  };
}
