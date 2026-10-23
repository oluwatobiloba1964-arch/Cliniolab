// FILE: src/app/flashcards/FlashcardsClient.tsx
// src/app/flashcards/FlashcardsClient.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { FlashcardSetCard } from '@/components/flashcards/FlashcardSetCard';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import type { FlashcardSetWithStats } from '@/types';
import { publicFetchJson } from '@/lib/client/publicFetch';

interface FlashcardsClientProps {
  initialSets: FlashcardSetWithStats[];
  initialTotal: number;
  pageSize: number;
}

export function FlashcardsClient({ initialSets, initialTotal, pageSize }: FlashcardsClientProps) {
  const [sets, setSets] = useState<FlashcardSetWithStats[]>(initialSets);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'newest' | 'cards' | 'title'>('newest');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState('all');

  const visibleSets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sets
      .filter((set) => categoryFilter === 'all' || (set.categoryName ?? 'Uncategorised') === categoryFilter)
      .filter((set) => !q || `${set.title} ${set.description ?? ''} ${set.categoryName ?? ''} ${set.subcategoryName ?? ''}`.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => sort === 'cards' ? b.cardCount - a.cardCount : sort === 'title' ? a.title.localeCompare(b.title) : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [sets, query, sort, categoryFilter]);

  // Page 1 is server-rendered and is also cached locally as a fallback for a later revisit. Later pages reuse a short-lived local cache
  // first, then fall back to the existing pagination endpoint when needed.
  useEffect(() => {
    if (page === 1) {
      let usedFallback = false;
      if (initialSets.length === 0) {
        try {
          const raw = window.localStorage.getItem(`cliniolab:flashcard-list:1:${pageSize}`);
          const cached = raw ? JSON.parse(raw) as { savedAt?: number; sets?: FlashcardSetWithStats[]; total?: number } : null;
          if (cached && typeof cached.savedAt === 'number' && Date.now() - cached.savedAt >= 0 && Date.now() - cached.savedAt < 5 * 60 * 1000 && Array.isArray(cached.sets) && cached.sets.length > 0) {
            setSets(cached.sets); setTotal(typeof cached.total === 'number' ? cached.total : cached.sets.length); usedFallback = true;
          }
        } catch { /* Invalid cache falls back to the server-rendered result. */ }
      }
      if (!usedFallback) { setSets(initialSets); setTotal(initialTotal); }
      setLoadError(null); setLoading(false);
      if (initialSets.length > 0) { try { window.localStorage.setItem(`cliniolab:flashcard-list:1:${pageSize}`, JSON.stringify({ savedAt: Date.now(), sets: initialSets, total: initialTotal })); } catch { /* Cache is optional. */ } }
      return;
    }

    let cancelled = false;
    const cacheKey = `cliniolab:flashcard-list:${page}:${pageSize}`;
    try {
      const raw = window.localStorage.getItem(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw) as { savedAt?: number; sets?: FlashcardSetWithStats[]; total?: number };
        if (typeof cached.savedAt === 'number' && Date.now() - cached.savedAt >= 0
          && Date.now() - cached.savedAt < 5 * 60 * 1000 && Array.isArray(cached.sets)) {
          setSets(cached.sets);
          setTotal(typeof cached.total === 'number' ? cached.total : 0);
          setLoadError(null);
          setLoading(false);
          return;
        }
      }
    } catch {
      // Corrupt or unavailable browser storage falls through to the API.
    }

    setLoading(true);
    setLoadError(null);
    publicFetchJson<{ sets?: FlashcardSetWithStats[]; total?: number }>(
      `/api/flashcards?page=${page}&pageSize=${pageSize}`,
      30_000,
    )
      .then((data) => {
        if (cancelled) return;
        const nextSets = Array.isArray(data.sets) ? data.sets : [];
        const nextTotal = typeof data.total === 'number' ? data.total : 0;
        setSets(nextSets);
        setTotal(nextTotal);
        try {
          window.localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), sets: nextSets, total: nextTotal }));
        } catch {
          // Caching is optional and must never block browsing.
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load flashcards. Please try again.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [page, pageSize, initialSets, initialTotal, retryKey]);

  // Search only applies to the sets already loaded for the current page,
  // so it would silently go stale against a freshly fetched page.
  function changePage(nextPage: number) {
    setQuery('');
    setPage(nextPage);
  }

  const filtersActive = query.trim() !== '' || categoryFilter !== 'all';

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold text-ink-800">Flashcards</h1>
        <Link href="/flashcards/new">
          <Button>Create a flashcard set</Button>
        </Link>
      </div>
      <div className="mt-7 rounded-2xl border border-ink-100 bg-ink-50/50 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="sr-only" htmlFor="flashcard-search">Search flashcards</label>
          <input id="flashcard-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search flashcard sets on this page…" className="min-h-11 rounded-xl border border-ink-200 bg-white px-3 text-sm outline-none focus:border-pulse-400 focus:ring-2 focus:ring-pulse-100" />
          <div className="grid gap-2 sm:grid-cols-2"><select aria-label="Sort flashcard sets" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="min-h-11 rounded-xl border border-ink-200 bg-white px-3 text-sm"><option value="newest">Newest</option><option value="cards">Most cards</option><option value="title">Title A to Z</option></select><select aria-label="Filter flashcards by category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="min-h-11 rounded-xl border border-ink-200 bg-white px-3 text-sm"><option value="all">All categories</option>{Array.from(new Set(sets.map((set) => set.categoryName || 'Uncategorised'))).sort().map((category) => <option key={category} value={category}>{category}</option>)}</select></div>
        </div>
        <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-ink-400"><span>{visibleSets.length} shown on this page · {total} total sets</span>{(query || categoryFilter !== 'all') && <button type="button" onClick={() => { setQuery(''); setCategoryFilter('all'); }} className="font-semibold text-pulse-600">Clear filters</button>}</div>
      </div>
      {loadError && (
        <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-critical-100 bg-critical-50 p-4 text-sm text-critical-700">
          <span>{loadError}</span>
          <button type="button" onClick={() => setRetryKey((key) => key + 1)} className="font-semibold underline underline-offset-2">Try again</button>
        </div>
      )}
      {loading && sets.length > 0 && <p className="mt-4 text-xs text-ink-400" aria-live="polite">Refreshing flashcard sets…</p>}
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {loading && sets.length === 0 && [1,2,3].map((i) => <div key={i} className="h-48 animate-pulse rounded-2xl border border-ink-100 bg-ink-50" />)}
        {visibleSets.map((set) => <FlashcardSetCard key={set.id} set={set} />)}
        {!loading && !loadError && visibleSets.length === 0 && <div className="ui-empty-state col-span-full"><p className="font-semibold text-ink-700">{query || categoryFilter !== 'all' ? 'No flashcard sets match these filters.' : 'No flashcard sets are available on this page yet.'}</p>{query || categoryFilter !== 'all' ? <button type="button" onClick={() => { setQuery(''); setCategoryFilter('all'); }} className="mt-2 text-sm font-semibold text-pulse-600">Clear filters</button> : <Link href="/flashcards/new" className="mt-2 inline-block text-sm font-semibold text-pulse-600">Create the first set</Link>}</div>}
      </div>
      {filtersActive ? (
        <p className="mt-10 text-center text-xs text-ink-400">
          Clear search to page through all {total} flashcard sets.
        </p>
      ) : (
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={changePage} className="mt-10" />
      )}
    </div>
  );
}
