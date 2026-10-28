// Chi so landmark theo chuan MediaPipe Hand (21 diem) va cac nguong so sanh.

export const WRIST = 0;

// Moi ngon: [MCP (goc ngon), khop giua, TIP (dau ngon)] - do goc co/duoi tai khop giua.
export const FINGER_JOINTS: Record<string, [number, number, number]> = {
  thumb:  [2, 3, 4],
  index:  [5, 6, 8],
  middle: [9, 10, 12],
  ring:   [13, 14, 16],
  pinky:  [17, 18, 20],
};

export const FINGER_ORDER = ['thumb', 'index', 'middle', 'ring', 'pinky'] as const;

// Nhan tieng Viet co dau cho tung ngon (hien cho nguoi dung).
export const FINGER_LABELS_VI: Record<string, string> = {
  thumb:  'ngón cái',
  index:  'ngón trỏ',
  middle: 'ngón giữa',
  ring:   'ngón áp út',
  pinky:  'ngón út',
};

// Diem MCP cua ngon tro va ngon ut - dung dung mat phang long ban tay.
export const INDEX_MCP = 5;
export const PINKY_MCP = 17;

// -------- Cham diem --------
// Vi dac trung nay tinh tu worldLandmarks (3D thuc, doc lap camera) nen tin hieu
// sach hon -> ngưỡng siet lai de CO TINH PHAN BIET (dong tac sai bi phat hien),
// chi chua 1 vung dem NHO cho nhieu cam bien that su.
// Ngon: sai lech do co <= DEADZONE coi nhu dung 100%; >= MAXDIFF la 0 diem.
export const FINGER_DEADZONE = 0.15; // 0..1
export const FINGER_MAXDIFF = 0.75;  // 0..1
// Chi NHAC ve 1 ngon khi sai lech RO RANG.
export const FINGER_FLAG_DIFF = 0.40;

// Long ban tay: goc lech <= DEADZONE coi nhu khop 100%; >= MAXDIFF la 0 diem.
export const PALM_DEADZONE_DEG = 30;
export const PALM_MAXDIFF_DEG = 110;
// Chi NHAC ve huong long ban tay khi HUONG khac han mau VA goc lech du lon.
export const PALM_FLAG_DEG = 50;

// -------- Phase 3: xoe ngon + ngon cai --------
export const SPREAD_DEADZONE = 0.12;
export const SPREAD_MAXDIFF = 0.55;
export const SPREAD_FLAG = 0.28;    // nhac "xoe/khep" khi lech trung binh vuot nguong
export const THUMB_DEADZONE = 0.15;
export const THUMB_MAXDIFF = 0.9;
export const THUMB_FLAG = 0.40;
// Trong so gop 3 phan thanh diem "Hinh dang ngon".
export const W_SHAPE_CURL = 0.6;
export const W_SHAPE_SPREAD = 0.25;
export const W_SHAPE_THUMB = 0.15;

// Ban tay co score thap hon nay thi bo qua (coi la nhieu).
export const MIN_HAND_SCORE = 0.5;
// So frame lay mau tu clip de phan tich (offline nen co the nhieu hon 16).
export const SAMPLE_FRAMES = 24;

// Nhan huong long ban tay - TRUC QUAN thay cho "do".
// LUU Y: dau truc z (ra ngoai/vao trong) va x (trai/phai) co the bi nguoc tuy
// he toa do; neu thuc te thay nguoc thi dao dau o classifyPalmFacing() - 1 dong.
export type PalmFacing = 'out' | 'in' | 'up' | 'down' | 'left' | 'right';
export const PALM_FACING_VI: Record<PalmFacing, string> = {
  out: 'hướng ra ngoài (về phía trước)',
  in: 'hướng vào trong (về phía người)',
  up: 'hướng lên trên',
  down: 'hướng xuống dưới',
  left: 'hướng sang trái',
  right: 'hướng sang phải',
};
