// src/components/quiz/AttemptedQuizBadge.tsx
'use client';

import { useEffect, useState } from 'react';
import { ATTEMPTED_QUIZZES_KEY, readJson } from '@/lib/services/localExtrasService';

interface CachedAttempt {
  percentage: number;
  at: string;
}

export function AttemptedQuizBadge({ quizId }: { quizId: string }) {
  const [entry, setEntry] = useState<CachedAttempt | null>(null);

  useEffect(() => {
    const cache = readJson<Record<string, CachedAttempt>>(ATTEMPTED_QUIZZES_KEY, {});
    setEntry(cache[quizId] ?? null);
  }, [quizId]);

  if (!entry) return null;

  return (
    <span
      title={`Last attempted ${new Date(entry.at).toLocaleDateString()}`}
      className="rounded bg-pulse-50 px-2 py-0.5 text-xs font-semibold text-pulse-700"
    >
      Last: {entry.percentage}%
    </span>
  );
}
