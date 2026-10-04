'use client';

import { useEffect, useState } from 'react';
import { publicFetchJson } from '@/lib/client/publicFetch';
import { QuizCard } from '@/components/quiz/QuizCard';
import type { QuizWithStats } from '@/types';

interface RelatedQuizzesProps {
  /** Endpoint to fetch related quizzes from, e.g. /api/quizzes/{id}/related or /api/blog/{slug}/related */
  endpoint: string;
  title?: string;
}

export function RelatedQuizzes({ endpoint, title = 'Related quizzes' }: RelatedQuizzesProps) {
  const [quizzes, setQuizzes] = useState<QuizWithStats[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    publicFetchJson<{ quizzes?: QuizWithStats[] }>(endpoint, 60_000)
      .then((data) => {
        if (!cancelled) setQuizzes(data.quizzes ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  // Render nothing while loading and nothing if there's genuinely no
  // related content, rather than showing an empty section header.
  if (!loaded || quizzes.length === 0) return null;

  return (
    <div className="mt-10">
      <h2 className="font-display text-xl font-semibold text-ink-800">{title}</h2>
      <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {quizzes.map((quiz) => (
          <QuizCard key={quiz.id} quiz={quiz} />
        ))}
      </div>
    </div>
  );
}
