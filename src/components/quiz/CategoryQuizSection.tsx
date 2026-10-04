'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { publicFetchJson } from '@/lib/client/publicFetch';
import { FeaturedQuizCard, CompactQuizCard } from '@/components/quiz/QuizCard';
import type { Category, QuizWithStats } from '@/types';

export function CategoryQuizSection({ category, initialQuizzes }: { category: Category; initialQuizzes?: QuizWithStats[] | null }) {
  const [quizzes, setQuizzes] = useState<QuizWithStats[]>(initialQuizzes ?? []);

  useEffect(() => {
    if (initialQuizzes !== undefined) {
      if (initialQuizzes !== null) setQuizzes(initialQuizzes);
      return;
    }
    publicFetchJson<{ quizzes?: QuizWithStats[] }>(`/api/quizzes?categoryId=${category.id}&limit=7`, 30_000)
      .then((data) => setQuizzes(data.quizzes ?? []))
      .catch(() => setQuizzes([]));
  }, [category.id, initialQuizzes]);

  if (quizzes.length === 0) return null; // don't show empty category sections

  const [featured, ...rest] = quizzes;

  return (
    <section className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold text-ink-800">{category.name}</h2>
        <Link
          href={`/categories/group/${category.slug}`}
          className="text-sm font-medium text-pulse-600 hover:text-pulse-700"
        >
          See more →
        </Link>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[3fr_2fr]">
        <FeaturedQuizCard quiz={featured} />
        {rest.length > 0 && (
          <div className="divide-y divide-ink-100">
            {rest.map((quiz) => (
              <CompactQuizCard key={quiz.id} quiz={quiz} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
