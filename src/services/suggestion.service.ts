import { http } from '../api/client';
import type {
  ApiResponse, VocabularyExistsResult, VocabularySuggestionResponse, VocabularySynonymResult,
} from '../models';
import { q, unwrap } from './shared';

type SuggestionBody = { categoryId: number; word: string; description?: string };

/* =====================  vocabulary suggestions  ===================== */
export const suggestionApi = {
  exists: (word: string) =>
    unwrap(http.get<ApiResponse<VocabularyExistsResult>>(`/vocabularies/exists?${q({ word })}`)),
  // Gemini can be slow, so this gets its own timeout.
  synonyms: (word: string) =>
    unwrap(http.get<ApiResponse<VocabularySynonymResult>>(`/vocabularies/ai-synonyms?${q({ word })}`, { timeout: 50000 })),
  submit: (body: SuggestionBody) =>
    unwrap(http.post<ApiResponse<VocabularySuggestionResponse>>('/vocabulary-suggestions', body)),
  mine: () => unwrap(http.get<ApiResponse<VocabularySuggestionResponse[]>>('/vocabulary-suggestions/mine')),
  // Only while the request is still PENDING.
  update: (id: number, body: SuggestionBody) =>
    unwrap(http.put<ApiResponse<VocabularySuggestionResponse>>(`/vocabulary-suggestions/${id}`, body)),
  withdraw: (id: number) => unwrap(http.delete<ApiResponse<void>>(`/vocabulary-suggestions/${id}`)),
};
