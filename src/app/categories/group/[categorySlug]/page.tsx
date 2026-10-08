// src/app/categories/group/[categorySlug]/page.tsx
'use client';

import { PageTools } from '@/components/layout/PageTools';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { QuizCard } from '@/components/quiz/QuizCard';
import { FlashcardSetCard } from '@/components/flashcards/FlashcardSetCard';
import { LeaderboardList } from '@/components/quiz/LeaderboardList';
import { Pagination } from '@/components/ui/Pagination';
import { useAuth } from '@/lib/auth/AuthProvider';
import type { Category, FlashcardSetWithStats, LeaderboardEntry, QuizWithStats, Subcategory } from '@/types';

const PAGE_SIZE = 25;

export default function CategoryGroupPage() {
  const params = useParams<{ categorySlug: string }>();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [category, setCategory] = useState<Category | null>(null);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [tab, setTab] = useState<'quizzes' | 'flashcards'>(
    searchParams.get('tab') === 'flashcards' ? 'flashcards' : 'quizzes'
  );
  const [quizzes, setQuizzes] = useState<QuizWithStats[]>([]);
  const [flashcardSets, setFlashcardSets] = useState<FlashcardSetWithStats[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardEnabled, setLeaderboardEnabled] = useState(true);
  const [leaderboardCurrentUserRank, setLeaderboardCurrentUserRank] = useState<number | null>(null);

  // Category lookup + leaderboard only need to happen once per category,
  // not on every page change.
  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => {
        const cat = (data.categories as Category[]).find((c) => c.slug === params.categorySlug) ?? null;
        setCategory(cat);
        setSubcategories(
          (data.subcategories as Subcategory[] | undefined)?.filter((sub) => sub.categoryId === cat?.id) ?? []
        );
        if (cat) {
          fetch(`/api/leaderboard/category/${cat.id}`)
            .then((res) => res.json())
            .then((lbData) => {
              setLeaderboardEnabled(lbData.enabled);
              setLeaderboard(lbData.entries ?? []);
              setLeaderboardCurrentUserRank(lbData.currentUserRank ?? null);
            });
        }
      });
  }, [params.categorySlug]);

  // Quiz list re-fetches whenever the category resolves or the page
  // changes. Resets to page 1 whenever the category itself changes (e.g.
  // navigating directly between two category pages without a full reload).
  useEffect(() => {
    if (!category || tab !== 'quizzes') return;
    fetch(`/api/quizzes?categoryId=${category.id}&page=${page}&pageSize=${PAGE_SIZE}`)
      .then((res) => res.json())
      .then((data) => {
        setQuizzes(data.quizzes ?? []);
        setTotal(data.total ?? 0);
      });
  }, [category, page, tab]);

  useEffect(() => {
    if (!category || tab !== 'flashcards') return;
    fetch(`/api/flashcards?categoryId=${category.id}&page=${page}&pageSize=${PAGE_SIZE}`)
      .then((res) => res.json())
      .then((data) => {
        setFlashcardSets(data.sets ?? []);
        setTotal(data.total ?? 0);
      });
  }, [category, page, tab]);

  useEffect(() => {
    setPage(1);
  }, [category?.id, tab]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <PageTools focus />
      <h1 className="font-display text-3xl font-semibold text-ink-800">
        {category?.name ?? 'Loading…'}
      </h1>
      {category?.description && <p className="mt-2 text-ink-500">{category.description}</p>}

      {subcategories.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2" aria-label={`${category?.name ?? 'Category'} subcategories`}>
          {subcategories.map((sub) => (
            <Link
              key={sub.id}
              href={`/categories/${sub.slug}?category=${category?.slug ?? ''}`}
              className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-600 transition-colors hover:border-pulse-200 hover:bg-pulse-50 hover:text-pulse-700"
            >
              {sub.name}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6 flex gap-2 border-b border-ink-100">
        <button
          onClick={() => setTab('quizzes')}
          className={`px-4 py-2 text-sm font-medium ${
            tab === 'quizzes' ? 'border-b-2 border-pulse-500 text-pulse-600' : 'text-ink-500'
          }`}
        >
          Quiz / Exam / Study
        </button>
        <button
          onClick={() => setTab('flashcards')}
          className={`px-4 py-2 text-sm font-medium ${
            tab === 'flashcards' ? 'border-b-2 border-pulse-500 text-pulse-600' : 'text-ink-500'
          }`}
        >
          Flashcards
        </button>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {tab === 'quizzes' ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {quizzes.map((quiz) => (
                <QuizCard key={quiz.id} quiz={quiz} />
              ))}
              {quizzes.length === 0 && (
                <p className="col-span-full text-sm text-ink-400">No quizzes in this category yet.</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {flashcardSets.map((set) => (
                <FlashcardSetCard key={set.id} set={set} />
              ))}
              {flashcardSets.length === 0 && (
                <p className="col-span-full text-sm text-ink-400">No flashcard sets in this category yet.</p>
              )}
            </div>
          )}
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={(p) => {
              setPage(p);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="mt-8"
          />
        </div>
        {leaderboardEnabled && category && (
          <div>
            <LeaderboardList
              entries={leaderboard}
              title={`${category.name} Leaders`}
              currentUserId={user?.id ?? null}
              currentUserRank={leaderboardCurrentUserRank}
            />
          </div>
        )}
      </div>
    </div>
  );
}
