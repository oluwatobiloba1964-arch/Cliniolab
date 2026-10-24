// src/lib/services/localUiPrefs.ts
'use client';

/**
 * Browser-only UI preferences. Never calls fetch, APIs, or the database.
 * Keys follow the existing cliniolab_* / cliniolab: conventions.
 */

export const QUIZ_FILTERS_KEY = 'cliniolab_quiz_list_filters_v1';
export const FLASHCARD_FILTERS_KEY = 'cliniolab_flashcard_list_filters_v1';
export const BLOG_FILTERS_KEY = 'cliniolab_blog_list_filters_v1';
export const RESOURCE_FILTERS_KEY = 'cliniolab_resource_list_filters_v1';
export const LIST_DENSITY_KEY = 'cliniolab_list_density_v1';
export const PAGE_NOTES_KEY = 'cliniolab_page_notes_v1';
export const RECENT_SEARCHES_KEY = 'cliniolab_recent_searches';

export type ListDensity = 'comfortable' | 'compact';

export type QuizListFilters = {
  mode?: string;
  difficulty?: string;
  category?: string;
  sort?: string;
};

export type FlashcardListFilters = {
  categoryFilter?: string;
  sort?: string;
};

export type BlogListFilters = {
  category?: string;
  sort?: string;
};

export type ResourceListFilters = {
  filter?: string;
  priceFilter?: string;
  categorySlug?: string | null;
  sort?: string;
};

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

export function readQuizFilters(): QuizListFilters {
  return readJson<QuizListFilters>(QUIZ_FILTERS_KEY, {});
}

export function writeQuizFilters(patch: QuizListFilters): boolean {
  return writeJson(QUIZ_FILTERS_KEY, { ...readQuizFilters(), ...patch });
}

export function clearQuizFilters(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.removeItem(QUIZ_FILTERS_KEY);
    return true;
  } catch {
    return false;
  }
}

export function readFlashcardFilters(): FlashcardListFilters {
  return readJson<FlashcardListFilters>(FLASHCARD_FILTERS_KEY, {});
}

export function writeFlashcardFilters(patch: FlashcardListFilters): boolean {
  return writeJson(FLASHCARD_FILTERS_KEY, { ...readFlashcardFilters(), ...patch });
}

export function clearFlashcardFilters(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.removeItem(FLASHCARD_FILTERS_KEY);
    return true;
  } catch {
    return false;
  }
}

export function readBlogFilters(): BlogListFilters {
  return readJson<BlogListFilters>(BLOG_FILTERS_KEY, {});
}

export function writeBlogFilters(patch: BlogListFilters): boolean {
  return writeJson(BLOG_FILTERS_KEY, { ...readBlogFilters(), ...patch });
}

export function clearBlogFilters(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.removeItem(BLOG_FILTERS_KEY);
    return true;
  } catch {
    return false;
  }
}

export function readResourceFilters(): ResourceListFilters {
  return readJson<ResourceListFilters>(RESOURCE_FILTERS_KEY, {});
}

export function writeResourceFilters(patch: ResourceListFilters): boolean {
  return writeJson(RESOURCE_FILTERS_KEY, { ...readResourceFilters(), ...patch });
}

export function clearResourceFilters(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.removeItem(RESOURCE_FILTERS_KEY);
    return true;
  } catch {
    return false;
  }
}

export function readListDensity(scope: 'quizzes' | 'flashcards' | 'blog' | 'resources' = 'quizzes'): ListDensity {
  const all = readJson<Partial<Record<string, ListDensity>>>(LIST_DENSITY_KEY, {});
  return all[scope] === 'compact' ? 'compact' : 'comfortable';
}

export function writeListDensity(scope: 'quizzes' | 'flashcards' | 'blog' | 'resources', density: ListDensity): boolean {
  const all = readJson<Partial<Record<string, ListDensity>>>(LIST_DENSITY_KEY, {});
  return writeJson(LIST_DENSITY_KEY, { ...all, [scope]: density });
}

export type PageNote = { text: string; updatedAt: string };

export function readPageNotes(): Record<string, PageNote> {
  return readJson<Record<string, PageNote>>(PAGE_NOTES_KEY, {});
}

export function readPageNote(path: string): PageNote | null {
  const notes = readPageNotes();
  return notes[path] ?? null;
}

export function writePageNote(path: string, text: string): boolean {
  const notes = readPageNotes();
  const trimmed = text.trim();
  if (!trimmed) {
    delete notes[path];
    return writeJson(PAGE_NOTES_KEY, notes);
  }
  notes[path] = { text: trimmed.slice(0, 2000), updatedAt: new Date().toISOString() };
  return writeJson(PAGE_NOTES_KEY, notes);
}

export function clearPageNote(path: string): boolean {
  const notes = readPageNotes();
  delete notes[path];
  return writeJson(PAGE_NOTES_KEY, notes);
}
