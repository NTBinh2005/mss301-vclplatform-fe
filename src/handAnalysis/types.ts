// Kieu du lieu cho tang phan tich tay (hand feedback).
// Toan bo tang nay chay OFFLINE tren clip da ghi, doc lap voi MViTv2 backend.
// Muc tieu: nhan xet chi tiet "tay sai cho nao" tu toa do landmark, KHONG phai
// tu ma tran mau pixel.

export interface Vec3 { x: number; y: number; z: number; }

export type Handedness = 'Left' | 'Right';

// 21 landmark cua 1 ban tay (chuan MediaPipe HandLandmarker).
export interface HandObservation {
  handedness: Handedness;
  landmarks: Vec3[]; // toa do ANH (0..1) - phu thuoc camera, dung cho crop/huong tuong doi
  world: Vec3[];     // toa do THUC 3D (met), goc o tam ban tay - DOC LAP camera/khoang cach
  score: number;     // do tin cay ban tay (0..1)
}

// Cac ban tay bat duoc trong 1 frame (0, 1 hoac 2 tay).
export type FrameObservation = HandObservation[];

// Dac trung hinh hoc rut ra tu 1 ban tay.
export interface HandFeatures {
  // Do co cua 5 ngon: 0 = duoi thang, 1 = co han. Thu tu: [cai, tro, giua, ap-ut, ut]
  curls: number[];
  // Do XOE giua 4 cap ngon ke nhau (0 = khep, cao = xoe rong). Chuan hoa ~0..1.
  // Thu tu: [cai-tro, tro-giua, giua-aput, aput-ut]
  spreads: number[];
  // Khoang cach ngon cai <-> ngon tro / kich thuoc ban tay (0 = cham nhau).
  thumbGap: number;
  // Vector phap tuyen long ban tay (da chuan hoa).
  palmNormal: Vec3;
}

// Mau tham chieu (the hien "dung") cua 1 tu vung.
// Luu CHUOI dac trung theo tung frame (da cat doan nghi) de so khop bang DTW.
export interface SignReference {
  classId: number;
  handCount: 1 | 2;
  right?: HandFeatures[];
  left?: HandFeatures[];
  source: 'sample-video' | 'precomputed';
}

export type Severity = 'good' | 'info' | 'warn';

export interface HandComment {
  type: 'HAND_COUNT' | 'FINGER' | 'PALM';
  severity: Severity;
  text: string; // tieng Viet co dau, hien truc tiep cho nguoi dung
}

// Ket qua tra ve cho UI.
export interface HandFeedback {
  available: boolean;      // false = khong co mau hoac khong bat duoc tay
  handCountOk: boolean;
  handShapeScore: number;  // 0..100
  palmScore: number;       // 0..100
  comments: HandComment[];
  note?: string;           // ly do khi available = false
}
