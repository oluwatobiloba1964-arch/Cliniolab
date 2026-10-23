'use client';
// File: src/components/home/HomeLeaderboardSection.tsx
import Link from 'next/link';
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
    <section className="relative overflow-hidden border-y border-ink-100 bg-gradient-to-b from-ink-50/70 via-white to-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 top-0 h-40 w-40 rounded-full bg-flag-200/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-10 bottom-0 h-36 w-36 rounded-full bg-pulse-200/20 blur-3xl"
      />

      <div className="relative mx-auto max-w-3xl px-6 py-14 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">Community</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-ink-900 sm:text-3xl">{label}</h2>
            <p className="mt-1.5 max-w-md text-sm text-ink-500">
              Top performers across every category. Climb the board by practising quizzes and exams.
            </p>
          </div>
          <Link
            href="/leaderboard"
            className="rounded-full border border-ink-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-ink-600 shadow-sm transition hover:border-pulse-300 hover:text-pulse-700"
          >
            Full leaderboard
          </Link>
        </div>
        <div className="mt-7">
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
