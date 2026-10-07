'use client';

import { PageTools } from '@/components/layout/PageTools';
import { useEffect, useState } from 'react';
import { LeaderboardList } from '@/components/quiz/LeaderboardList';
import { useAuth } from '@/lib/auth/AuthProvider';
import type { Category, LeaderboardEntry } from '@/types';

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<string>('general');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []));
  }, []);

  useEffect(() => {
    const endpoint = selected === 'general' ? '/api/leaderboard/general' : `/api/leaderboard/category/${selected}`;
    fetch(endpoint)
      .then((res) => res.json())
      .then((data) => {
        setEnabled(data.enabled);
        setEntries(data.entries ?? []);
        setCurrentUserRank(data.currentUserRank ?? null);
      });
  }, [selected]);

  const title =
    selected === 'general' ? 'Top Quiz Takers' : `${categories.find((c) => c.id === selected)?.name ?? ''} Leaders`;

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <PageTools focus />
      <h1 className="font-display text-3xl font-semibold text-ink-800">Leaderboard</h1>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={() => setSelected('general')}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium ${selected === 'general' ? 'border-pulse-400 bg-pulse-50 text-pulse-700' : 'border-ink-100 text-ink-600'}`}
        >
          General
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelected(cat.id)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium ${selected === cat.id ? 'border-pulse-400 bg-pulse-50 text-pulse-700' : 'border-ink-100 text-ink-600'}`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {enabled ? (
          <LeaderboardList
            entries={entries}
            title={title}
            currentUserId={user?.id ?? null}
            currentUserRank={currentUserRank}
          />
        ) : (
          <p className="text-sm text-ink-400">The leaderboard is currently disabled.</p>
        )}
      </div>
    </div>
  );
}
