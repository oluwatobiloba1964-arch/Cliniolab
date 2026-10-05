// File: src/components/layout/DailyQuizBanner.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { QuizWithStats } from '@/types';
import { publicFetchJson } from '@/lib/client/publicFetch';

export function DailyQuizBanner() {
  const [quiz, setQuiz] = useState<QuizWithStats | null>(null);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    // Keep the existing single daily-quiz request. This component is purely
    // presentation: no new persistence, D1 query, or Worker invocation.
    publicFetchJson<{ enabled: boolean; quiz: QuizWithStats | null }>('/api/daily-quiz', 60_000)
      .then((data) => {
        setEnabled(data.enabled);
        setQuiz(data.quiz);
      });
  }, []);

  if (!enabled || !quiz) return null;

  return (
    <section className="relative overflow-hidden bg-pulse-600 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(255,255,255,0.18),transparent_28%),radial-gradient(circle_at_10%_100%,rgba(0,0,0,0.12),transparent_30%)]" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-6 py-7 sm:py-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-sm">🎯</span>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-pulse-100">
                Question of the Day
              </p>
            </div>
            <h2 className="mt-3 font-display text-xl font-semibold leading-snug text-white sm:text-2xl">{quiz.title}</h2>
            <p className="mt-1 text-sm text-pulse-100">A quick practice session to keep your learning moving.</p>
          </div>
          <Link href={`/quizzes/${quiz.id}`} className="shrink-0">
            <Button variant="secondary" size="lg">Take today&apos;s quiz →</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
