// src/components/study/ConfidenceCalibrationChart.tsx
'use client';

/**
 * Feature #1 - Confidence calibration scatter plot.
 *
 * Pure client-side chart reading existing localInsightsService data.
 * Shows self-rated confidence (x) vs actual correctness (y) so the
 * learner can see whether they are over- or under-confident.
 *
 * No database, no API calls. Data is already in localStorage via
 * localInsightsService.saveConfidenceEntries().
 */
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { getConfidenceLog, type ConfidenceEntry } from '@/lib/services/localInsightsService';

interface Bucket {
  label: string;
  total: number;
  correct: number;
  pct: number;
}

export function ConfidenceCalibrationChart() {
  const [entries, setEntries] = useState<ConfidenceEntry[]>([]);

  useEffect(() => {
    setEntries(getConfidenceLog());
  }, []);

  if (entries.length === 0) return null;

  // Bucket by confidence: 'sure' (high) and 'guessing' (low).
  const sure = entries.filter((e) => e.confidence === 'sure');
  const guessing = entries.filter((e) => e.confidence === 'guessing');

  const buckets: Bucket[] = [
    {
      label: 'Guessing',
      total: guessing.length,
      correct: guessing.filter((e) => e.isCorrect).length,
      pct: guessing.length ? Math.round((guessing.filter((e) => e.isCorrect).length / guessing.length) * 100) : 0,
    },
    {
      label: 'Sure',
      total: sure.length,
      correct: sure.filter((e) => e.isCorrect).length,
      pct: sure.length ? Math.round((sure.filter((e) => e.isCorrect).length / sure.length) * 100) : 0,
    },
  ];

  // Calibration insight text.
  const surePct = buckets[1].pct;
  const guessPct = buckets[0].pct;
  let insight = 'Keep tagging confidence to see your calibration pattern.';
  if (sure.length >= 5 && guessing.length >= 5) {
    if (surePct >= 85) {
      insight = 'Strong calibration: when you feel sure, you are usually right.';
    } else if (surePct < 60) {
      insight = 'Over-confident: many "sure" answers are wrong. Slow down before committing.';
    } else if (guessPct >= 60) {
      insight = 'Under-confident: your guesses are often correct. Trust your instincts more.';
    } else {
      insight = 'Mixed calibration: tag more questions to clarify your pattern.';
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-pulse-600">Confidence calibration</p>
          <h3 className="mt-1 font-display text-lg font-semibold text-ink-900">Are you over- or under-confident?</h3>
        </div>
        <span className="rounded-full bg-ink-50 px-3 py-1 text-[10px] font-semibold text-ink-400">
          {entries.length} tagged
        </span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {buckets.map((b) => (
          <div key={b.label} className="rounded-xl border border-ink-100 bg-ink-50/40 p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-ink-700">{b.label}</span>
              <span className="font-mono text-ink-500">{b.correct}/{b.total} correct</span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-white ring-1 ring-inset ring-ink-100">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  b.label === 'Sure'
                    ? b.pct >= 80 ? 'bg-pulse-500' : b.pct >= 60 ? 'bg-flag-400' : 'bg-critical-400'
                    : 'bg-pulse-400'
                }`}
                style={{ width: `${b.pct}%` }}
              />
            </div>
            <p className="mt-1 text-right font-mono text-xs text-ink-600">{b.pct}%</p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-sm text-ink-600">{insight}</p>
    </Card>
  );
}
