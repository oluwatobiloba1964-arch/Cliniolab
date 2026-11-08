// File: src/components/dashboard/WeakSpotTrainerCard.tsx
// Dashboard card that surfaces the learner's weakest topics based on
// locally captured miss reasons. Pure client-side: no fetch, no API
// call, no database read. Renders nothing on a fresh device.

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Target } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import {
  getWeakSpotSummary,
  type WeakSpotSummary,
} from '@/lib/services/weakSpotTrainerService';

const SEVERITY_BADGE: Record<'high' | 'medium' | 'low', string> = {
  high: 'bg-critical-100 text-critical-700',
  medium: 'bg-flag-100 text-flag-700',
  low: 'bg-ink-100 text-ink-600',
};

export function WeakSpotTrainerCard() {
  const [summary, setSummary] = useState<WeakSpotSummary | null>(null);

  useEffect(() => {
    setSummary(getWeakSpotSummary());
  }, []);

  if (!summary || summary.totalMisses === 0 || !summary.topSpot) return null;

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pulse-600">Weak spot trainer</p>
            <h3 className="mt-1 font-display text-lg font-semibold text-ink-900">Where you keep missing questions</h3>
            <p className="mt-1 text-sm text-ink-500">
              Based on {summary.totalMisses} miss{summary.totalMisses === 1 ? '' : 'es'} you have logged. Focus on the top topic first.
            </p>
          </div>
          <span className="rounded-full bg-ink-50 px-3 py-1 text-[10px] font-semibold text-ink-400">
            Device only · no sync
          </span>
        </div>

        <div className="rounded-2xl border border-pulse-100 bg-gradient-to-br from-pulse-50/60 to-white p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pulse-600 text-white">
              <Target className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-pulse-600">Top weak spot</p>
              <p className="mt-0.5 font-display text-base font-semibold text-ink-900">{summary.topSpot.topic}</p>
              <p className="mt-0.5 text-xs text-ink-500">
                {summary.topSpot.totalMisses} miss{summary.topSpot.totalMisses === 1 ? '' : 'es'} across recent attempts
              </p>
            </div>
          </div>
          <Link
            href={`/search?q=${encodeURIComponent(summary.topSpot.topic)}`}
            className="mt-3.5 inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-800"
          >
            Practise this topic
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>

        {summary.recommendations.length > 1 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-400">Other weak spots</p>
            <ul className="mt-2 space-y-2">
              {summary.recommendations.slice(1).map((rec) => (
                <li key={rec.topic}>
                  <Link
                    href={rec.href}
                    className="flex items-start justify-between gap-3 rounded-xl border border-ink-100 bg-white p-3 transition hover:border-pulse-200 hover:bg-pulse-50/40"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-ink-800">{rec.topic}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${SEVERITY_BADGE[rec.severity]}`}>
                          {rec.severity}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs leading-5 text-ink-500">{rec.detail}</p>
                    </div>
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
