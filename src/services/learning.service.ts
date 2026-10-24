import { formData, http } from '../api/client';
import type {
  AchievementResponse, ApiResponse, AttemptResponse, CategoryRequest, CategoryResponse,
  EvaluationResponse, PageResponse, PracticeStatsResponse, UserProgressResponse,
  VocabularyRequest, VocabularyResponse,
} from '../models';
import { q, unwrap } from './shared';

/* =====================  learning-service  ===================== */
export const categoryApi = {
  list: (page = 0, size = 100) =>
    unwrap(http.get<ApiResponse<PageResponse<CategoryResponse>>>(`/categories?${q({ page, size })}`)),
  get: (id: number) => unwrap(http.get<ApiResponse<CategoryResponse>>(`/categories/${id}`)),
  create: (body: CategoryRequest) => unwrap(http.post<ApiResponse<CategoryResponse>>('/categories', body)),
  update: (id: number, body: CategoryRequest) =>
    unwrap(http.put<ApiResponse<CategoryResponse>>(`/categories/${id}`, body)),
  remove: (id: number) => unwrap(http.delete<ApiResponse<void>>(`/categories/${id}`)),
};

export const vocabularyApi = {
  list: (page = 0, size = 500) =>
    unwrap(http.get<ApiResponse<PageResponse<VocabularyResponse>>>(`/vocabularies?${q({ page, size })}`)),
  get: (id: number) => unwrap(http.get<ApiResponse<VocabularyResponse>>(`/vocabularies/${id}`)),
  search: (keyword: string, page = 0, size = 50) =>
    unwrap(http.get<ApiResponse<PageResponse<VocabularyResponse>>>(`/vocabularies/search?${q({ keyword, page, size })}`)),
  byCategory: (categoryId: number, page = 0, size = 100) =>
    unwrap(http.get<ApiResponse<PageResponse<VocabularyResponse>>>(`/vocabularies/category/${categoryId}?${q({ page, size })}`)),
  create: (body: VocabularyRequest) => unwrap(http.post<ApiResponse<VocabularyResponse>>('/vocabularies', body)),
  update: (id: number, body: VocabularyRequest) =>
    unwrap(http.put<ApiResponse<VocabularyResponse>>(`/vocabularies/${id}`, body)),
  remove: (id: number) => unwrap(http.delete<ApiResponse<void>>(`/vocabularies/${id}`)),
};

export const practiceApi = {
  progress: () => unwrap(http.get<ApiResponse<UserProgressResponse[]>>('/practice/progress')),
  stats: () => unwrap(http.get<ApiResponse<PracticeStatsResponse>>('/practice/stats')),
  achievements: () => unwrap(http.get<ApiResponse<AchievementResponse[]>>('/practice/achievements')),
  // startFrac/endFrac (0..1) trim the clip to the part that contains the movement;
  // the model samples its 16 frames inside that window.
  evaluate: (video: File, expectedId: number, startFrac = 0, endFrac = 1) =>
    unwrap(http.post<ApiResponse<EvaluationResponse>>(
      '/practice/evaluate',
      formData({
        video,
        expectedId: String(expectedId),
        startFrac: startFrac.toFixed(4),
        endFrac: endFrac.toFixed(4),
      }),
      // A cold model can take well over a minute on its first inference.
      { timeout: 120000 },
    )),
};

export const attemptApi = {
  mine: (page = 0, size = 20) =>
    unwrap(http.get<ApiResponse<PageResponse<AttemptResponse>>>(`/attempts?${q({ page, size })}`)),
  recent: (limit = 5) => unwrap(http.get<ApiResponse<AttemptResponse[]>>(`/attempts/recent?${q({ limit })}`)),
};
