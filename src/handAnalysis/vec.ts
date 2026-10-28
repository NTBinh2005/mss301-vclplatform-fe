// Toan vector 3D toi gian dung cho phan tich landmark.
import { Vec3 } from './types';

export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

export const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

export const len = (a: Vec3): number => Math.sqrt(dot(a, a));

export const normalize = (a: Vec3): Vec3 => {
  const l = len(a) || 1e-9;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};

// Goc giua 2 vector, tra ve DO (0..180).
export const angleDeg = (a: Vec3, b: Vec3): number => {
  const c = dot(a, b) / ((len(a) || 1e-9) * (len(b) || 1e-9));
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
};

export const median = (arr: number[]): number => {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
