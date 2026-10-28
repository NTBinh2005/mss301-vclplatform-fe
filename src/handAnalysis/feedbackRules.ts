// Turns the learner's hand-feature sequence + the reference into short coaching notes.
import { HandFeedback, HandComment, SignReference, HandFeatures } from './types';
import { compareHand } from './compare';
import {
  FINGER_ORDER,
  FINGER_LABELS,
  FINGER_FLAG_DIFF,
  SPREAD_FLAG,
  THUMB_FLAG,
  PALM_FLAG_DEG,
  PALM_FACING,
} from './constants';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const avg = (a: number[]) => (a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : 0);

export function buildFeedback(
  userRight: HandFeatures[] | undefined,
  userLeft: HandFeatures[] | undefined,
  ref: SignReference,
): HandFeedback {
  const comments: HandComment[] = [];
  const userHands = [userRight, userLeft].filter((s) => s && s.length) as HandFeatures[][];
  const handCountOk = userHands.length === ref.handCount;

  if (!handCountOk) {
    comments.push({
      type: 'HAND_COUNT',
      severity: 'warn',
      text:
        ref.handCount === 2
          ? 'This sign uses both hands — only one was in the clip.'
          : 'This sign uses one hand — both of yours were in the frame.',
    });
  }

  const curlScores: number[] = [];
  const palmScores: number[] = [];

  const evalPair = (u: HandFeatures[], r: HandFeatures[], label: string) => {
    if (!u.length || !r.length) return;
    const diff = compareHand(u, r);
    curlScores.push(diff.shapeScore);
    palmScores.push(diff.palmScore);

    // Chi nhac ngon khi sai lech RO RANG; uu tien 2 ngon sai nhieu nhat.
    const problems = FINGER_ORDER.map((f, i) => ({
      f,
      d: diff.curlDiffs[i],
      uc: diff.userCurls[i],
      rc: diff.refCurls[i],
    }))
      .filter((p) => p.d > FINGER_FLAG_DIFF)
      .sort((a, b) => b.d - a.d)
      .slice(0, 2);

    for (const p of problems) {
      const shouldStraighten = p.rc < p.uc; // mau duoi hon => user dang co
      comments.push({
        type: 'FINGER',
        severity: 'warn',
        text: `${cap(label)}: ${shouldStraighten ? 'straighten' : 'bend'} your ${FINGER_LABELS[p.f]} more.`,
      });
    }

    // Do xoe ngon (Phase 3): nhac khep/xoe khi lech ro.
    if (diff.spreadDiff > SPREAD_FLAG) {
      const wider = diff.userSpreadAvg < diff.refSpreadAvg; // user khep hon mau => can xoe rong hon
      comments.push({
        type: 'FINGER',
        severity: 'warn',
        text: `${cap(label)}: ${wider ? 'spread your fingers wider' : 'keep your fingers closer together'}, like the tutorial video.`,
      });
    }

    // Ngon cai (Phase 3): nhac dua gan/xa ngon tro.
    if (diff.thumbDiff > THUMB_FLAG) {
      const closer = diff.userThumb > diff.refThumb; // user xa hon mau => can dua gan hon
      comments.push({
        type: 'FINGER',
        severity: 'warn',
        text: `${cap(label)}: move your thumb ${closer ? 'closer to' : 'further from'} your index finger.`,
      });
    }

    // Long ban tay: mo ta bang HUONG truc quan, chi nhac khi khac han mau.
    if (diff.userFacing !== diff.refFacing && diff.palmAngleDeg > PALM_FLAG_DEG) {
      comments.push({
        type: 'PALM',
        severity: 'warn',
        text: `${cap(label)}: your palm should ${PALM_FACING[diff.refFacing]}, like the tutorial video.`,
      });
    }
  };

  if (ref.handCount === 1) {
    const r = ref.right ?? ref.left;
    const u = userRight ?? userLeft;
    if (u && r) evalPair(u, r, 'hand');
  } else {
    if (userRight && ref.right) evalPair(userRight, ref.right, 'right hand');
    if (userLeft && ref.left) evalPair(userLeft, ref.left, 'left hand');
  }

  if (comments.length === 0) {
    comments.push({ type: 'FINGER', severity: 'good', text: 'Your handshape matches the tutorial well. Nice work!' });
  }

  return {
    available: true,
    handCountOk,
    handShapeScore: avg(curlScores),
    palmScore: avg(palmScores),
    comments: comments.slice(0, 4), // gioi han cho gon, tranh roi mat
  };
}
