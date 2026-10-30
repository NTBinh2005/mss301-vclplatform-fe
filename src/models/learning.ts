// Shapes mirror the MSS backend DTOs (learning-service). Keep in sync with the Java side.

export interface CategoryResponse {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
}

export interface VocabularyResponse {
  id: number;
  categoryId: number;
  categoryName: string;
  word: string;
  description: string | null;
  videoTutorialUrl: string | null;
  imageUrl: string | null;
  expectedId: number | null;
}

export type LearningStatus = 'LEARNING' | 'LEARNED';

export interface UserProgressResponse {
  vocabularyId: number;
  word: string;
  categoryName: string;
  learningStatus: LearningStatus;
  lastAttemptedAt: string;
}

export type EvaluationStatus = 'CORRECT' | 'ALMOST_CORRECT' | 'INCORRECT';

export interface EvaluationResponse {
  status: EvaluationStatus;
  message: string;
  confidence: number; // 0-100
  predictedId: number;
  rank: number; // 1 = the expected sign was the model's top guess
}

export interface PracticeStatsResponse {
  totalAttempts: number;
  correctAttempts: number;
  learnedCount: number;
  totalVocabs: number;
  accuracyRate: number; // 0-100
  proficiency: number; // 0-100, % of vocabulary LEARNED
  currentStreak: number;
  longestStreak: number;
  weekActivity: boolean[]; // 7 entries, oldest -> newest; last = today
}

export interface AchievementResponse {
  id: number;
  key: string;
  name: string;
  description: string;
  iconKey: string;
  unlocked: boolean;
  unlockedAt: string | null;
}

export interface AttemptResponse {
  attemptId: number;
  vocabularyId: number;
  word: string;
  categoryId: number;
  categoryName: string;
  expectedId: number;
  isCorrect: boolean;
  aiPredictedCode: number;
  confidence: number | null; // null on legacy rows
  attemptedAt: string;
}

export interface CategoryRequest {
  name: string;
  description?: string;
}

/** Media (image, tutorial video) is uploaded separately, after the sign exists. */
export interface VocabularyRequest {
  categoryId: number;
  word: string;
  description?: string;
  expectedId?: number;
}

/* ---- Trợ lý học tập (ai-service POST /api/ai/assistant/chat) ---- */
export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** VOCABULARY: id = vocabularyId · CATEGORY: id = categoryId. Backend chỉ trả id có thật. */
export interface AssistantCard {
  type: 'VOCABULARY' | 'CATEGORY';
  id: number;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  practicable: boolean;
}

export interface AssistantReply {
  reply: string;
  cards: AssistantCard[];
}
