// File: src/app/search/page.tsx
'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { publicFetchJsonLocalCached, PUBLIC_LIST_TTL_MS } from '@/lib/client/publicFetch';
import { useRecentSearches } from '@/lib/hooks/useRecentSearches';
import type { SearchResults } from '@/lib/db/services/searchService';

const SEARCH_SUGGESTIONS = ['Anatomy', 'Pharmacology', 'Past questions', 'Clinical pearls', 'Flashcards'];

function SearchPageContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const [results, setResults] = useState<SearchResults | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const { recent, push } = useRecentSearches();

  // Record every executed search into the shared recent-searches list
  // (same localStorage list as the homepage hero and navbar autocomplete).
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed) push(trimmed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    publicFetchJsonLocalCached<{ enabled: boolean; results?: SearchResults | null }>(
      `/api/search?q=${encodeURIComponent(trimmed)}`,
      30_000,
    )
      .then((data) => {
        if (cancelled) return;
        setEnabled(data.enabled);
        setResults(data.results ?? null);
      })
      .catch(() => {
        if (!cancelled) setResults({ quizzes: [], posts: [], resources: [] });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <p className="text-sm text-ink-400">Search is currently unavailable.</p>
      </div>
    );
  }

  const hasResults =
    results && (results.quizzes.length > 0 || results.posts.length > 0 || results.resources.length > 0);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-2xl font-semibold text-ink-800">
        Search results for &ldquo;{query}&rdquo;
      </h1>

      {loading && (
        <div className="mt-8 space-y-3" aria-label="Loading search results" aria-busy="true">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-20 animate-pulse rounded-lg bg-ink-50" />
          ))}
        </div>
      )}

      {!query.trim() && (
        <div className="mt-8">
          <p className="text-sm text-ink-500">Type in the search bar above, or start from one of these:</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SEARCH_SUGGESTIONS.map((term) => (
              <Link
                key={term}
                href={`/search?q=${encodeURIComponent(term)}`}
                className="rounded-full border border-ink-100 bg-ink-50 px-3.5 py-1.5 text-sm font-medium text-ink-600 transition hover:border-pulse-200 hover:text-pulse-700"
              >
                {term}
              </Link>
            ))}
          </div>
        </div>
      )}

      {query.trim() && recent.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Recent searches</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {recent.filter((t) => t.toLowerCase() !== query.trim().toLowerCase()).slice(0, 5).map((term) => (
              <Link
                key={term}
                href={`/search?q=${encodeURIComponent(term)}`}
                className="rounded-full border border-ink-100 px-3.5 py-1.5 text-sm text-ink-500 transition hover:border-pulse-200 hover:text-pulse-700"
              >
                {term}
              </Link>
            ))}
          </div>
        </div>
      )}

      {!loading && !hasResults && results && (
        <div className="mt-8 rounded-2xl border border-dashed border-ink-200 bg-ink-50/50 px-6 py-10 text-center">
          <p className="font-semibold text-ink-800">No results for &ldquo;{query}&rdquo;</p>
          <p className="mt-1 text-sm text-ink-500">
            Check the spelling, try a shorter or broader term (e.g. a subject instead of a phrase), or browse the{' '}
            <Link href="/categories" className="font-medium text-pulse-600 hover:underline">full category list</Link>.
          </p>
        </div>
      )}

      {!loading && results && results.quizzes.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-pulse-600">Quizzes</h2>
          <div className="mt-3 space-y-2">
            {results.quizzes.map((q) => (
              <Link key={q.id} href={`/quizzes/${q.id}`}>
                <Card className="p-4 transition-shadow hover:shadow-md">
                  <p className="text-sm font-medium text-ink-800">{q.title}</p>
                  {q.description && <p className="mt-1 text-xs text-ink-400">{q.description}</p>}
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {!loading && results && results.posts.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-pulse-600">Articles</h2>
          <div className="mt-3 space-y-2">
            {results.posts.map((p) => (
              <Link key={p.id} href={`/blog/${p.slug}`}>
                <Card className="p-4 transition-shadow hover:shadow-md">
                  <p className="text-sm font-medium text-ink-800">{p.title}</p>
                  {p.category && <p className="mt-1 text-xs text-ink-400">{p.category}</p>}
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {!loading && results && results.resources.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-pulse-600">Resources</h2>
          <div className="mt-3 space-y-2">
            {results.resources.map((r) => (
              <Link key={r.id} href="/resources">
                <Card className="p-4 transition-shadow hover:shadow-md">
                  <p className="text-sm font-medium text-ink-800">{r.title}</p>
                  {r.description && <p className="mt-1 text-xs text-ink-400">{r.description}</p>}
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-6 py-16">
          <div className="h-8 w-2/3 animate-pulse rounded bg-ink-100" />
          <div className="mt-8 h-20 animate-pulse rounded-lg bg-ink-50" />
        </div>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
