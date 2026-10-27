// File: src/components/study/LocalInsightsPanel.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import {
  computeReadinessScore,
  getConfidenceInsight,
  getMissReasonBreakdown,
  getWeakTopics,
  MISS_REASON_LABELS,
  type ConfidenceInsight,
  type MissReason,
  type WeakTopic,
} from '@/lib/services/localInsightsService';

type Readiness = ReturnType<typeof computeReadinessScore>;
type MissBreakdownEntry = { reason: MissReason; count: number; pct: number };

export function LocalInsightsPanel() {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceInsight | null>(null);
  const [missBreakdown, setMissBreakdown] = useState<MissBreakdownEntry[]>([]);
  const [weakTopics, setWeakTopics] = useState<WeakTopic[]>([]);

  useEffect(() => {
    setReadiness(computeReadinessScore());
    setConfidence(getConfidenceInsight());
    setMissBreakdown(getMissReasonBreakdown());
    setWeakTopics(getWeakTopics());
  }, []);

  if (!readiness) return null;

  const hasData = readiness.components.some((c) => c.value > 0) || missBreakdown.some((m) => m.count > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pulse-600">Local insights</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-ink-900">Your learning patterns</h2>
        </div>
        <span className="rounded-full bg-ink-50 px-3 py-1 text-[10px] font-semibold text-ink-400">
          Device only · no sync
        </span>
      </div>

      {!hasData && (
        <Card className="p-5">
          <p className="text-sm text-ink-500">
            Complete a quiz and tag your missed questions to unlock personalised insights. Everything stays on this device.
          </p>
        </Card>
      )}

      {hasData && (
        <>
          {/* Readiness score ring */}
          <Card className="overflow-hidden p-0">
            <div className="flex flex-col items-center gap-5 p-5 sm:flex-row sm:justify-between sm:p-6">
              <div className="text-center sm:text-left">
                <p className="text-xs font-semibold uppercase tracking-widest text-pulse-600">Readiness score</p>
                <p className="mt-1 font-display text-3xl font-semibold text-ink-900">{readiness.score}%</p>
                <p className="mt-1 max-w-xs text-xs leading-5 text-ink-500">
                  Weighted from your recent quiz scores, flashcard backlog, study consistency, and miss trends.
                </p>
              </div>
              <div
                className={`relative grid h-28 w-28 shrink-0 place-items-center rounded-full ${
                  readiness.score >= 75 ? 'text-pulse-500' : readiness.score >= 50 ? 'text-flag-500' : 'text-critical-400'
                }`}
                style={{
                  background: `conic-gradient(currentColor ${readiness.score}%, #e8eef1 ${readiness.score}% 100%)`,
                  boxShadow: '0 0 0 6px rgba(255,255,255,0.9), 0 8px 20px rgba(15,37,49,0.08)',
                }}
                aria-label={`Readiness ${readiness.score} percent`}
              >
                <div className="grid h-20 w-20 place-items-center rounded-full bg-white shadow-inner">
                  <span className="font-mono text-xl font-semibold text-ink-900">{readiness.score}</span>
                </div>
              </div>
            </div>
            <div className="border-t border-ink-100 bg-ink-50/40 px-5 py-4 sm:px-6">
              <div className="grid gap-2 sm:grid-cols-2">
                {readiness.components.map((c) => (
                  <div key={c.label} className="flex items-start justify-between gap-2 rounded-lg bg-white px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-ink-700">{c.label}</p>
                      <p className="mt-0.5 truncate text-[11px] text-ink-400">{c.detail}</p>
                    </div>
                    <span className="shrink-0 font-mono text-xs font-semibold text-ink-600">
                      {c.value}/{c.max}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Confidence vs reality */}
            {confidence && confidence.sureTotal + confidence.guessingTotal > 0 && (
              <Card className="p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-pulse-600">Confidence vs reality</p>
                <div className="mt-3 space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-ink-700">Sure of it</span>
                      <span className="font-mono text-ink-500">
                        {confidence.sureCorrect}/{confidence.sureTotal} correct
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100">
                      <div
                        className="h-full rounded-full bg-pulse-500"
                        style={{ width: `${confidence.sureTotal ? (confidence.sureCorrect / confidence.sureTotal) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-ink-700">Guessing</span>
                      <span className="font-mono text-ink-500">
                        {confidence.guessingCorrect}/{confidence.guessingTotal} correct
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100">
                      <div
                        className="h-full rounded-full bg-flag-400"
                        style={{ width: `${confidence.guessingTotal ? (confidence.guessingCorrect / confidence.guessingTotal) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
                {confidence.blindSpots.length > 0 && (
                  <div className="mt-4 rounded-lg border border-critical-100 bg-critical-50/50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-critical-600">
                      Blind spots · sure but wrong
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {confidence.blindSpots.slice(0, 3).map((b) => (
                        <li key={`${b.quizId}:${b.questionId}`} className="truncate text-xs text-ink-600">
                          {b.prompt}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            )}

            {/* Miss reason breakdown */}
            {missBreakdown.some((m) => m.count > 0) && (
              <Card className="p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-pulse-600">Why you miss questions</p>
                <div className="mt-3 space-y-2.5">
                  {missBreakdown.filter((m) => m.count > 0).map((m) => (
                    <div key={m.reason}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-ink-700">{MISS_REASON_LABELS[m.reason]}</span>
                        <span className="font-mono text-ink-500">{m.count} · {m.pct}%</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100">
                        <div
                          className="h-full rounded-full bg-amber-400"
                          style={{ width: `${m.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Weak topics */}
          {weakTopics.length > 0 && (
            <Card className="p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-pulse-600">Topics to strengthen</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {weakTopics.map((t) => (
                  <span
                    key={t.topic}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      t.knowledgeGaps > 0
                        ? 'border-critical-200 bg-critical-50 text-critical-700'
                        : 'border-amber-200 bg-amber-50 text-amber-800'
                    }`}
                  >
                    {t.topic} · {t.misses} miss{t.misses === 1 ? '' : 'es'}
                  </span>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
