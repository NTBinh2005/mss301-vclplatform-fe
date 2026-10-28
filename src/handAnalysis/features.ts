// Rut dac trung hinh hoc tu landmark tay. Day la buoc "toa do -> con so co
// nghia": bien 21 diem thanh do co ngon + huong long ban tay.
import { Vec3, HandObservation, HandFeatures } from './types';
import { FINGER_JOINTS, FINGER_ORDER, INDEX_MCP, PINKY_MCP, WRIST, PalmFacing } from './constants';
import { sub, cross, normalize, angleDeg, len } from './vec';

// Chi so tip/mcp tung ngon (chuan MediaPipe Hand).
const TIP: Record<string, number> = { thumb: 4, index: 8, middle: 12, ring: 16, pinky: 20 };
const MCP: Record<string, number> = { thumb: 2, index: 5, middle: 9, ring: 13, pinky: 17 };

// Huong 1 ngon = vector goc->dau ngon (da chuan hoa).
function fingerDir(lm: Vec3[], f: string): Vec3 {
  return normalize(sub(lm[TIP[f]], lm[MCP[f]]));
}

// Do xoe giua 2 ngon ke nhau: goc giua 2 huong ngon, chuan hoa /90 do (~0..1).
function spreadOf(lm: Vec3[], a: string, b: string): number {
  return Math.min(1, angleDeg(fingerDir(lm, a), fingerDir(lm, b)) / 90);
}

// Do co cua 1 ngon: goc tai khop giua. Duoi thang ~180 do => curl 0;
// co han <=90 do => curl 1. Tuyen tinh trong khoang 90..180.
function fingerCurl(lm: Vec3[], joints: [number, number, number]): number {
  const [a, b, c] = joints;
  const v1 = sub(lm[a], lm[b]);
  const v2 = sub(lm[c], lm[b]);
  const ang = angleDeg(v1, v2); // 180 = thang, nho = co
  return Math.max(0, Math.min(1, (180 - ang) / 90));
}

// Vector phap tuyen long ban tay (tich co huong 2 canh long ban tay).
function palmNormal(lm: Vec3[]): Vec3 {
  const a = sub(lm[INDEX_MCP], lm[WRIST]);
  const b = sub(lm[PINKY_MCP], lm[WRIST]);
  return normalize(cross(a, b));
}

export function computeFeatures(hand: HandObservation): HandFeatures {
  // Dung toa do THUC 3D (worldLandmarks) - doc lap camera/khoang cach nen cung
  // dong tac se ra cung dac trung du webcam khac video mau.
  const lm = hand.world;
  const curls = FINGER_ORDER.map((f) => fingerCurl(lm, FINGER_JOINTS[f]));
  const spreads = [
    spreadOf(lm, 'thumb', 'index'),
    spreadOf(lm, 'index', 'middle'),
    spreadOf(lm, 'middle', 'ring'),
    spreadOf(lm, 'ring', 'pinky'),
  ];
  // Khoang cach ngon cai-ngon tro chuan hoa theo kich thuoc ban tay (wrist->middle_mcp).
  const palmSize = len(sub(lm[9], lm[WRIST])) || 1e-6;
  const thumbGap = Math.min(2, len(sub(lm[TIP.thumb], lm[TIP.index])) / palmSize);
  return { curls, spreads, thumbGap, palmNormal: palmNormal(lm) };
}

// Phan loai huong long ban tay thanh 1 trong 6 huong TRUC QUAN theo truc troi
// nhat cua phap tuyen. Toa do MediaPipe: x tang sang phai, y tang xuong duoi,
// z am la ve phia camera. Dung de mo ta cho nguoi dung thay vi bao "do".
export function classifyPalmFacing(n: Vec3): PalmFacing {
  const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
  if (az >= ax && az >= ay) return n.z < 0 ? 'out' : 'in';
  if (ay >= ax) return n.y < 0 ? 'up' : 'down';
  return n.x < 0 ? 'left' : 'right';
}
