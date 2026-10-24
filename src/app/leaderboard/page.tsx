// FILE: src/app/leaderboard/page.tsx
'use client';
// File: src/app/leaderboard/page.tsx
import { PageTools } from '@/components/layout/PageTools';
import { useEffect, useState } from 'react';
import { LeaderboardList } from '@/components/quiz/LeaderboardList';
import { useAuth } from '@/lib/auth/AuthProvider';
import type { Category, LeaderboardEntry } from '@/types';
import { publicFetchJsonLocalCached, PUBLIC_LIST_TTL_MS } from '@/lib/client/publicFetch';

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<string>('general');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    publicFetchJsonLocalCached<{ categories?: Category[] }>('/api/categories', PUBLIC_LIST_TTL_MS)
      .then((data) => { if (!cancelled) setCategories(data.categories ?? []); })
      .catch(() => { if (!cancelled) setCategories([]); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const endpoint =
      selected === 'general' ? '/api/leaderboard/general' : `/api/leaderboard/category/${selected}`;
    // Leaderboard responses can include the signed-in user's rank, so do not
    // put them in the shared public cache. Only suppress stale UI updates.
    fetch(endpoint, { cache: 'no-store', credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Leaderboard request failed: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setEnabled(data.enabled);
        setEntries(data.entries ?? []);
        setCurrentUserRank(data.currentUserRank ?? null);
      })
      .catch(() => { if (!cancelled) { setEntries([]); setCurrentUserRank(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selected]);

  const title =
    selected === 'general'
      ? 'Top Quiz Takers'
      : `${categories.find((c) => c.id === selected)?.name ?? ''} Leaders`;

  return (
    <div className="relative min-h-[70vh] overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-ink-50 via-white to-transparent"
      />
      <div className="relative mx-auto max-w-3xl px-6 py-14 sm:py-16">
        <PageTools focus />

        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">Rankings</p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-ink-800 sm:text-4xl">Leaderboard</h1>
        <p className="mt-2 max-w-lg text-sm text-ink-500">
          See who is leading across the platform or within a single category. Scores update as learners complete quizzes and exams.
        </p>

        <div className="mt-7 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelected('general')}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
              selected === 'general'
                ? 'border-pulse-500 bg-pulse-500 text-white shadow-sm shadow-pulse-500/25'
                : 'border-ink-200 bg-white text-ink-600 hover:border-pulse-300 hover:text-pulse-700'
            }`}
          >
            General
          </button>
          {categories.map((cat) => (
            <button
              type="button"
              key={cat.id}
              onClick={() => setSelected(cat.id)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                selected === cat.id
                  ? 'border-pulse-500 bg-pulse-500 text-white shadow-sm shadow-pulse-500/25'
                  : 'border-ink-200 bg-white text-ink-600 hover:border-pulse-300 hover:text-pulse-700'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="mt-8">
          {loading ? (
            <div className="rounded-2xl border border-ink-100 bg-white p-8 text-center text-sm text-ink-400 shadow-sm">
              Loading rankings…
            </div>
          ) : enabled ? (
            <LeaderboardList
              entries={entries}
              title={title}
              currentUserId={user?.id ?? null}
              currentUserRank={currentUserRank}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-ink-200 bg-white px-6 py-10 text-center text-sm text-ink-500">
              The leaderboard is currently disabled.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
