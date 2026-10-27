// src/components/dashboard/RecentActivityTimeline.tsx
'use client';

/**
 * Feature #12 - Unified recent activity timeline.
 *
 * Pure client-side. Aggregates from every existing localStorage store
 * that records user activity (attempted quizzes, copied explanations,
 * study toolkit days, flashcard notes, miss-reason tags, confidence
 * tags) into one chronological timeline shown on the dashboard.
 *
 * No database, no API calls. Pure read of existing browser state.
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
  id: string;
  quizId: string;
  quizTitle: string;
  percentage?: number;
  savedAt: string;
}

interface CopiedExplanation {
  id: string;
  quizId: string;
  quizTitle: string;
  prompt: string;
  savedAt: string;
}

interface ToolkitData {
  studyDays?: string[];
  minutesByDay?: Record<string, number>;
}

const KIND_META: Record<ActivityKind, { label: string; color: string; icon: string }> = {
  quiz: { label: 'Quiz attempted', color: 'text-pulse-600 bg-pulse-50', icon: '✓' },
  flashcard: { label: 'Flashcard studied', color: 'text-ink-600 bg-ink-50', icon: 'cards' },
  study: { label: 'Study session', color: 'text-pulse-600 bg-pulse-50', icon: '⏱' },
  confidence: { label: 'Confidence tagged', color: 'text-flag-700 bg-flag-50', icon: '◐' },
  'miss-reason': { label: 'Miss reason tagged', color: 'text-critical-700 bg-critical-50', icon: '!' },
  copy: { label: 'Explanation copied', color: 'text-ink-600 bg-ink-50', icon: '⧉' },
  score: { label: 'Score recorded', color: 'text-pulse-600 bg-pulse-50', icon: '%' },
};

function toEpoch(s: string | undefined): number {
  if (!s) return 0;
  const n = new Date(s).getTime();
  return Number.isFinite(n) ? n : 0;
}

export function RecentActivityTimeline() {
  const [items, setItems] = useState<ActivityItem[]>([]);

  useEffect(() => {
    const collected: ActivityItem[] = [];

    // Attempted quizzes
    const attempted = readJson<AttemptedQuizEntry[]>(ATTEMPTED_QUIZZES_KEY, []);
    for (const a of attempted) {
      collected.push({
        kind: 'quiz',
        at: toEpoch(a.savedAt),
        title: a.quizTitle || 'Quiz attempt',
        detail: typeof a.percentage === 'number' ? `${Math.round(a.percentage)}%` : undefined,
      });
    }

    // Copied explanations
    const copied = readJson<CopiedExplanation[]>(COPIED_EXPLANATIONS_KEY, []);
    for (const c of copied) {
      collected.push({
        kind: 'copy',
        at: toEpoch(c.savedAt),
        title: c.quizTitle || 'Explanation copied',
        detail: c.prompt?.slice(0, 60) || undefined,
      });
    }

    // Confidence log
    for (const c of getConfidenceLog()) {
      collected.push({
        kind: 'confidence',
        at: toEpoch(c.savedAt),
        title: c.quizTitle || 'Confidence tagged',
        detail: `${c.confidence} · ${c.isCorrect ? 'correct' : 'wrong'}`,
      });
    }

    // Miss reasons
    for (const m of getMissReasons()) {
      collected.push({
        kind: 'miss-reason',
        at: toEpoch(m.savedAt),
        title: m.quizTitle || 'Miss reason tagged',
        detail: m.prompt?.slice(0, 60) || undefined,
      });
    }

    // Score history
    for (const s of getScoreHistory()) {
      collected.push({
        kind: 'score',
        at: toEpoch(s.savedAt),
        title: s.quizTitle || 'Score recorded',
        detail: `${Math.round(s.percentage)}% (${s.correctCount}/${s.totalQuestions})`,
      });
    }

    // Study days
    const toolkit = readJson<ToolkitData>(TOOLKIT_KEY, {});
    if (toolkit.studyDays) {
      for (const day of toolkit.studyDays) {
        const mins = toolkit.minutesByDay?.[day] ?? 0;
        collected.push({
          kind: 'study',
          at: new Date(day + 'T00:00:00').getTime(),
          title: 'Study session',
          detail: mins > 0 ? `${mins} min` : undefined,
        });
      }
    }

    collected.sort((a, b) => b.at - a.at);
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
                {item.at > 0 ? formatRelativeTime(new Date(item.at).toISOString()) : ''}
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
