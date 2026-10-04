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
    publicFetchJson<{ enabled: boolean; quiz: QuizWithStats | null }>('/api/daily-quiz', 60_000)
      .then((data) => {
        setEnabled(data.enabled);
        setQuiz(data.quiz);
      });
  }, []);

  if (!enabled || !quiz) return null;

  return (
    <section className="border-b border-ink-100 bg-gradient-to-r from-pulse-500 to-pulse-600">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-pulse-100">
              Question of the Day
            </p>
            <h2 className="mt-1 font-display text-xl font-semibold text-white">{quiz.title}</h2>
          </div>
          <Link href={`/quizzes/${quiz.id}`}>
            <Button variant="secondary">Take today&apos;s quiz</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
