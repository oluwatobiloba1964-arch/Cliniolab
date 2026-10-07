'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { FlashcardSetCard } from '@/components/flashcards/FlashcardSetCard';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import type { FlashcardSetWithStats } from '@/types';

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
  const [sort, setSort] = useState<'newest' | 'cards'>('newest');

  const visibleSets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sets
      .filter((set) => !q || `${set.title} ${set.description ?? ''} ${set.categoryName ?? ''} ${set.subcategoryName ?? ''}`.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => sort === 'cards' ? b.cardCount - a.cardCount : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [sets, query, sort]);

  // Page 1 already arrived server-rendered (feature flag already checked
  // server-side, so this client never needs to re-check `enabled`).
  useEffect(() => {
    if (page === 1) {
      setSets(initialSets);
      setTotal(initialTotal);
      return;
    }
    setLoading(true);
    fetch(`/api/flashcards?page=${page}&pageSize=${pageSize}`)
      .then((res) => res.json())
      .then((data) => {
        setSets(data.sets ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [page, pageSize, initialSets, initialTotal]);

  // Search only applies to the sets already loaded for the current page,
  // so it would silently go stale against a freshly fetched page.
  function changePage(nextPage: number) {
    setQuery('');
    setPage(nextPage);
  }

  const filtersActive = query.trim() !== '';

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
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="min-h-11 rounded-xl border border-ink-200 bg-white px-3 text-sm"><option value="newest">Newest</option><option value="cards">Most cards</option></select>
        </div>
        <div className="mt-3 flex justify-between text-xs text-ink-400"><span>{visibleSets.length} shown on this page</span>{query && <button type="button" onClick={() => setQuery('')} className="font-semibold text-pulse-600">Clear search</button>}</div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {loading && sets.length === 0 && [1,2,3].map((i) => <div key={i} className="h-48 animate-pulse rounded-2xl border border-ink-100 bg-ink-50" />)}
        {visibleSets.map((set) => <FlashcardSetCard key={set.id} set={set} />)}
        {!loading && visibleSets.length === 0 && <div className="ui-empty-state col-span-full"><p className="font-semibold text-ink-700">No flashcard sets match this search.</p><button type="button" onClick={() => setQuery('')} className="mt-2 text-sm font-semibold text-pulse-600">Clear search</button></div>}
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
