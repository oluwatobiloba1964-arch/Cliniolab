// FILE: src/app/quizzes/QuizzesClient.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { QuizCard } from '@/components/quiz/QuizCard';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import type { QuizWithStats } from '@/types';
import { publicFetchJsonLocalCached, PUBLIC_LIST_TTL_MS } from '@/lib/client/publicFetch';
import {
  readQuizFilters,
  writeQuizFilters,
  clearQuizFilters,
  readListDensity,
  writeListDensity,
  type ListDensity,
} from '@/lib/services/localUiPrefs';

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
  const [searchResults, setSearchResults] = useState<QuizWithStats[] | null>(null);
  const [mode, setMode] = useState<'all' | 'quiz' | 'exam' | 'study' | 'combined'>('all');
  const [difficulty, setDifficulty] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<'newest' | 'questions' | 'attempts' | 'title'>('newest');
  const [density, setDensity] = useState<ListDensity>('comfortable');
  const [prefsReady, setPrefsReady] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = readQuizFilters();
    if (saved.mode === 'quiz' || saved.mode === 'exam' || saved.mode === 'study' || saved.mode === 'combined' || saved.mode === 'all') setMode(saved.mode);
    if (saved.difficulty === 'easy' || saved.difficulty === 'medium' || saved.difficulty === 'hard' || saved.difficulty === 'all') setDifficulty(saved.difficulty);
    if (typeof saved.category === 'string' && saved.category) setCategory(saved.category);
    if (saved.sort === 'newest' || saved.sort === 'questions' || saved.sort === 'attempts' || saved.sort === 'title') setSort(saved.sort);
    setDensity(readListDensity('quizzes'));
    setPrefsReady(true);
  }, []);

  useEffect(() => {
    if (!prefsReady) return;
    writeQuizFilters({ mode, difficulty, category, sort });
  }, [mode, difficulty, category, sort, prefsReady]);

  // DB search when query >= 2 chars, debounced 400ms
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults(null);
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setLoading(true);
      publicFetchJsonLocalCached<{ quizzes?: QuizWithStats[] }>(
        `/api/quizzes?search=${encodeURIComponent(trimmed)}`,
        30_000,
      )
        .then((data) => setSearchResults(Array.isArray(data.quizzes) ? data.quizzes : []))
        .catch(() => setSearchResults([]))
        .finally(() => setLoading(false));
    }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [query]);

  const baseQuizzes = searchResults ?? quizzes;

  const categories = useMemo(
    () =>
      Array.from(new Set(baseQuizzes.map((q) => q.categoryName).filter((v): v is string => Boolean(v)))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [baseQuizzes],
  );

  const visibleQuizzes = useMemo(() => {
    return baseQuizzes
      .filter((quiz) => mode === 'all' || quiz.mode === mode)
      .filter((quiz) => difficulty === 'all' || quiz.difficulty === difficulty)
      .filter((quiz) => category === 'all' || quiz.categoryName === category)
      .slice()
      .sort((a, b) =>
        sort === 'questions'
          ? b.questionCount - a.questionCount
          : sort === 'attempts'
          ? b.attemptCount - a.attemptCount
          : sort === 'title'
          ? a.title.localeCompare(b.title)
          : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [baseQuizzes, mode, difficulty, category, sort]);

  // Page fetching (only when not in search mode)
  useEffect(() => {
    if (searchResults !== null) return; // search result is active, skip page fetch
    if (page === 1) {
      let usedFallback = false;
      if (initialQuizzes.length === 0) {
        try {
          const raw = window.localStorage.getItem(`cliniolab:quiz-list:1:${pageSize}`);
          const cached = raw ? (JSON.parse(raw) as { savedAt?: number; quizzes?: QuizWithStats[]; total?: number }) : null;
          if (cached && typeof cached.savedAt === 'number' && Date.now() - cached.savedAt < PUBLIC_LIST_TTL_MS && Array.isArray(cached.quizzes) && cached.quizzes.length > 0) {
            setQuizzes(cached.quizzes);
            setTotal(typeof cached.total === 'number' ? cached.total : cached.quizzes.length);
            usedFallback = true;
          }
        } catch { /* fallback */ }
      }
      if (!usedFallback) {
        setQuizzes(initialQuizzes);
        setTotal(initialTotal);
      }
      setLoading(false);
      if (initialQuizzes.length > 0) {
        try {
          window.localStorage.setItem(`cliniolab:quiz-list:1:${pageSize}`, JSON.stringify({ savedAt: Date.now(), quizzes: initialQuizzes, total: initialTotal }));
        } catch { /* optional */ }
      }
      return;
    }

    let cancelled = false;
    const cacheKey = `cliniolab:quiz-list:${page}:${pageSize}`;
    try {
      const raw = window.localStorage.getItem(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw) as { savedAt?: number; quizzes?: QuizWithStats[]; total?: number };
        if (typeof cached.savedAt === 'number' && Date.now() - cached.savedAt < PUBLIC_LIST_TTL_MS && Array.isArray(cached.quizzes)) {
          setQuizzes(cached.quizzes);
          setTotal(typeof cached.total === 'number' ? cached.total : 0);
          setLoading(false);
          return;
        }
      }
    } catch { /* corrupt */ }

    setLoading(true);
    publicFetchJsonLocalCached<{ quizzes?: QuizWithStats[]; total?: number }>(
      `/api/quizzes?page=${page}&pageSize=${pageSize}`,
      PUBLIC_LIST_TTL_MS,
    )
      .then((data) => {
        if (cancelled) return;
        const nextQuizzes = Array.isArray(data.quizzes) ? data.quizzes : [];
        const nextTotal = typeof data.total === 'number' ? data.total : 0;
        setQuizzes(nextQuizzes);
        setTotal(nextTotal);
        try {
          window.localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), quizzes: nextQuizzes, total: nextTotal }));
        } catch { /* optional */ }
      })
      .catch(() => { if (!cancelled) setQuizzes([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, pageSize, initialQuizzes, initialTotal, searchResults]);

  function changePage(nextPage: number) {
    setQuery('');
    setSearchResults(null);
    setMode('all');
    setDifficulty('all');
    setCategory('all');
    setPage(nextPage);
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* ignore */ }
  }

  const isSearchMode = searchResults !== null;
  const filtersActive = query.trim() !== '' || mode !== 'all' || difficulty !== 'all' || category !== 'all';

  const activeChips: { key: string; label: string; onClear: () => void }[] = [];
  if (query.trim()) activeChips.push({ key: 'q', label: `Search: ${query.trim()}`, onClear: () => { setQuery(''); setSearchResults(null); } });
  if (mode !== 'all') activeChips.push({ key: 'mode', label: `Mode: ${mode}`, onClear: () => setMode('all') });
  if (difficulty !== 'all') activeChips.push({ key: 'diff', label: `Difficulty: ${difficulty}`, onClear: () => setDifficulty('all') });
  if (category !== 'all') activeChips.push({ key: 'cat', label: category, onClear: () => setCategory('all') });

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">Practice</p>
          <h1 className="font-display text-3xl font-semibold text-ink-800">Latest Quizzes</h1>
          <p className="mt-1 max-w-xl text-sm text-ink-500">Filter by mode, difficulty, or topic. Your last filters are remembered on this device.</p>
        </div>
        <Link href="/quizzes/new">
          <Button>Create a quiz</Button>
        </Link>
      </div>
      <div className="sticky top-16 z-20 mt-7 rounded-2xl border border-ink-100 bg-white/95 p-4 shadow-sm backdrop-blur-sm sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]">
          <label className="sr-only" htmlFor="quiz-search">Search quizzes</label>
          <input
            id="quiz-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all quizzes…"
            className="min-h-11 rounded-xl border border-ink-200 bg-white px-3 text-sm outline-none focus:border-pulse-400 focus:ring-2 focus:ring-pulse-100"
          />
          <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} aria-label="Filter by mode" className="min-h-11 rounded-xl border border-ink-200 bg-white px-3 text-sm">
            <option value="all">All modes</option><option value="quiz">Quiz</option><option value="exam">Exam / CBT</option><option value="study">Study</option><option value="combined">Combined</option>
          </select>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)} aria-label="Filter by difficulty" className="min-h-11 rounded-xl border border-ink-200 bg-white px-3 text-sm">
            <option value="all">All difficulty</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category" className="min-h-11 rounded-xl border border-ink-200 bg-white px-3 text-sm">
            <option value="all">All categories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort quizzes" className="min-h-11 rounded-xl border border-ink-200 bg-white px-3 text-sm">
            <option value="newest">Newest</option><option value="questions">Most questions</option><option value="attempts">Most attempts</option><option value="title">Title A to Z</option>
          </select>
        </div>
        {activeChips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Active filters">
            {activeChips.map((chip) => (
              <button key={chip.key} type="button" onClick={chip.onClear} className="inline-flex items-center gap-1.5 rounded-full border border-pulse-200 bg-pulse-50 px-3 py-1 text-xs font-semibold text-pulse-700 hover:bg-pulse-100">
                {chip.label}<span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-400">
          <span>
            {isSearchMode
              ? `${visibleQuizzes.length} result${visibleQuizzes.length === 1 ? '' : 's'} across all quizzes`
              : `${visibleQuizzes.length} shown on this page${!filtersActive ? ` · ${total} total` : ''}`}
          </span>
          {filtersActive && (
            <button type="button" onClick={() => { setQuery(''); setSearchResults(null); setMode('all'); setDifficulty('all'); setCategory('all'); clearQuizFilters(); }} className="font-semibold text-pulse-600 hover:text-pulse-700">
              Clear filters
            </button>
          )}
          <button
            type="button"
            onClick={() => { const next = density === 'compact' ? 'comfortable' : 'compact'; setDensity(next); writeListDensity('quizzes', next); }}
            className="ml-auto text-xs font-semibold text-ink-500 hover:text-pulse-700"
          >
            {density === 'compact' ? 'Comfortable view' : 'Compact view'}
          </button>
        </div>
      </div>
      <div className={`mt-6 grid grid-cols-1 sm:grid-cols-2 ${density === 'compact' ? 'lg:grid-cols-4 gap-3' : 'lg:grid-cols-3 gap-5'}`}>
        {loading && <div className="col-span-full grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((i) => <div key={i} className="h-48 animate-pulse rounded-2xl border border-ink-100 bg-ink-50" />)}</div>}
        {!loading && visibleQuizzes.map((quiz) => <QuizCard key={quiz.id} quiz={quiz} />)}
        {!loading && visibleQuizzes.length === 0 && (
          <div className="ui-empty-state col-span-full rounded-2xl border border-dashed border-ink-200 bg-white px-6 py-12 text-center">
            <p className="font-semibold text-ink-700">No quizzes match these filters.</p>
            <p className="mt-1 text-sm text-ink-400">Try another search or clear the active filters.</p>
            <button type="button" onClick={() => { setQuery(''); setSearchResults(null); setMode('all'); setDifficulty('all'); setCategory('all'); clearQuizFilters(); }} className="mt-3 text-sm font-semibold text-pulse-600">Clear filters</button>
          </div>
        )}
      </div>
      {!isSearchMode && (
        filtersActive ? (
          <p className="mt-10 text-center text-xs text-ink-400">Clear filters to page through all {total} quizzes.</p>
        ) : (
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={changePage} className="mt-10" />
        )
      )}
    </div>
  );
}
