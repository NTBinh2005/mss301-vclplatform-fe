// API cong khai cua tang phan tich tay.
//
// analyzeHands() chay OFFLINE sau khi record xong, doc lap voi luong cham diem
// MViTv2 o backend. Neu chua co mau hoac khong bat duoc tay -> tra ve
// available:false (UI tu an, khong lam vo app).
import { HandFeedback } from './types';
import { extractFromSource } from './landmarks';
import { buildSequences, loadReference } from './reference';
import { buildFeedback } from './feedbackRules';

export type { HandFeedback, HandComment, SignReference } from './types';

interface AnalyzeInput {
  clipBlob: Blob;
  classId: number;
  sampleVideoUrl?: string;
}

export async function analyzeHands({ clipBlob, classId, sampleVideoUrl }: AnalyzeInput): Promise<HandFeedback> {
  const ref = await loadReference(classId, sampleVideoUrl);
  if (!ref) {
    return emptyFeedback('Chưa có mẫu tham chiếu cho từ này (video mẫu chưa nhận diện được bàn tay).');
  }

  const clipUrl = URL.createObjectURL(clipBlob);
  try {
    const frames = await extractFromSource(clipUrl);
    const { right, left } = buildSequences(frames);
    if (!right?.length && !left?.length) {
      return emptyFeedback('Không phát hiện được bàn tay trong video của bạn. Hãy giữ tay rõ trong khung hình.');
    }
    return buildFeedback(right, left, ref);
  } finally {
    URL.revokeObjectURL(clipUrl);
  }
}

function emptyFeedback(note: string): HandFeedback {
  return { available: false, handCountOk: true, handShapeScore: 0, palmScore: 0, comments: [], note };
}
