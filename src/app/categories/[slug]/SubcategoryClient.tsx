'use client';

import { PageTools } from '@/components/layout/PageTools';
import { useEffect, useState } from 'react';
import { QuizCard } from '@/components/quiz/QuizCard';
import { LeaderboardList } from '@/components/quiz/LeaderboardList';
import { Pagination } from '@/components/ui/Pagination';
import { useAuth } from '@/lib/auth/AuthProvider';
import type { Category, LeaderboardEntry, QuizWithStats, Subcategory } from '@/types';
import { publicFetchJsonLocalCached, PUBLIC_LIST_TTL_MS } from '@/lib/client/publicFetch';

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
    let cancelled = false;
    fetch(`/api/leaderboard/category/${category.id}`, { cache: 'no-store', credentials: 'same-origin' })
      .then((res) => res.json())
      .then((lbData) => {
        if (cancelled) return;
        setLeaderboardEnabled(lbData.enabled);
        setLeaderboard(lbData.entries ?? []);
        setLeaderboardCurrentUserRank(lbData.currentUserRank ?? null);
      }).catch(() => { if (!cancelled) setLeaderboard([]); });
    return () => { cancelled = true; };
  }, [category]);

  // Skip refetching page 1 since server data already covers it.
  useEffect(() => {
    if (!subcategory) return;
    let cancelled = false;
    const cacheKey = `/api/quizzes?subcategoryId=${subcategory.id}&page=${page}&pageSize=${pageSize}`;
    if (page === 1) {
      // Restore a local copy first; server-rendered data is the fallback.
      try {
        const raw = window.localStorage.getItem(`cliniolab:subcategory-quizzes:${subcategory.id}:1:${pageSize}`);
        const cached = raw ? JSON.parse(raw) as { savedAt?: number; quizzes?: QuizWithStats[]; total?: number } : null;
        const age = typeof cached?.savedAt === 'number' ? Date.now() - cached.savedAt : Number.POSITIVE_INFINITY;
        if (age >= 0 && age < PUBLIC_LIST_TTL_MS && Array.isArray(cached?.quizzes)) {
          setQuizzes(cached.quizzes);
          setTotal(typeof cached.total === 'number' ? cached.total : 0);
          return;
        }
      } catch { /* Use server-rendered fallback. */ }
      setQuizzes(initialQuizzes);
      setTotal(initialTotal);
      try { window.localStorage.setItem(`cliniolab:subcategory-quizzes:${subcategory.id}:1:${pageSize}`, JSON.stringify({ savedAt: Date.now(), quizzes: initialQuizzes, total: initialTotal })); } catch { /* Optional cache. */ }
      return;
    }
    publicFetchJsonLocalCached<{ quizzes?: QuizWithStats[]; total?: number }>(cacheKey, PUBLIC_LIST_TTL_MS)
      .then((data) => {
        if (cancelled) return;
        const nextQuizzes = data.quizzes ?? [];
        const nextTotal = data.total ?? 0;
        setQuizzes(nextQuizzes);
        setTotal(nextTotal);
        try { window.localStorage.setItem(`cliniolab:subcategory-quizzes:${subcategory.id}:${page}:${pageSize}`, JSON.stringify({ savedAt: Date.now(), quizzes: nextQuizzes, total: nextTotal })); } catch { /* Optional cache. */ }
      }).catch(() => { if (!cancelled) setQuizzes([]); });
    return () => { cancelled = true; };
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
