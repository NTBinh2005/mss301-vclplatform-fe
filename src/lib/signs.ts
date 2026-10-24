import type { CategoryResponse, LearningStatus, UserProgressResponse, VocabularyResponse } from '../models';
import { ARC_NAMES, type Frame, SHAPE_NAMES } from '../components/Hand';

export type SignStatus = 'new' | 'learning' | 'learned';

export interface Sign {
  id: number;
  word: string;
  description: string;
  categoryId: number;
  categoryName: string;
  videoUrl: string | null;
  imageUrl: string | null;
  expectedId: number | null;
  status: SignStatus;
  lastAttemptedAt: string | null;
  frames: Frame[]; // fallback flipbook when the vocabulary has no tutorial video
}

export interface Lesson {
  id: string; // `${categoryId}-${part}`
  n: number; // running number across the whole journey
  part: number;
  chapter: number; // index into chapters
  categoryId: number;
  title: string;
  signIds: number[];
  minutes: number;
}

export interface Chapter {
  category: CategoryResponse;
  lessons: Lesson[];
}

const SIGNS_PER_LESSON = 3;

// Stable string hash so a word always gets the same hand drawing.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// The backend stores videos, not hand-shape notation, so this draws a stand-in
// flipbook that is unique per word and identical on every visit.
export function framesFor(word: string): Frame[] {
  const h = hash(word);
  const shape = SHAPE_NAMES[h % SHAPE_NAMES.length];
  const arc = ARC_NAMES[(h >>> 4) % ARC_NAMES.length];
  const amp = 6 + ((h >>> 8) % 10);
  const rot = ((h >>> 12) % 30) - 15;
  return [
    { shape, rot, arc },
    { shape, rot: rot + amp, dx: amp / 2, dy: -amp },
    { shape, rot: rot - amp / 2, dx: -amp / 2, dy: -amp / 2 },
  ];
}

const statusOf = (s?: LearningStatus): SignStatus => (s === 'LEARNED' ? 'learned' : s === 'LEARNING' ? 'learning' : 'new');

export function buildSigns(vocab: VocabularyResponse[], progress: UserProgressResponse[]): Sign[] {
  const byId = new Map(progress.map(p => [p.vocabularyId, p]));
  return vocab.map(v => {
    const p = byId.get(v.id);
    return {
      id: v.id,
      word: v.word,
      description: v.description || '',
      categoryId: v.categoryId,
      categoryName: v.categoryName,
      videoUrl: v.videoTutorialUrl || null,
      imageUrl: v.imageUrl || null,
      expectedId: v.expectedId ?? null,
      status: statusOf(p?.learningStatus),
      lastAttemptedAt: p?.lastAttemptedAt ?? null,
      frames: framesFor(v.word),
    };
  });
}

// Chapters are categories; each is cut into short lessons of a few signs,
// ordered the way an admin created them.
export function buildJourney(categories: CategoryResponse[], signs: Sign[]): { chapters: Chapter[]; lessons: Lesson[] } {
  const lessons: Lesson[] = [];
  const chapters = [...categories].sort((a, b) => a.id - b.id).map((category, ci) => {
    const inCat = signs.filter(s => s.categoryId === category.id).sort((a, b) => a.id - b.id);
    const parts: Lesson[] = [];
    for (let i = 0; i < inCat.length; i += SIGNS_PER_LESSON) {
      const chunk = inCat.slice(i, i + SIGNS_PER_LESSON);
      const part = i / SIGNS_PER_LESSON + 1;
      const lesson: Lesson = {
        id: `${category.id}-${part}`,
        n: lessons.length + 1,
        part,
        chapter: ci,
        categoryId: category.id,
        title: inCat.length > SIGNS_PER_LESSON ? `${category.name}, part ${part}` : category.name,
        signIds: chunk.map(s => s.id),
        minutes: chunk.length * 2 + 1,
      };
      parts.push(lesson);
      lessons.push(lesson);
    }
    return { category, lessons: parts };
  });
  return { chapters, lessons };
}

export type LessonState = 'done' | 'current' | 'locked';

// A lesson counts as done once its guided walkthrough was finished on this device,
// or once the backend says every sign in it is learned. Within a chapter, lessons
// unlock one after another.
export function lessonState(lesson: Lesson, chapter: Chapter, signsById: Map<number, Sign>, completed: string[]): LessonState {
  const isDone = (l: Lesson) =>
    completed.includes(l.id) || (l.signIds.length > 0 && l.signIds.every(id => signsById.get(id)?.status === 'learned'));
  if (isDone(lesson)) return 'done';
  const idx = chapter.lessons.indexOf(lesson);
  const prev = idx > 0 ? chapter.lessons[idx - 1] : null;
  return prev && !isDone(prev) ? 'locked' : 'current';
}
