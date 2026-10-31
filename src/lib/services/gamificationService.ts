// File: src/lib/services/gamificationService.ts
// Browser-only gamification. This service deliberately never calls fetch,
// APIs, or the database. XP, levels, streaks and badges are derived from
// storage keys already written by the quiz runner, the study toolkit and
// the flashcard runner.
//
// Design notes:
// - Quiz XP is event based and deduped, so a quiz can never pay out twice.
// - Study and flashcard XP use a high-water mark, so deleting old local
//   data can never make total XP go down.
// - Badges are computed from data and their first unlock time is recorded
//   once, so "newly unlocked" detection is stable across sessions.

import { readLocalStudy } from '@/lib/services/localStudyService';
import { getScoreHistory } from '@/lib/services/localInsightsService';

export const GAMIFICATION_KEY = 'cliniolab_gamification_v1';

type GamificationStore = {
  xpEvents?: XpEvent[];
  badgeUnlocks?: Record<string, string>;
  studyXpWatermark?: number;
  flashcardXpWatermark?: number;
};

export type XpEvent = {
  id: string;
  xp: number;
  at: string;
};

export type LevelInfo = {
  level: number;
  name: string;
  totalXp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  isMaxLevel: boolean;
};

export type BadgeDefinition = {
  id: string;
  title: string;
  description: string;
  icon: string;
  target: number;
  current: number;
  unlocked: boolean;
  unlockedAt: string | null;
};

export type StreakInfo = {
  current: number;
  longest: number;
  activeToday: boolean;
};

export type GamificationState = {
  totalXp: number;
  level: LevelInfo;
  streak: StreakInfo;
  badges: BadgeDefinition[];
  quizCount: number;
  flashcardReviewCount: number;
  studyMinutes: number;
};

export type QuizXpAward = {
  xpEarned: number;
  totalXp: number;
  level: LevelInfo;
  leveledUp: boolean;
  previousLevel: number;
  newBadges: BadgeDefinition[];
};

// ---------- Levels ----------
// Cumulative thresholds follow a gentle quadratic curve:
// level n unlocks at 50 * n * (n - 1) XP. Level 2 at 100, level 3 at 300,
// level 4 at 600, level 5 at 1000 and so on.

export const LEVEL_NAMES: Record<number, string> = {
  1: 'Beginner',
  2: 'Learner',
  3: 'Explorer',
  4: 'Practitioner',
  5: 'Achiever',
  6: 'Specialist',
  7: 'Expert',
  8: 'Exam Ready',
  9: 'Top Candidate',
  10: 'Legend',
};

export const MAX_LEVEL = 10;

export function levelThreshold(level: number): number {
  return 50 * level * (level - 1);
}

export function computeLevel(totalXp: number): LevelInfo {
  let level = 1;
  while (level < MAX_LEVEL && totalXp >= levelThreshold(level + 1)) {
    level += 1;
  }
  const floor = levelThreshold(level);
  const ceiling = level < MAX_LEVEL ? levelThreshold(level + 1) : floor;
  return {
    level,
    name: LEVEL_NAMES[level] ?? `Level ${level}`,
    totalXp,
    xpIntoLevel: Math.max(0, totalXp - floor),
    xpForNextLevel: level < MAX_LEVEL ? ceiling - floor : 0,
    isMaxLevel: level >= MAX_LEVEL,
  };
}

// ---------- Store helpers ----------

function readStore(): GamificationStore {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(GAMIFICATION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as GamificationStore;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: GamificationStore): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(GAMIFICATION_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

// ---------- XP sources ----------

function readQuizXp(store: GamificationStore): number {
  const events = Array.isArray(store.xpEvents) ? store.xpEvents : [];
  return events.reduce((sum, event) => sum + (typeof event.xp === 'number' ? event.xp : 0), 0);
}

/** Total focus minutes recorded by the study toolkit timer. */
function readStudyMinutes(): number {
  const toolkit = readLocalStudy<{ minutesByDay?: Record<string, number> }>();
  const minutesByDay = toolkit.minutesByDay ?? {};
  return Object.values(minutesByDay).reduce((sum, value) => sum + (typeof value === 'number' ? value : 0), 0);
}

/** Completed study tasks across all days, from the study toolkit. */
function readCompletedTaskCount(): number {
  const toolkit = readLocalStudy<{ tasks?: { done?: boolean }[] }>();
  const tasks = Array.isArray(toolkit.tasks) ? toolkit.tasks : [];
  return tasks.filter((task) => task && task.done).length;
}

/**
 * Counts flashcard reviews recorded by the flashcard runner across all
 * spaced repetition schedules. Each schedule entry carries a reviewedAt
 * timestamp, so this works without any new tracking keys.
 */
export function countFlashcardReviews(): number {
  if (typeof window === 'undefined') return 0;
  let reviews = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('cliniolab:spaced-repetition:')) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const schedule = JSON.parse(raw) as Record<string, { reviewedAt?: string }>;
      for (const entry of Object.values(schedule)) {
        if (entry && typeof entry.reviewedAt === 'string' && entry.reviewedAt) reviews += 1;
      }
    }
  } catch {
    // Flashcard data is optional for XP; ignore unreadable entries.
  }
  return reviews;
}

/**
 * Recomputes the study and flashcard high-water marks. XP from these
 * sources only ever rises: if local data is cleared, previously earned
 * XP stays. Returns the store to persist.
 */
function refreshWatermarks(store: GamificationStore): GamificationStore {
  const studyXp = Math.floor(readStudyMinutes() / 5); // 1 XP per 5 focus minutes
  const flashcardXp = Math.floor(countFlashcardReviews() / 2); // 1 XP per 2 reviews
  return {
    ...store,
    studyXpWatermark: Math.max(store.studyXpWatermark ?? 0, studyXp),
    flashcardXpWatermark: Math.max(store.flashcardXpWatermark ?? 0, flashcardXp),
  };
}

/**
 * Awards XP for one completed quiz attempt. Deduped by attempt key so
 * repeats, retakes or re-renders never double pay. Also refreshes the
 * study and flashcard watermarks and evaluates badges. Returns what the
 * results screen should celebrate, or null when nothing changed.
 */
export function awardQuizXp(params: {
  attemptKey: string;
  correctCount: number;
  totalQuestions: number;
  percentage: number;
}): QuizXpAward | null {
  if (typeof window === 'undefined') return null;
  const store = readStore();
  const events = Array.isArray(store.xpEvents) ? store.xpEvents : [];
  const alreadyAwarded = events.some((event) => event.id === params.attemptKey);
  const beforeLevel = computeLevel(
    readQuizXp(store) + (store.studyXpWatermark ?? 0) + (store.flashcardXpWatermark ?? 0),
  ).level;

  // Base 10 XP for finishing, 2 XP per correct answer, plus a bonus for
  // strong performances. Kept small so levels feel earned, not given.
  const xpForAttempt =
    10 +
    params.correctCount * 2 +
    (params.totalQuestions > 0 && params.correctCount === params.totalQuestions
      ? 35 // perfect round bonus
      : params.percentage >= 80
        ? 20
        : 0);

  let nextStore: GamificationStore = store;
  if (!alreadyAwarded) {
    nextStore = {
      ...store,
      xpEvents: [
        ...events,
        { id: params.attemptKey, xp: xpForAttempt, at: new Date().toISOString() },
      ].slice(-500),
    };
  }

  nextStore = refreshWatermarks(nextStore);

  const badgesBefore = new Set(Object.keys(nextStore.badgeUnlocks ?? {}));
  const { badges, anyNew } = evaluateAndRecordBadges(nextStore);
  nextStore = { ...nextStore, badgeUnlocks: badges };

  const persisted = writeStore(nextStore);
  if (!persisted && !alreadyAwarded && !anyNew) return null;

  const totalXp =
    readQuizXp(nextStore) + (nextStore.studyXpWatermark ?? 0) + (nextStore.flashcardXpWatermark ?? 0);
  const level = computeLevel(totalXp);
  const newBadges = anyNew
    ? buildBadgeDefinitions(totalXp)
        .filter((badge) => badges[badge.id] && !badgesBefore.has(badge.id))
        .map((badge) => ({ ...badge, unlocked: true }))
    : [];

  return {
    xpEarned: alreadyAwarded ? 0 : xpForAttempt,
    totalXp,
    level,
    leveledUp: level.level > beforeLevel,
    previousLevel: beforeLevel,
    newBadges,
  };
}

// ---------- Streaks ----------
// A day counts as active when any of these happened: a quiz attempt was
// scored, the focus timer recorded minutes, or a flashcard was reviewed.
// All three signals already exist in local storage.

function dayKey(date: Date): string {
  return date.toLocaleDateString('en-CA');
}

function collectActiveDays(): Set<string> {
  const days = new Set<string>();

  for (const entry of getScoreHistory()) {
    if (entry.savedAt) days.add(dayKey(new Date(entry.savedAt)));
  }

  const toolkit = readLocalStudy<{
    studyDays?: string[];
    minutesByDay?: Record<string, number>;
  }>();
  for (const day of toolkit.studyDays ?? []) {
    if (day) days.add(day);
  }
  for (const [day, minutes] of Object.entries(toolkit.minutesByDay ?? {})) {
    if (typeof minutes === 'number' && minutes > 0) days.add(day);
  }

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('cliniolab:spaced-repetition:')) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const schedule = JSON.parse(raw) as Record<string, { reviewedAt?: string }>;
      for (const entry of Object.values(schedule)) {
        if (entry?.reviewedAt) days.add(dayKey(new Date(entry.reviewedAt)));
      }
    }
  } catch {
    // Optional signal; ignore unreadable schedules.
  }

  return days;
}

export function computeStreak(): StreakInfo {
  const days = collectActiveDays();
  if (days.size === 0) return { current: 0, longest: 0, activeToday: false };

  const today = new Date();
  const activeToday = days.has(dayKey(today));

  let current = 0;
  const cursor = new Date(today);
  if (!activeToday) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dayKey(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const sorted = Array.from(days).sort();
  let longest = 0;
  let run = 0;
  let previous: Date | null = null;
  for (const key of sorted) {
    const day = new Date(`${key}T00:00:00`);
    if (previous) {
      const diff = Math.round((day.getTime() - previous.getTime()) / 86_400_000);
      run = diff === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    previous = day;
  }

  return { current, longest: Math.max(longest, current), activeToday };
}

// ---------- Badges ----------

function buildBadgeDefinitions(totalXp: number): BadgeDefinition[] {
  const history = getScoreHistory();
  const quizCount = history.length;
  const bestScore = history.reduce((best, entry) => Math.max(best, entry.percentage), 0);
  const highScoreRounds = history.filter((entry) => entry.percentage >= 80).length;
  const flashcardReviews = countFlashcardReviews();
  const studyMinutes = readStudyMinutes();
  const completedTasks = readCompletedTaskCount();
  const streak = computeStreak();

  const unlockMap = readStore().badgeUnlocks ?? {};
  const raw: Omit<BadgeDefinition, 'unlocked' | 'unlockedAt'>[] = [
    { id: 'first-quiz', title: 'First Steps', description: 'Finish your first quiz', icon: 'footprints', target: 1, current: quizCount },
    { id: 'ten-quizzes', title: 'Getting Serious', description: 'Finish 10 quizzes', icon: 'book-open', target: 10, current: quizCount },
    { id: 'fifty-quizzes', title: 'Marathon Mind', description: 'Finish 50 quizzes', icon: 'brain', target: 50, current: quizCount },
    { id: 'perfect-score', title: 'Flawless Round', description: 'Score 100% on any quiz', icon: 'target', target: 1, current: bestScore >= 100 ? 1 : 0 },
    { id: 'high-achiever', title: 'High Achiever', description: 'Score 80% or more, 5 times', icon: 'award', target: 5, current: highScoreRounds },
    { id: 'streak-7', title: 'Consistent', description: 'Study or quiz 7 days in a row', icon: 'flame', target: 7, current: streak.longest },
    { id: 'streak-30', title: 'Unstoppable', description: 'Study or quiz 30 days in a row', icon: 'zap', target: 30, current: streak.longest },
    { id: 'flashcards-50', title: 'Card Cracker', description: 'Review 50 flashcards', icon: 'layers', target: 50, current: flashcardReviews },
    { id: 'flashcards-250', title: 'Flash Master', description: 'Review 250 flashcards', icon: 'sparkles', target: 250, current: flashcardReviews },
    { id: 'focus-5h', title: 'Deep Focus', description: 'Log 5 hours of focus time', icon: 'clock', target: 300, current: Math.floor(studyMinutes) },
    { id: 'goals-10', title: 'Goal Crusher', description: 'Complete 10 study tasks', icon: 'check-check', target: 10, current: completedTasks },
    { id: 'xp-1000', title: 'Rising Star', description: 'Earn 1000 total XP', icon: 'trophy', target: 1000, current: totalXp },
  ];

  return raw.map((badge) => {
    const unlocked = badge.current >= badge.target;
    return {
      ...badge,
      current: Math.min(badge.current, badge.target),
      unlocked,
      unlockedAt: unlocked ? (unlockMap[badge.id] ?? null) : null,
    };
  });
}

/**
 * Evaluates badges and returns the badgeUnlocks map plus whether any new
 * badge was unlocked during this call. Unlock times are recorded once so
 * they never flicker or reset.
 */
function evaluateAndRecordBadges(store: GamificationStore): {
  badges: Record<string, string>;
  anyNew: boolean;
} {
  const existing = store.badgeUnlocks ?? {};
  const totalXp =
    readQuizXp(store) + (store.studyXpWatermark ?? 0) + (store.flashcardXpWatermark ?? 0);
  const definitions = buildBadgeDefinitions(totalXp);
  const next = { ...existing };
  let anyNew = false;
  for (const badge of definitions) {
    if (badge.unlocked && !next[badge.id]) {
      next[badge.id] = new Date().toISOString();
      anyNew = true;
    }
  }
  return { badges: next, anyNew };
}

/** Badge and XP state for the dashboard panel. Also refreshes unlock records. */
export function getGamificationState(): GamificationState | null {
  if (typeof window === 'undefined') return null;
  const store = refreshWatermarks(readStore());
  const { badges: unlockMap } = evaluateAndRecordBadges(store);

  const totalXp =
    readQuizXp(store) + (store.studyXpWatermark ?? 0) + (store.flashcardXpWatermark ?? 0);
  const activeDays = collectActiveDays().size;
  if (totalXp <= 0 && activeDays === 0) return null;

  // Persist refreshed watermarks and any first-time badge unlocks so the
  // celebration state stays stable across sessions.
  writeStore({ ...store, badgeUnlocks: unlockMap });

  return {
    totalXp,
    level: computeLevel(totalXp),
    streak: computeStreak(),
    badges: buildBadgeDefinitions(totalXp),
    quizCount: getScoreHistory().length,
    flashcardReviewCount: countFlashcardReviews(),
    studyMinutes: readStudyMinutes(),
  };
}
