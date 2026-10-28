// Shapes mirror the MSS backend DTOs (learning-service). Keep in sync with the Java side.

export interface VocabularySuggestionResponse {
  id: number;
  word: string;
  description: string | null;
  status: 'PENDING' | 'REVIEWED';
  createdAt: string;
  reviewedAt: string | null;
  categoryId: number;
  categoryName: string;
  requesterId: number; // names come from identity /users/summaries
}

export interface VocabularyExistsResult {
  exists: boolean;
  word: string | null;
  categoryId: number | null;
  categoryName: string | null;
}

export interface VocabularySynonymResult {
  aiChecked: boolean;
  aiError: boolean;
  synonyms: { word: string; categoryName: string }[];
}
