// src/components/home/HomeLeaderboardSection.tsx
'use client';

import { LeaderboardList } from '@/components/quiz/LeaderboardList';
import type { LeaderboardEntry } from '@/types';

interface HomeLeaderboardSectionProps {
  enabled: boolean;
  label: string;
  entries: LeaderboardEntry[];
  currentUserId: string | null;
  currentUserRank: number | null;
}

export function HomeLeaderboardSection({
  enabled,
  label,
  entries,
  currentUserId,
  currentUserRank,
}: HomeLeaderboardSectionProps) {
  if (!enabled) return null;

  return (
    <section className="border-y border-ink-100 bg-ink-50/40">
      <div className="mx-auto max-w-3xl px-6 py-14 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">Community</p>
        <h2 className="mt-1 font-display text-2xl font-semibold text-ink-900">{label}</h2>
        <p className="mt-1 text-sm text-ink-500">Top performers across every category.</p>
        <div className="mt-6">
          <LeaderboardList
            entries={entries}
            title={label}
            currentUserId={currentUserId}
            currentUserRank={currentUserRank}
          />
        </div>
      </div>
    </section>
  );
}
