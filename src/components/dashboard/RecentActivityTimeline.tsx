// src/components/dashboard/RecentActivityTimeline.tsx
'use client';

/**
 * Feature #12 - Unified recent activity timeline.
 *
 * Pure client-side. Aggregates from every existing localStorage store
 * that records user activity into one chronological timeline shown on
 * the dashboard.
 *
 * Hardened: every entry parse is wrapped in try/catch, and any item
 * with an invalid or missing timestamp is silently skipped rather
 * than crashing the dashboard. A single corrupt localStorage entry
 * must never take the whole page down.
 */
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import {
  ATTEMPTED_QUIZZES_KEY,
  COPIED_EXPLANATIONS_KEY,
  TOOLKIT_KEY,
  readJson,
  formatRelativeTime,
} from '@/lib/services/localExtrasService';
import {
  getConfidenceLog,
  getMissReasons,
  getScoreHistory,
} from '@/lib/services/localInsightsService';

type ActivityKind = 'quiz' | 'flashcard' | 'study' | 'confidence' | 'miss-reason' | 'copy' | 'score';

interface ActivityItem {
  kind: ActivityKind;
  at: number; // epoch ms
  title: string;
  detail?: string;
}

interface AttemptedQuizEntry {
  id?: string;
  quizId?: string;
  quizTitle?: string;
  percentage?: number;
  savedAt?: string;
}

interface CopiedExplanation {
  id?: string;
  quizId?: string;
  quizTitle?: string;
  prompt?: string;
  savedAt?: string;
}

interface ToolkitData {
  studyDays?: string[];
  minutesByDay?: Record<string, number>;
}

const KIND_META: Record<ActivityKind, { label: string; color: string; icon: string }> = {
  quiz: { label: 'Quiz attempted', color: 'text-pulse-600 bg-pulse-50', icon: 'V' },
  flashcard: { label: 'Flashcard studied', color: 'text-ink-600 bg-ink-50', icon: 'F' },
  study: { label: 'Study session', color: 'text-pulse-600 bg-pulse-50', icon: 'T' },
  confidence: { label: 'Confidence tagged', color: 'text-flag-700 bg-flag-50', icon: 'C' },
  'miss-reason': { label: 'Miss reason tagged', color: 'text-critical-700 bg-critical-50', icon: '!' },
  copy: { label: 'Explanation copied', color: 'text-ink-600 bg-ink-50', icon: 'S' },
  score: { label: 'Score recorded', color: 'text-pulse-600 bg-pulse-50', icon: '%' },
};

function safeToEpoch(s: string | undefined | null): number {
  if (!s || typeof s !== 'string') return 0;
  try {
    const n = new Date(s).getTime();
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function safeFormat(at: number): string {
  if (!Number.isFinite(at) || at <= 0) return '';
  try {
    return formatRelativeTime(new Date(at).toISOString());
  } catch {
    return '';
  }
}

function safeStr(x: unknown, max = 60): string {
  if (typeof x !== 'string') return '';
  return x.length > max ? x.slice(0, max) : x;
}

export function RecentActivityTimeline() {
  const [items, setItems] = useState<ActivityItem[]>([]);

  useEffect(() => {
    const collected: ActivityItem[] = [];

    // Attempted quizzes
    try {
      const attempted = readJson<AttemptedQuizEntry[]>(ATTEMPTED_QUIZZES_KEY, []);
      if (Array.isArray(attempted)) {
        for (const a of attempted) {
          if (!a) continue;
          collected.push({
            kind: 'quiz',
            at: safeToEpoch(a.savedAt),
            title: a.quizTitle || 'Quiz attempt',
            detail: typeof a.percentage === 'number' && Number.isFinite(a.percentage)
              ? `${Math.round(a.percentage)}%`
              : undefined,
          });
        }
      }
    } catch {
      // Corrupt store - skip silently.
    }

    // Copied explanations
    try {
      const copied = readJson<CopiedExplanation[]>(COPIED_EXPLANATIONS_KEY, []);
      if (Array.isArray(copied)) {
        for (const c of copied) {
          if (!c) continue;
          collected.push({
            kind: 'copy',
            at: safeToEpoch(c.savedAt),
            title: c.quizTitle || 'Explanation copied',
            detail: safeStr(c.prompt) || undefined,
          });
        }
      }
    } catch {
      // Corrupt store - skip silently.
    }

    // Confidence log
    try {
      for (const c of getConfidenceLog()) {
        if (!c) continue;
        collected.push({
          kind: 'confidence',
          at: safeToEpoch(c.savedAt),
          title: c.quizTitle || 'Confidence tagged',
          detail: `${c.confidence || 'unknown'} - ${c.isCorrect ? 'correct' : 'wrong'}`,
        });
      }
    } catch {
      // Corrupt store - skip silently.
    }

    // Miss reason
    try {
      for (const m of getMissReasons()) {
        if (!m) continue;
        collected.push({
          kind: 'miss-reason',
          at: safeToEpoch(m.savedAt),
          title: m.quizTitle || 'Miss reason tagged',
          detail: safeStr(m.prompt) || undefined,
        });
      }
    } catch {
      // Corrupt store - skip silently.
    }

    // Score history
    try {
      for (const s of getScoreHistory()) {
        if (!s) continue;
        collected.push({
          kind: 'score',
          at: safeToEpoch(s.savedAt),
          title: s.quizTitle || 'Score recorded',
          detail:
            typeof s.percentage === 'number' && Number.isFinite(s.percentage)
              ? `${Math.round(s.percentage)}% (${s.correctCount ?? 0}/${s.totalQuestions ?? 0})`
              : undefined,
        });
      }
    } catch {
      // Corrupt store - skip silently.
    }

    // Study days
    try {
      const toolkit = readJson<ToolkitData>(TOOLKIT_KEY, {});
      if (toolkit && Array.isArray(toolkit.studyDays)) {
        for (const day of toolkit.studyDays) {
          if (typeof day !== 'string') continue;
          const mins = (toolkit.minutesByDay && toolkit.minutesByDay[day]) ?? 0;
          collected.push({
            kind: 'study',
            at: safeToEpoch(day + 'T00:00:00'),
            title: 'Study session',
            detail: typeof mins === 'number' && mins > 0 ? `${mins} min` : undefined,
          });
        }
      }
    } catch {
      // Corrupt store - skip silently.
    }

    collected.sort((a, b) => (b.at || 0) - (a.at || 0));
    setItems(collected.slice(0, 12));
  }, []);

  if (items.length === 0) return null;

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-pulse-600">Recent activity</p>
          <h3 className="mt-1 font-display text-lg font-semibold text-ink-900">Your last 12 actions across the platform</h3>
        </div>
        <span className="rounded-full bg-ink-50 px-3 py-1 text-[10px] font-semibold text-ink-400">Device only</span>
      </div>

      <ol className="mt-4 space-y-2">
        {items.map((item, i) => {
          const meta = KIND_META[item.kind];
          return (
            <li key={i} className="flex items-start gap-3 rounded-lg border border-ink-100 bg-white px-3 py-2">
              <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${meta.color}`}>
                {meta.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-800">{item.title}</p>
                {item.detail && <p className="truncate text-xs text-ink-500">{item.detail}</p>}
              </div>
              <span className="shrink-0 text-[10px] text-ink-400">
                {safeFormat(item.at)}
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
