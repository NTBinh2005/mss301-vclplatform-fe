import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { attemptApi, categoryApi, practiceApi, vocabularyApi } from '../services';
import { apiErrorMessage } from '../api/errors';
import type { AchievementResponse, AttemptResponse, CategoryResponse, PracticeStatsResponse } from '../models';
import { isToday } from '../lib/format';
import { usePrefs } from '../lib/prefs';
import { buildJourney, buildSigns, type Chapter, type Lesson, lessonState, type LessonState, type Sign } from '../lib/signs';

interface LearningValue {
  loading: boolean;
  error: string | null;
  categories: CategoryResponse[];
  signs: Sign[];
  signById: Map<number, Sign>;
  chapters: Chapter[];
  lessons: Lesson[];
  stateOf: (l: Lesson) => LessonState;
  nextLesson: Lesson | null;
  due: Sign[]; // practised but never signed correctly, and not reviewed today
  stats: PracticeStatsResponse | null;
  achievements: AchievementResponse[];
  attempts: AttemptResponse[]; // newest first
  attemptsToday: number;
  activityToday: number; // attempts + guided lessons + flashcard reviews, for the daily goal
  reload: () => Promise<void>;
}

const LearningContext = createContext<LearningValue | null>(null);

export function LearningProvider({ children }: { children: ReactNode }) {
  const prefs = usePrefs();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [signs, setSigns] = useState<Sign[]>([]);
  const [stats, setStats] = useState<PracticeStatsResponse | null>(null);
  const [achievements, setAchievements] = useState<AchievementResponse[]>([]);
  const [attempts, setAttempts] = useState<AttemptResponse[]>([]);

  const reload = useCallback(async () => {
    // Core catalogue + progress. Kept apart from the stats block below so one
    // failing endpoint cannot blank the whole app.
    try {
      const [cats, vocab, progress, mine] = await Promise.all([
        categoryApi.list(0, 100),
        vocabularyApi.list(0, 500),
        practiceApi.progress(),
        attemptApi.mine(0, 50),
      ]);
      setCategories(cats.content);
      setSigns(buildSigns(vocab.content, progress));
      setAttempts(mine.content);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load your lessons.'));
    }
    try {
      const [s, a] = await Promise.all([practiceApi.stats(), practiceApi.achievements()]);
      setStats(s);
      setAchievements(a);
    } catch {
      // Stats are decoration on top of the lessons; the app still works without them.
    }
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const value = useMemo<LearningValue>(() => {
    const signById = new Map(signs.map(s => [s.id, s]));
    const { chapters, lessons } = buildJourney(categories, signs);
    const chapterOf = (l: Lesson) => chapters[l.chapter];
    const stateOf = (l: Lesson) => lessonState(l, chapterOf(l), signById, prefs.completedLessons);
    const nextLesson = lessons.find(l => stateOf(l) === 'current') || null;
    const due = signs.filter(s => s.status === 'learning' && !prefs.reviewedToday.includes(s.id));
    const attemptsToday = attempts.filter(a => isToday(a.attemptedAt)).length;
    return {
      loading, error, categories, signs, signById, chapters, lessons, stateOf, nextLesson, due,
      stats, achievements, attempts, attemptsToday,
      activityToday: attemptsToday + prefs.lessonsToday + prefs.reviewedToday.length,
      reload,
    };
  }, [loading, error, categories, signs, stats, achievements, attempts, prefs.completedLessons, prefs.reviewedToday, prefs.lessonsToday, reload]);

  return <LearningContext.Provider value={value}>{children}</LearningContext.Provider>;
}

export function useLearning() {
  const ctx = useContext(LearningContext);
  if (!ctx) throw new Error('useLearning must be used inside LearningProvider');
  return ctx;
}
