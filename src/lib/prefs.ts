import { useSyncExternalStore } from 'react';

/* Per-user, per-device preferences for things the backend has no concept of:
   the daily goal, favourites, finished guided lessons, today's flashcard reviews,
   and reduced motion. Everything that the backend *does* own (progress, streak,
   attempts) is always read from the API instead. */

export interface Prefs {
  goal: number;
  favs: number[];
  reduceMotion: boolean;
  completedLessons: string[];
  day: string; // the date the *Today counters below belong to
  reviewedToday: number[];
  lessonsToday: number;
}

const today = () => new Date().toISOString().slice(0, 10);
const defaults = (): Prefs => ({
  goal: 3, favs: [], reduceMotion: false, completedLessons: [],
  day: today(), reviewedToday: [], lessonsToday: 0,
});

let userKey = 'signmentor:prefs:anon';
let state: Prefs = load();
const listeners = new Set<() => void>();

function load(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(userKey) || '{}') as Partial<Prefs>;
    const merged = { ...defaults(), ...raw };
    // Daily counters reset when the date rolls over.
    if (merged.day !== today()) Object.assign(merged, { day: today(), reviewedToday: [], lessonsToday: 0 });
    return merged;
  } catch {
    return defaults();
  }
}

function emit() { listeners.forEach(l => l()); }

export function bindPrefsToUser(userId: number | string | null) {
  userKey = `signmentor:prefs:${userId ?? 'anon'}`;
  state = load();
  emit();
}

export function updatePrefs(patch: Partial<Prefs> | ((p: Prefs) => Partial<Prefs>)) {
  const base = state.day === today() ? state : { ...state, day: today(), reviewedToday: [], lessonsToday: 0 };
  state = { ...base, ...(typeof patch === 'function' ? patch(base) : patch) };
  try { localStorage.setItem(userKey, JSON.stringify(state)); } catch { /* storage may be blocked */ }
  emit();
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

export function usePrefs(): Prefs {
  const p = useSyncExternalStore(subscribe, () => state);
  return media?.matches && !p.reduceMotion ? { ...p, reduceMotion: true } : p;
}

export const getPrefs = () => state;
