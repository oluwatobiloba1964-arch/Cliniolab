// src/components/home/HomeHero.tsx
'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useRecentSearches } from '@/lib/hooks/useRecentSearches';
import { Button } from '@/components/ui/Button';

export function HomeHero() {
  const router = useRouter();
  const { user } = useAuth();
  const { recent, push } = useRecentSearches();
  const [query, setQuery] = useState('');
  const [showRecent, setShowRecent] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    push(trimmed);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <section className="relative overflow-hidden bg-ink-800 py-14 text-center text-white sm:py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <h1 className="font-display text-3xl font-semibold leading-tight sm:text-5xl">
          Practice, Revise &amp; Master Your Clinical &amp; Nursing Exams
        </h1>
        <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-ink-100 sm:text-lg">
          Cliniolab brings together student-built quizzes, CBT-style exams, and clinical study
          notes in one place so you can revise a topic, test yourself on it, and track how
          you&apos;re improving, all before you ever get to the real exam.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mx-auto mt-8 flex max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-lg sm:flex-row"
        >
          <label className="sr-only" htmlFor="homepage-search">Search nursing resources, quizzes and articles</label>
          <input
            id="homepage-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setShowRecent(true)}
            onBlur={() => window.setTimeout(() => setShowRecent(false), 120)}
            placeholder="Search nursing resources, quizzes, articles..."
            autoComplete="off"
            className="min-w-0 flex-1 px-4 py-3.5 text-sm text-ink-800 outline-none ring-inset focus:ring-2 focus:ring-pulse-500"
          />
          <button
            type="submit"
            className="min-h-12 bg-pulse-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-pulse-700 sm:min-h-0"
          >
            Search
          </button>
        </form>

        {showRecent && recent.length > 0 && (
          <div
            className="mx-auto mt-2 max-w-2xl rounded-xl border border-ink-100 bg-white p-2 text-left shadow-lg"
            role="listbox"
            aria-label="Recent searches"
          >
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-ink-400">
              Recent searches
            </p>
            {recent.map((term) => (
              <button
                key={term}
                type="button"
                className="block w-full rounded-lg px-2 py-2 text-left text-sm text-ink-600 hover:bg-ink-50"
                onMouseDown={() => {
                  setQuery(term);
                  router.push(`/search?q=${encodeURIComponent(term)}`);
                }}
              >
                ↗ {term}
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-3 sm:mt-8 sm:flex sm:justify-center sm:gap-4">
          <Link href="/categories">
            <Button size="lg">Browse categories</Button>
          </Link>
          <Link href={user ? '/quizzes/new' : '/login?next=%2Fquizzes%2Fnew'}>
            <Button size="lg" variant="secondary">
              Create a quiz
            </Button>
          </Link>
        </div>

        <div className="mx-auto mt-6 grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ['/quizzes', '📝', 'Quizzes'],
              ['/flashcards', '🧠', 'Flashcards'],
              ['/resources', '📚', 'Resources'],
              ['/blog', '📖', 'Articles'],
            ] as const
          ).map(([href, icon, label]) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-left transition-colors hover:bg-white/10"
            >
              <span className="text-base">{icon}</span>
              <span className="ml-2 text-xs font-semibold text-white">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
