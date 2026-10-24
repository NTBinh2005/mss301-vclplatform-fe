import { http } from '../api/client';
import type {
  ApiResponse, VocabularyExistsResult, VocabularySuggestionResponse, VocabularySynonymResult,
} from '../models';
import { q, unwrap } from './shared';

/* =====================  vocabulary suggestions  ===================== */
export const suggestionApi = {
  exists: (word: string) =>
    unwrap(http.get<ApiResponse<VocabularyExistsResult>>(`/vocabularies/exists?${q({ word })}`)),
  // Gemini can be slow, so this gets its own timeout.
  synonyms: (word: string) =>
    unwrap(http.get<ApiResponse<VocabularySynonymResult>>(`/vocabularies/ai-synonyms?${q({ word })}`, { timeout: 50000 })),
  submit: (body: { categoryId: number; word: string; description?: string }) =>
    unwrap(http.post<ApiResponse<VocabularySuggestionResponse>>('/vocabulary-suggestions', body)),
  mine: () => unwrap(http.get<ApiResponse<VocabularySuggestionResponse[]>>('/vocabulary-suggestions/mine')),
};
