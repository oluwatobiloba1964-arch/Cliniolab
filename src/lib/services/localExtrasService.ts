// src/lib/services/localExtrasService.ts
'use client';

/**
 * Small, focused helpers for browser-only features. Nothing here ever
 * touches the network. Everything reads from or writes to localStorage.
 *
 * The main toolkit key is reused where the data naturally belongs there
 * (formulas, goals, reflections, etc.). Features that are clearly their
 * own concern get their own small key, so a corrupt store in one feature
 * cannot take the others down with it.
 */

export const TOOLKIT_KEY = 'cliniolab_local_study_toolkit_v1';
export const FORMULAS_KEY = 'cliniolab_formulas_v1';
export const GOALS_KEY = 'cliniolab_study_goals_v1';
export const EXAMS_KEY = 'cliniolab_upcoming_exams_v1';
export const PRESETS_KEY = 'cliniolab_study_presets_v1';
export const QUIZ_QUEUE_KEY = 'cliniolab_quiz_queue_v1';
export const COPIED_EXPLANATIONS_KEY = 'cliniolab_copied_explanations_v1';
export const QUIZ_NOTES_KEY = 'cliniolab_quiz_notes_v1';
export const FLASHCARD_NOTES_KEY = 'cliniolab_flashcard_notes_v1';
export const ABBREV_STARS_KEY = 'cliniolab_starred_abbreviations_v1';
export const ARTICLE_DISPLAY_KEY = 'cliniolab_article_display_v1';
export const ATTEMPTED_QUIZZES_KEY = 'cliniolab_attempted_quizzes_v1';

export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readToolkit<T extends Record<string, unknown>>(): T {
  return readJson<T>(TOOLKIT_KEY, {} as T);
}

export function writeToolkitPatch(patch: Record<string, unknown>): boolean {
  const current = readToolkit();
  return writeJson(TOOLKIT_KEY, { ...current, ...patch });
}

export function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function todayKey(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
