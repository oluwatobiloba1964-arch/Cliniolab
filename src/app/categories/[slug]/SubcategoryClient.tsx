'use client';

import { PageTools } from '@/components/layout/PageTools';
import { useEffect, useState } from 'react';
import { QuizCard } from '@/components/quiz/QuizCard';
import { LeaderboardList } from '@/components/quiz/LeaderboardList';
import { Pagination } from '@/components/ui/Pagination';
import { useAuth } from '@/lib/auth/AuthProvider';
import type { Category, LeaderboardEntry, QuizWithStats, Subcategory } from '@/types';

interface SubcategoryClientProps {
  category: Category | null;
  subcategory: Subcategory | null;
  initialQuizzes: QuizWithStats[];
  initialTotal: number;
  pageSize: number;
}

export function SubcategoryClient({
  category,
  subcategory,
  initialQuizzes,
  initialTotal,
  pageSize,
}: SubcategoryClientProps) {
  const { user } = useAuth();

  const [quizzes, setQuizzes] = useState<QuizWithStats[]>(initialQuizzes);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardEnabled, setLeaderboardEnabled] = useState(true);
  const [leaderboardCurrentUserRank, setLeaderboardCurrentUserRank] = useState<number | null>(null);

  // User-specific/interactive data only - identity and first page of
  // quizzes already arrived server-rendered via props.
  useEffect(() => {
    if (!category) return;
    fetch(`/api/leaderboard/category/${category.id}`)
      .then((res) => res.json())
      .then((lbData) => {
        setLeaderboardEnabled(lbData.enabled);
        setLeaderboard(lbData.entries ?? []);
        setLeaderboardCurrentUserRank(lbData.currentUserRank ?? null);
      });
  }, [category]);

  // Skip refetching page 1 since server data already covers it.
  useEffect(() => {
    if (!subcategory) return;
    if (page === 1) {
      setQuizzes(initialQuizzes);
      setTotal(initialTotal);
      return;
    }
    fetch(`/api/quizzes?subcategoryId=${subcategory.id}&page=${page}&pageSize=${pageSize}`)
      .then((res) => res.json())
      .then((data) => {
        setQuizzes(data.quizzes ?? []);
        setTotal(data.total ?? 0);
      });
  }, [subcategory, page, pageSize, initialQuizzes, initialTotal]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <PageTools focus />
      {category && <p className="font-mono text-xs uppercase tracking-widest text-pulse-600">{category.name}</p>}
      <h1 className="mt-2 font-display text-3xl font-semibold text-ink-800">
        {subcategory?.name ?? 'Category not found'}
      </h1>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {quizzes.map((quiz) => (
              <QuizCard key={quiz.id} quiz={quiz} />
            ))}
            {quizzes.length === 0 && (
              <p className="col-span-full text-sm text-ink-400">No quizzes in this subcategory yet.</p>
            )}
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
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
