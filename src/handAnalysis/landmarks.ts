// Trich landmark tay tu 1 video (clip user hoac video mau) bang MediaPipe
// HandLandmarker. Chay OFFLINE (sau khi record) nen cham vai giay khong sao -
// khong dung vao vong lap live vi may yeu.
import type { HandLandmarker } from '@mediapipe/tasks-vision';
import { FrameObservation, HandObservation } from './types';
import { SAMPLE_FRAMES, MIN_HAND_SCORE } from './constants';

let handLandmarkerPromise: Promise<HandLandmarker> | null = null;

// Lazy-load HandLandmarker MOT LAN. Dung chung thu muc WASM voi PoseLandmarker
// (da self-host o /models/mediapipe_hands/wasm). CPU delegate vi may yeu.
export function getHandLandmarker(): Promise<HandLandmarker> {
  if (!handLandmarkerPromise) {
    handLandmarkerPromise = (async () => {
      const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks('/models/mediapipe_hands/wasm');
      return HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: '/models/mediapipe_hands/hand_landmarker.task',
          delegate: 'CPU',
        },
        // IMAGE mode (khong phai VIDEO): ta seek toi tung frame ROI RAC roi phan
        // tich doc lap. VIDEO mode yeu cau timestamp tang dan lien tuc tren cung 1
        // detector -> vi dung chung detector cho ca video mau LAN clip user (moi
        // video timestamp lai bat dau tu 1) se gay loi "Packet timestamp mismatch".
        // IMAGE mode + detect() khong dung timestamp nen tranh han loi do, va dung
        // ban chat hon cho frame seek (chay lai palm-detector moi frame, khong dua
        // vao tracking lien tuc giua cac frame khong ke nhau).
        runningMode: 'IMAGE',
        numHands: 2,
      });
    })();
  }
  return handLandmarkerPromise;
}

// Clip webm tu MediaRecorder thuong bao duration = Infinity cho den khi ta seek
// mot lan that xa -> trinh duyet moi "chot" duration. Xu ly truoc khi lay mau.
function ensureDuration(video: HTMLVideoElement): Promise<number> {
  if (isFinite(video.duration) && video.duration > 0) return Promise.resolve(video.duration);
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      video.currentTime = 0;
      resolve(isFinite(video.duration) && video.duration > 0 ? video.duration : 0);
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = 1e7; // seek that xa de ep tinh duration
  });
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = Math.min(time, Math.max(0, (video.duration || time) - 1e-3));
  });
}

// Lay N moc thoi gian cach deu, chay HandLandmarker tai moi moc.
// Tra ve mang frame; moi frame la danh sach ban tay bat duoc (0..2).
async function extractFromVideoElement(video: HTMLVideoElement, n: number): Promise<FrameObservation[]> {
  const detector = await getHandLandmarker();
  const duration = await ensureDuration(video);
  if (!isFinite(duration) || duration <= 0) return [];

  const frames: FrameObservation[] = [];
  for (let i = 0; i < n; i++) {
    const t = (duration * (i + 0.5)) / n; // giua moi khoang deu
    await seek(video, t);
    const res = detector.detect(video); // IMAGE mode: khong can timestamp
    const hands: HandObservation[] = [];
    const count = res.landmarks?.length ?? 0;
    // Ten field handedness khac nhau giua cac ban tasks-vision -> lay ca hai.
    const handed = (res as any).handednesses ?? (res as any).handedness;
    for (let h = 0; h < count; h++) {
      const cat = handed?.[h]?.[0];
      const score = cat?.score ?? 0;
      if (score < MIN_HAND_SCORE) continue;
      const img = res.landmarks[h];
      // worldLandmarks = toa do THUC 3D (met), doc lap camera - dung cho dac trung.
      const world = res.worldLandmarks?.[h] ?? img;
      hands.push({
        handedness: cat?.categoryName === 'Left' ? 'Left' : 'Right',
        landmarks: img.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 })),
        world: world.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 })),
        score,
      });
    }
    frames.push(hands);
  }
  return frames;
}

// Tao 1 <video> tam tu nguon (blob URL hoac URL video mau), doi metadata roi trich.
export async function extractFromSource(src: string, n = SAMPLE_FRAMES): Promise<FrameObservation[]> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  video.src = src;

  await new Promise<void>((resolve, reject) => {
    video.addEventListener('loadedmetadata', () => resolve(), { once: true });
    video.addEventListener('error', () => reject(new Error('Khong tai duoc video de phan tich tay')), { once: true });
  });

  try {
    return await extractFromVideoElement(video, n);
  } finally {
    video.removeAttribute('src');
    video.load();
  }
}
