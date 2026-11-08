// File: src/lib/services/weakSpotTrainerService.ts
// Browser-only "weak spot" trainer. Pure client-side: no fetch, no API
// call, no database read. Aggregates the existing miss-reason data
// (already saved by QuizRunner) into prioritised topic buckets and
// surfaces recommended next steps for each weak topic.

import {
  getMissReasons,
  type MissReason,
  type MissReasonEntry,
} from '@/lib/services/localInsightsService';

export type WeakSpot = {
  topic: string;
  totalMisses: number;
  byReason: Record<MissReason, number>;
  /** Prompt snippet of the most recent miss in this topic, used as a refresher. */
  recentPrompt: string | null;
  /** ISO timestamp of the most recent miss in this topic. */
  lastMissedAt: string | null;
};

export type WeakSpotRecommendation = {
  topic: string;
  /** Free-text suggestion, e.g. "Review 3 questions you keep missing on Pharmacology". */
  detail: string;
  /** Suggested deep link into existing UI (search results page filtered for the topic). */
  href: string;
  severity: 'high' | 'medium' | 'low';
};

const REASON_TO_HINT: Record<MissReason, string> = {
  'knowledge-gap': 'Knowledge gaps need a re-read of the underlying concept before drilling more questions.',
  'misread-question': 'Misread questions suggest slowing down and underlining key stems before answering.',
  'guessed': 'Frequent guessing means the topic is still unfamiliar — start with a short reading pass.',
  'careless': 'Careless errors often shrink when you double-check the option you pick against the stem.',
};

function normaliseTopic(raw: string): string {
  return raw
    .replace(/\s*(quiz|exam|test|practice|cbt)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getWeakSpots(limit = 5): WeakSpot[] {
  const entries = getMissReasons();
  const map = new Map<string, WeakSpot>();
  for (const entry of entries) {
    const topic = normaliseTopic(entry.quizTitle) || entry.quizTitle;
    const existing = map.get(topic);
    if (!existing) {
      map.set(topic, {
        topic,
        totalMisses: 1,
        byReason: {
          'knowledge-gap': entry.reason === 'knowledge-gap' ? 1 : 0,
          'misread-question': entry.reason === 'misread-question' ? 1 : 0,
          'guessed': entry.reason === 'guessed' ? 1 : 0,
          'careless': entry.reason === 'careless' ? 1 : 0,
        },
        recentPrompt: entry.prompt,
        lastMissedAt: entry.savedAt,
      });
    } else {
      existing.totalMisses += 1;
      existing.byReason[entry.reason] += 1;
      // Keep the most recent prompt and timestamp.
      if (!existing.lastMissedAt || entry.savedAt > existing.lastMissedAt) {
        existing.lastMissedAt = entry.savedAt;
        existing.recentPrompt = entry.prompt;
      }
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.totalMisses - a.totalMisses)
    .slice(0, limit);
}

export function recommendForWeakSpot(spot: WeakSpot): WeakSpotRecommendation {
  // Find the dominant miss reason.
  const reasons: MissReason[] = ['knowledge-gap', 'guessed', 'misread-question', 'careless'];
  const dominant = reasons.reduce((top, r) => (spot.byReason[r] > (top ? spot.byReason[top] : 0) ? r : top), reasons[0]);
  const severity: WeakSpotRecommendation['severity'] =
    spot.totalMisses >= 5 ? 'high' : spot.totalMisses >= 3 ? 'medium' : 'low';
  return {
    topic: spot.topic,
    detail: REASON_TO_HINT[dominant],
    href: `/search?q=${encodeURIComponent(spot.topic)}`,
    severity,
  };
}

export type WeakSpotSummary = {
  totalMisses: number;
  topSpot: WeakSpot | null;
  recommendations: WeakSpotRecommendation[];
};

export function getWeakSpotSummary(): WeakSpotSummary {
  const spots = getWeakSpots();
  const total = spots.reduce((sum, s) => sum + s.totalMisses, 0);
  return {
    totalMisses: total,
    topSpot: spots[0] ?? null,
    recommendations: spots.slice(0, 3).map(recommendForWeakSpot),
  };
}

/** Convenience helper for callers that just want the raw entries. */
export function getRecentMisses(limit = 8): MissReasonEntry[] {
  return getMissReasons().slice(0, limit);
}
