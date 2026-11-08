// File: src/lib/services/missedQuestionSrsService.ts
// Browser-only spaced-repetition system (SRS) for missed quiz questions.
// Pure client-side: no fetch, no API call, no database read. Each missed
// question is stored once, with an SM-2-inspired schedule that decides
// when it should next be reviewed.

import type { MissReasonEntry } from '@/lib/services/localInsightsService';
import { getMissReasons } from '@/lib/services/localInsightsService';

export type SrsRating = 'again' | 'hard' | 'good' | 'easy';

export type MissedQuestionSrsItem = {
  /** Stable id: quizId:questionId */
  id: string;
  quizId: string;
  quizTitle: string;
  questionId: string;
  prompt: string;
  /** Original miss reason captured by QuizRunner. */
  missReason: MissReasonEntry['reason'];
  /** Number of times the learner has reviewed this card. */
  repetitions: number;
  /** SM-2 easiness factor (>= 1.3). */
  ease: number;
  /** Interval in days until the next review. */
  intervalDays: number;
  /** ISO timestamp of the last review (or added date if never reviewed). */
  lastReviewedAt: string;
  /** ISO timestamp when the next review is due. */
  dueAt: string;
};

const SRS_KEY = 'cliniolab_missed_question_srs_v1';

function nowIso(): string {
  return new Date().toISOString();
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + Math.round(days));
  return next;
}

const RATING_TO_QUALITY: Record<SrsRating, number> = {
  again: 0,
  hard: 3,
  good: 4,
  easy: 5,
};

// SM-2 inspired next-interval. Returns days (may be fractional for short
// intervals like 10 minutes / 1 day).
function nextInterval(rating: SrsRating, repetitions: number, ease: number, prevIntervalDays: number): { days: number; newEase: number; newRepetitions: number } {
  const quality = RATING_TO_QUALITY[rating];
  const newEase = Math.max(1.3, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  if (rating === 'again') {
    return { days: 10 / 60 / 24, newEase, newRepetitions: 0 };
  }
  const newRepetitions = repetitions + 1;
  let days: number;
  if (newRepetitions === 1) {
    days = rating === 'hard' ? 1 : rating === 'good' ? 3 : 7;
  } else if (newRepetitions === 2) {
    days = 6;
  } else {
    // Multiply the previous interval by the ease factor, with a minimum of 1 day.
    days = Math.max(1, Math.round((Math.max(prevIntervalDays, 1)) * newEase));
  }
  if (rating === 'hard') days = Math.max(1, Math.round(days * 0.8));
  return { days, newEase, newRepetitions };
}

function readSrsMap(): Map<string, MissedQuestionSrsItem> {
  if (typeof window === 'undefined') return new Map();
  try {
    const raw = window.localStorage.getItem(SRS_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Map();
    const map = new Map<string, MissedQuestionSrsItem>();
    for (const item of parsed) {
      if (item && typeof item.id === 'string') map.set(item.id, item as MissedQuestionSrsItem);
    }
    return map;
  } catch {
    return new Map();
  }
}

function writeSrsMap(map: Map<string, MissedQuestionSrsItem>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SRS_KEY, JSON.stringify(Array.from(map.values())));
  } catch {
    // Best-effort: never let SRS write failure break the UI.
  }
}

/**
 * Add a missed question to the SRS deck. If the question is already in
 * the deck, only its prompt/title is refreshed (so a renamed quiz title
 * stays current); the schedule and the originally captured miss reason
 * are preserved. This means a learner who manually tagged a question
 * as 'careless' won't have that reason silently overwritten by a
 * default 'knowledge-gap' reason on a later retake.
 */
export function addMissedQuestion(entry: MissReasonEntry): void {
  if (typeof window === 'undefined') return;
  const map = readSrsMap();
  const id = `${entry.quizId}:${entry.questionId}`;
  const existing = map.get(id);
  if (existing) {
    map.set(id, {
      ...existing,
      quizTitle: entry.quizTitle,
      prompt: entry.prompt,
      // Preserve the existing missReason unless it was never set.
      missReason: existing.missReason ?? entry.reason,
    });
  } else {
    const now = nowIso();
    map.set(id, {
      id,
      quizId: entry.quizId,
      quizTitle: entry.quizTitle,
      questionId: entry.questionId,
      prompt: entry.prompt,
      missReason: entry.reason,
      repetitions: 0,
      ease: 2.5,
      intervalDays: 0,
      lastReviewedAt: now,
      dueAt: now,
    });
  }
  writeSrsMap(map);
}

/** Re-seed the SRS deck from the existing miss-reasons store. Idempotent. */
export function reseedFromMissReasons(limit = 200): number {
  if (typeof window === 'undefined') return 0;
  const entries = getMissReasons().slice(0, limit);
  let added = 0;
  const map = readSrsMap();
  for (const entry of entries) {
    const id = `${entry.quizId}:${entry.questionId}`;
    if (map.has(id)) continue;
    const now = nowIso();
    map.set(id, {
      id,
      quizId: entry.quizId,
      quizTitle: entry.quizTitle,
      questionId: entry.questionId,
      prompt: entry.prompt,
      missReason: entry.reason,
      repetitions: 0,
      ease: 2.5,
      intervalDays: 0,
      lastReviewedAt: now,
      dueAt: now,
    });
    added += 1;
  }
  if (added > 0) writeSrsMap(map);
  return added;
}

export function getDueItems(): MissedQuestionSrsItem[] {
  const map = readSrsMap();
  const now = Date.now();
  const items: MissedQuestionSrsItem[] = [];
  for (const item of map.values()) {
    const due = new Date(item.dueAt).getTime();
    if (Number.isNaN(due) || due <= now) items.push(item);
  }
  return items.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}

export function getAllSrsItems(): MissedQuestionSrsItem[] {
  return Array.from(readSrsMap().values()).sort(
    (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
  );
}

export function reviewItem(id: string, rating: SrsRating): MissedQuestionSrsItem | null {
  const map = readSrsMap();
  const item = map.get(id);
  if (!item) return null;
  const { days, newEase, newRepetitions } = nextInterval(rating, item.repetitions, item.ease, item.intervalDays);
  const now = new Date();
  const updated: MissedQuestionSrsItem = {
    ...item,
    repetitions: newRepetitions,
    ease: newEase,
    intervalDays: Math.max(0, Math.round(days * 10) / 10),
    lastReviewedAt: now.toISOString(),
    dueAt: addDays(now, days).toISOString(),
  };
  map.set(id, updated);
  writeSrsMap(map);
  return updated;
}

export function removeSrsItem(id: string): void {
  const map = readSrsMap();
  if (map.delete(id)) writeSrsMap(map);
}

export function clearSrsDeck(): void {
  writeSrsMap(new Map());
}

export const SRS_RATING_LABELS: Record<SrsRating, string> = {
  again: 'Again',
  hard: 'Hard',
  good: 'Good',
  easy: 'Easy',
};

/** Human-readable summary of the next interval, e.g. "in 10 min" or "in 3 days". */
export function describeInterval(days: number): string {
  if (days < 1 / 24) return 'in a few minutes';
  if (days < 1) return `in ${Math.round(days * 24 * 60)} minutes`;
  if (days < 2) return 'in 1 day';
  if (days < 14) return `in ${Math.round(days)} days`;
  if (days < 60) return `in ${Math.round(days / 7)} weeks`;
  return `in ${Math.round(days / 30)} months`;
}
