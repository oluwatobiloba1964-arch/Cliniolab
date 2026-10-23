'use client';
// File: src/components/quiz/QuizLeaderboardSection.tsx
import { useEffect, useState } from 'react';
import { LeaderboardList } from '@/components/quiz/LeaderboardList';
import type { LeaderboardEntry } from '@/types';

export function QuizLeaderboardSection({
  quizId,
  currentUserId,
}: {
  quizId: string;
  /** Signed-in visitor's id, if any - passed down so the leaderboard can
   *  highlight their row and never mistakenly shows the "sign up" prompt
   *  to someone who's already logged in. */
  currentUserId?: string | null;
}) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/leaderboard/quiz/${quizId}`)
      .then((res) => res.json())
      .then((data) => {
        setEnabled(data.enabled);
        setEntries(data.entries ?? []);
        setCurrentUserRank(data.currentUserRank ?? null);
      });
  }, [quizId]);

  if (!enabled || entries.length === 0) return null;

  return (
    <div className="mt-12">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">This quiz</p>
        <h2 className="mt-1 font-display text-xl font-semibold text-ink-800">Leaderboard</h2>
        <p className="mt-1 text-sm text-ink-500">How others scored on this set.</p>
      </div>
      <LeaderboardList
        entries={entries}
        title="This Quiz's Leaderboard"
        currentUserId={currentUserId}
        currentUserRank={currentUserRank}
        primaryMetric="average"
      />
    </div>
  );
}
