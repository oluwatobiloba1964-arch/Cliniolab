'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { publicFetchJson } from '@/lib/client/publicFetch';
import { QuizCard } from '@/components/quiz/QuizCard';
import { CompactBlogPostCard } from '@/components/cms/BlogPostCard';
import { FeaturedFlashcardSetCard } from '@/components/flashcards/FlashcardSetCard';
import type { BlogPost, FlashcardSetWithStats, QuizWithStats } from '@/types';
import { LoadingState } from '@/components/ui/StateMessage';

interface RelatedStudyMaterialsProps {
  endpoint: string;
}

interface RelatedData {
  quizzes?: QuizWithStats[];
  flashcards?: FlashcardSetWithStats[];
  posts?: BlogPost[];
}

export function RelatedStudyMaterials({ endpoint }: RelatedStudyMaterialsProps) {
  const [data, setData] = useState<RelatedData | null>(null);

  useEffect(() => {
    let cancelled = false;
    publicFetchJson<RelatedData>(endpoint, 60_000)
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch(() => {
        if (!cancelled) setData({});
      });
    return () => { cancelled = true; };
  }, [endpoint]);

  if (!data) return <div className="mt-10"><LoadingState label="Loading related study materials" /></div>;
  const quizzes = data.quizzes ?? [];
  const flashcards = data.flashcards ?? [];
  const posts = data.posts ?? [];
  if (!quizzes.length && !flashcards.length && !posts.length) return null;

  return (
    <section className="mt-10 rounded-xl border border-ink-100 bg-ink-50/40 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-pulse-600">Keep studying</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-ink-800 sm:text-2xl">Related study materials</h2>
          <p className="mt-1 text-sm text-ink-500">Continue with resources connected to this topic.</p>
        </div>
      </div>

      {quizzes.length > 0 && (
        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink-700">Practice quizzes</h3>
            <Link href="/quizzes" className="text-xs font-semibold text-pulse-600 hover:text-pulse-700">View all</Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {quizzes.slice(0, 2).map((quiz) => <QuizCard key={quiz.id} quiz={quiz} />)}
          </div>
        </div>
      )}

      {flashcards.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-ink-700">Flashcards</h3>
          <div className="max-w-xl">
            <FeaturedFlashcardSetCard set={flashcards[0]} />
          </div>
        </div>
      )}

      {posts.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-ink-700">Articles</h3>
          <div className="divide-y divide-ink-100 rounded-lg border border-ink-100 bg-white px-3 sm:px-4">
            {posts.slice(0, 3).map((post) => <CompactBlogPostCard key={post.id} post={post} />)}
          </div>
        </div>
      )}
    </section>
  );
}
