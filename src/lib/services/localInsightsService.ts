// File: src/lib/services/localInsightsService.ts
// Browser-only learning insights. This service deliberately never calls fetch,
// APIs, or the database. It reads and writes only keys already used by the
// local study toolkit, quiz runner, and flashcard runner.

import { readLocalStudy, readLocalArray, saveLocalArray } from '@/lib/services/localStudyService';

export const MISS_REASONS_KEY = 'missReasons'; // inside toolkit record
export const CONFIDENCE_LOG_KEY = 'confidenceLog'; // inside toolkit record
export const SCORE_HISTORY_KEY = 'scoreHistory'; // inside toolkit record

export type MissReason = 'knowledge-gap' | 'misread-question' | 'guessed' | 'careless';

export const MISS_REASONS: MissReason[] = ['knowledge-gap', 'misread-question', 'guessed', 'careless'];

export const MISS_REASON_LABELS: Record<MissReason, string> = {
  'knowledge-gap': 'Knowledge gap',
  'misread-question': 'Misread the question',
  'guessed': 'I guessed',
  'careless': 'Careless error',
};

export type MissReasonEntry = {
  questionId: string;
  quizId: string;
  quizTitle: string;
  prompt: string;
  reason: MissReason;
  savedAt: string;
};

export type ConfidenceEntry = {
  questionId: string;
  quizId: string;
  quizTitle: string;
  prompt: string;
  confidence: 'sure' | 'guessing';
  isCorrect: boolean;
  savedAt: string;
};

export type ScoreEntry = {
  quizId: string;
  quizTitle: string;
  percentage: number;
  totalQuestions: number;
  correctCount: number;
  savedAt: string;
};

// ---------- Miss reasons ----------

export function getMissReasons(): MissReasonEntry[] {
  return readLocalArray<MissReasonEntry>(MISS_REASONS_KEY);
}

export function saveMissReason(entry: MissReasonEntry): boolean {
  const existing = getMissReasons();
  // Replace if same question+quiz already tagged, else prepend, cap at 200.
  const filtered = existing.filter((e) => !(e.questionId === entry.questionId && e.quizId === entry.quizId));
  return saveLocalArray(MISS_REASONS_KEY, [entry, ...filtered].slice(0, 200));
}

export function getMissReasonBreakdown(): { reason: MissReason; count: number; pct: number }[] {
  const entries = getMissReasons();
  const total = entries.length;
  const counts: Record<MissReason, number> = {
    'knowledge-gap': 0,
    'misread-question': 0,
    'guessed': 0,
    'careless': 0,
  };
  for (const e of entries) counts[e.reason] = (counts[e.reason] ?? 0) + 1;
  return MISS_REASONS.map((reason) => ({
    reason,
    count: counts[reason],
    pct: total ? Math.round((counts[reason] / total) * 100) : 0,
  }));
}

// ---------- Confidence vs reality ----------

export function getConfidenceLog(): ConfidenceEntry[] {
  return readLocalArray<ConfidenceEntry>(CONFIDENCE_LOG_KEY);
}

export function saveConfidenceEntries(entries: ConfidenceEntry[]): boolean {
  const existing = getConfidenceLog();
  // Merge by questionId+quizId, keep newest, cap at 300.
  const map = new Map<string, ConfidenceEntry>();
  for (const e of [...entries, ...existing]) {
    map.set(`${e.quizId}:${e.questionId}`, e);
  }
  return saveLocalArray(CONFIDENCE_LOG_KEY, Array.from(map.values()).slice(0, 300));
}

export type ConfidenceInsight = {
  sureTotal: number;
  sureCorrect: number;
  sureWrong: number;
  guessingTotal: number;
  guessingCorrect: number;
  guessingWrong: number;
  blindSpots: ConfidenceEntry[]; // sure but wrong
};

export function getConfidenceInsight(): ConfidenceInsight {
  const log = getConfidenceLog();
  const sure = log.filter((e) => e.confidence === 'sure');
  const guessing = log.filter((e) => e.confidence === 'guessing');
  const blindSpots = sure.filter((e) => !e.isCorrect).slice(0, 10);
  return {
    sureTotal: sure.length,
    sureCorrect: sure.filter((e) => e.isCorrect).length,
    sureWrong: sure.filter((e) => !e.isCorrect).length,
    guessingTotal: guessing.length,
    guessingCorrect: guessing.filter((e) => e.isCorrect).length,
    guessingWrong: guessing.filter((e) => !e.isCorrect).length,
    blindSpots,
  };
}

// ---------- Score history / readiness ----------

export function getScoreHistory(): ScoreEntry[] {
  return readLocalArray<ScoreEntry>(SCORE_HISTORY_KEY);
}

export function saveScore(entry: ScoreEntry): boolean {
  const existing = getScoreHistory();
  const filtered = existing.filter((e) => e.quizId !== entry.quizId || e.savedAt !== entry.savedAt);
  return saveLocalArray(SCORE_HISTORY_KEY, [entry, ...filtered].slice(0, 100));
}

/**
 * Scans all local spaced repetition schedules and counts how many cards
 * are currently due for review. Shared by the readiness score and the
 * gamification panel. Read-only; never writes to storage.
 */
export function countDueFlashcards(): { due: number; total: number } {
  let dueCards = 0;
  let totalCards = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('cliniolab:spaced-repetition:')) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const schedule = JSON.parse(raw) as Record<string, { dueAt?: string }>;
      const values = Object.values(schedule);
      totalCards += values.length;
      dueCards += values.filter((v) => !v.dueAt || new Date(v.dueAt).getTime() <= Date.now()).length;
    }
  } catch {
    // ignore - flashcard scheduling data is optional for this count
  }
  return { due: dueCards, total: totalCards };
}

/**
 * Transparent weighted readiness score, 0-100.
 * - Recent quiz performance (last 10 attempts): 50%
 * - Flashcard due backlog (spaced repetition keys): 20%
 * - Study streak consistency (minutesByDay from toolkit): 20%
 * - Miss-reason trend (fewer knowledge-gap = better): 10%
 */
export function computeReadinessScore(): {
  score: number;
  components: { label: string; value: number; max: number; detail: string }[];
} {
  const history = getScoreHistory().slice(0, 10);
  const toolkit = readLocalStudy<{
    minutesByDay?: Record<string, number>;
    tasks?: { done?: boolean }[];
  }>();
  const missBreakdown = getMissReasonBreakdown();
  const totalMisses = missBreakdown.reduce((sum, m) => sum + m.count, 0);
  const knowledgeGapPct = totalMisses ? (missBreakdown.find((m) => m.reason === 'knowledge-gap')?.count ?? 0) / totalMisses : 0;

  // Component 1: quiz performance
  const avgScore = history.length
    ? history.reduce((sum, h) => sum + h.percentage, 0) / history.length
    : 0;
  const quizComponent = Math.round(avgScore * 0.5);

  // Component 2: flashcard backlog
  const { due: dueCards, total: totalCards } = countDueFlashcards();
  const backlogRatio = totalCards ? dueCards / totalCards : 0;
  const flashcardComponent = Math.round((1 - backlogRatio) * 20);

  // Component 3: streak consistency (days studied in last 14 days)
  const minutesByDay = toolkit.minutesByDay ?? {};
  const today = new Date();
  let activeDays = 0;
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString('en-CA');
    if ((minutesByDay[key] ?? 0) > 0) activeDays++;
  }
  const streakComponent = Math.round((activeDays / 14) * 20);

  // Component 4: miss-reason trend
  const missComponent = Math.round((1 - knowledgeGapPct) * 10);

  const score = Math.min(100, quizComponent + flashcardComponent + streakComponent + missComponent);

  return {
    score,
    components: [
      {
        label: 'Quiz performance',
        value: quizComponent,
        max: 50,
        detail: history.length
          ? `Avg ${Math.round(avgScore)}% over last ${history.length} attempt${history.length === 1 ? '' : 's'}`
          : 'No attempts yet',
      },
      {
        label: 'Flashcard backlog',
        value: flashcardComponent,
        max: 20,
        detail: totalCards ? `${dueCards} of ${totalCards} cards due` : 'No flashcards scheduled',
      },
      {
        label: 'Study consistency',
        value: streakComponent,
        max: 20,
        detail: `${activeDays} of last 14 days active`,
      },
      {
        label: 'Miss trend',
        value: missComponent,
        max: 10,
        detail: totalMisses ? `${Math.round((1 - knowledgeGapPct) * 100)}% non-knowledge-gap misses` : 'No misses tagged yet',
      },
    ],
  };
}

// ---------- Weak topics ----------
// Aggregates miss reasons by quiz title (quiz titles already carry topic names
// like "Pharmacology Quiz"). Uses only local data.

export type WeakTopic = { topic: string; misses: number; knowledgeGaps: number };

export function getWeakTopics(): WeakTopic[] {
  const entries = getMissReasons();
  const map = new Map<string, WeakTopic>();
  for (const e of entries) {
    const topic = e.quizTitle.replace(/\s*(quiz|exam|test|practice)\s*$/i, '').trim() || e.quizTitle;
    const current = map.get(topic) ?? { topic, misses: 0, knowledgeGaps: 0 };
    current.misses += 1;
    if (e.reason === 'knowledge-gap') current.knowledgeGaps += 1;
    map.set(topic, current);
  }
  return Array.from(map.values()).sort((a, b) => b.misses - a.misses).slice(0, 8);
}
