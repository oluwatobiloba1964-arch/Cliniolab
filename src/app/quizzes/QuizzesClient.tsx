'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { QuizCard } from '@/components/quiz/QuizCard';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import type { QuizWithStats } from '@/types';

interface QuizzesClientProps {
  initialQuizzes: QuizWithStats[];
  initialTotal: number;
  pageSize: number;
}

export function QuizzesClient({ initialQuizzes, initialTotal, pageSize }: QuizzesClientProps) {
  const [quizzes, setQuizzes] = useState<QuizWithStats[]>(initialQuizzes);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'all' | 'quiz' | 'exam' | 'study'>('all');
  const [difficulty, setDifficulty] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [sort, setSort] = useState<'newest' | 'questions'>('newest');

  const visibleQuizzes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return quizzes
      .filter((quiz) => !q || `${quiz.title} ${quiz.description ?? ''} ${quiz.categoryName ?? ''} ${quiz.subcategoryName ?? ''}`.toLowerCase().includes(q))
      .filter((quiz) => mode === 'all' || quiz.mode === mode)
      .filter((quiz) => difficulty === 'all' || quiz.difficulty === difficulty)
      .slice()
      .sort((a, b) => sort === 'questions' ? b.questionCount - a.questionCount : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [quizzes, query, mode, difficulty, sort]);

  // Page 1 already arrived server-rendered; only fetch for page changes.
  useEffect(() => {
    if (page === 1) {
      setQuizzes(initialQuizzes);
      setTotal(initialTotal);
      return;
    }
    setLoading(true);
    fetch(`/api/quizzes?page=${page}&pageSize=${pageSize}`)
      .then((res) => res.json())
      .then((data) => {
        setQuizzes(data.quizzes ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [page, pageSize, initialQuizzes, initialTotal]);

  // Filters only apply to the quizzes already loaded for the current page,
  // so they'd silently go stale against a freshly fetched page. Reset them
  // on page change instead of letting counts drift from reality.
  function changePage(nextPage: number) {
    setQuery('');
    setMode('all');
    setDifficulty('all');
    setPage(nextPage);
  }

  const filtersActive = query.trim() !== '' || mode !== 'all' || difficulty !== 'all';

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold text-ink-800">Latest Quizzes</h1>
        <Link href="/quizzes/new">
          <Button>Create a quiz</Button>
        </Link>
      </div>
      <div className="mt-7 rounded-2xl border border-ink-100 bg-ink-50/50 p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
          <label className="sr-only" htmlFor="quiz-search">Search quizzes</label>
          <input id="quiz-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search this page…" className="min-h-11 rounded-xl border border-ink-200 bg-white px-3 text-sm outline-none focus:border-pulse-400 focus:ring-2 focus:ring-pulse-100" />
          <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="min-h-11 rounded-xl border border-ink-200 bg-white px-3 text-sm">
            <option value="all">All modes</option><option value="quiz">Quiz</option><option value="exam">Exam / CBT</option><option value="study">Study</option>
          </select>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)} className="min-h-11 rounded-xl border border-ink-200 bg-white px-3 text-sm">
            <option value="all">All difficulty</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="min-h-11 rounded-xl border border-ink-200 bg-white px-3 text-sm">
            <option value="newest">Newest</option><option value="questions">Most questions</option>
          </select>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-400">
          <span>{visibleQuizzes.length} shown on this page</span>
          {(query || mode !== 'all' || difficulty !== 'all') && <button type="button" onClick={() => { setQuery(''); setMode('all'); setDifficulty('all'); }} className="font-semibold text-pulse-600 hover:text-pulse-700">Clear filters</button>}
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {loading && quizzes.length === 0 && <div className="col-span-full grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[1,2,3].map((i) => <div key={i} className="h-48 animate-pulse rounded-2xl border border-ink-100 bg-ink-50" />)}</div>}
        {visibleQuizzes.map((quiz) => <QuizCard key={quiz.id} quiz={quiz} />)}
        {!loading && visibleQuizzes.length === 0 && <div className="ui-empty-state col-span-full"><p className="font-semibold text-ink-700">No quizzes match these filters.</p><button type="button" onClick={() => { setQuery(''); setMode('all'); setDifficulty('all'); }} className="mt-2 text-sm font-semibold text-pulse-600">Clear filters</button></div>}
      </div>
      {filtersActive ? (
        <p className="mt-10 text-center text-xs text-ink-400">
          Clear filters to page through all {total} quizzes.
        </p>
      ) : (
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={changePage} className="mt-10" />
      )}
    </div>
  );
}
