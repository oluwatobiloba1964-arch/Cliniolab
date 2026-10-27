// src/components/home/DailyClinicalPearl.tsx
'use client';

/**
 * Feature #17 - Daily clinical pearl on the homepage.
 *
 * Renders today's pearl from the bundled 365-pearl collection. Pure
 * client-side - no DB, no API, no fetch. A returning visitor sees a
 * new pearl every day, and every visitor on the same day sees the same
 * pearl.
 *
 * The "Save" button stores the pearl in localStorage so the user can
 * build a personal collection; syncs to their account when they sign in.
 */
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { getDailyPearl, getTomorrowPearl, PEARL_COUNT } from '@/lib/constants/clinicalPearls';
import { FEATURE_KEYS, readLocal, writeLocal } from '@/lib/services/localFeatureService';

interface SavedPearl {
  text: string;
  savedAt: string;
}

export function DailyClinicalPearl() {
  const today = new Date();
  const todaysPearl = getDailyPearl(today);
  const tomorrowsPearl = getTomorrowPearl(today);

  const [savedPearls, setSavedPearls] = useState<SavedPearl[]>(() =>
    readLocal<SavedPearl[]>(FEATURE_KEYS.quickSaveBookmarks + ':pearls', []),
  );
  const [showTomorrow, setShowTomorrow] = useState(false);

  const isSaved = savedPearls.some((p) => p.text === todaysPearl);

  function save() {
    const next: SavedPearl[] = [
      { text: todaysPearl, savedAt: new Date().toISOString() },
      ...savedPearls.filter((p) => p.text !== todaysPearl),
    ].slice(0, 100);
    setSavedPearls(next);
    try {
      window.localStorage.setItem(FEATURE_KEYS.quickSaveBookmarks + ':pearls', JSON.stringify(next));
    } catch {
      // Storage may be unavailable; non-blocking.
    }
  }

  const todayLabel = today.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <section className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
      <Card className="overflow-hidden p-0">
        <div className="bg-ink-900 px-5 py-4 sm:px-7 sm:py-5">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pulse-300">
              Clinical pearl · today
            </p>
            <span className="text-xs text-ink-200">{todayLabel}</span>
          </div>
          <p className="mt-1 font-display text-xl font-semibold text-white sm:text-2xl">
            {todaysPearl}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-7 sm:py-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={isSaved}
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                isSaved
                  ? 'bg-pulse-100 text-pulse-700'
                  : 'bg-pulse-600 text-white hover:bg-pulse-700'
              }`}
            >
              {isSaved ? '✓ Saved' : '★ Save pearl'}
            </button>
            <button
              type="button"
              onClick={() => setShowTomorrow((v) => !v)}
              className="text-xs text-ink-500 hover:text-ink-700"
            >
              {showTomorrow ? 'Hide tomorrow\'s pearl' : 'Peek tomorrow\'s pearl →'}
            </button>
          </div>
          <p className="text-[10px] text-ink-400">
            Day {Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000) + 1} of {PEARL_COUNT}
          </p>
        </div>
        {showTomorrow && (
          <div className="border-t border-ink-100 bg-ink-50/60 px-5 py-4 sm:px-7 sm:py-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Tomorrow</p>
            <p className="mt-1 text-sm leading-6 text-ink-700">{tomorrowsPearl}</p>
          </div>
        )}
      </Card>
    </section>
  );
}
