// src/components/home/HomeHero.tsx
'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, BookOpen, Brain, ChevronRight, FileText, Search, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useRecentSearches } from '@/lib/hooks/useRecentSearches';

const quickLinks = [
  { href: '/quizzes', label: 'Quizzes', detail: 'Test your knowledge', icon: FileText },
  { href: '/flashcards', label: 'Flashcards', detail: 'Remember more', icon: Brain },
  { href: '/resources', label: 'Resources', detail: 'Study materials', icon: BookOpen },
  { href: '/blog', label: 'Articles', detail: 'Read and revise', icon: Sparkles },
] as const;

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
    setShowRecent(false);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  function searchFor(term: string) {
    setQuery(term);
    setShowRecent(false);
    push(term);
    router.push(`/search?q=${encodeURIComponent(term)}`);
  }

  return (
    <section className="relative isolate overflow-hidden bg-[#0b1d2b] text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-24 -top-32 h-80 w-80 rounded-full bg-teal-400/10 blur-3xl" />
        <div className="absolute -bottom-36 -left-20 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.12] [background-image:radial-gradient(#9de7d5_0.7px,transparent_0.7px)] [background-size:22px_22px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-8 pt-8 sm:px-6 sm:pb-12 sm:pt-12 lg:px-8 lg:pb-14 lg:pt-14">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-teal-200/20 bg-white/[0.07] px-3.5 py-1.5 text-xs font-semibold tracking-wide text-teal-100 shadow-sm sm:text-sm">
            <Sparkles className="h-4 w-4 text-teal-300" aria-hidden="true" />
            Learn smarter. Practise with purpose.
          </div>

          <h1 className="mx-auto mt-5 max-w-3xl text-[2rem] font-bold leading-[1.12] tracking-tight sm:mt-6 sm:text-5xl sm:leading-[1.08] lg:text-[3.5rem]">
            Your next nursing exam starts with{' '}
            <span className="bg-gradient-to-r from-teal-200 via-emerald-200 to-cyan-200 bg-clip-text text-transparent">
              better practice.
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:mt-5 sm:text-lg sm:leading-8">
            Explore CBT-style quizzes, flashcards, clinical study notes and helpful articles, all in one place to support your revision.
          </p>

          <div className="relative mx-auto mt-6 max-w-2xl sm:mt-8">
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 rounded-2xl border border-white/70 bg-white p-1.5 pl-3 shadow-[0_18px_55px_rgba(0,0,0,0.24)] ring-1 ring-black/5 sm:gap-3 sm:p-2 sm:pl-4"
            >
              <Search className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
              <label className="sr-only" htmlFor="homepage-search">Search nursing resources, quizzes and articles</label>
              <input
                id="homepage-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setShowRecent(true)}
                onBlur={() => window.setTimeout(() => setShowRecent(false), 140)}
                placeholder="Search quizzes, topics, resources..."
                autoComplete="off"
                className="min-w-0 flex-1 border-0 bg-transparent py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0 sm:py-3.5 sm:text-base"
              />
              <button
                type="submit"
                disabled={!query.trim()}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-12 sm:px-5 sm:text-base"
              >
                Search <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>

            {showRecent && recent.length > 0 && (
              <div
                className="absolute left-0 right-0 top-full z-30 mt-2 rounded-2xl border border-slate-200 bg-white p-2 text-left text-slate-900 shadow-xl"
                role="listbox"
                aria-label="Recent searches"
              >
                <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Recent searches
                </p>
                {recent.map((term) => (
                  <button
                    key={term}
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-800"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => searchFor(term)}
                  >
                    <span className="truncate">{term}</span>
                    <ArrowRight className="ml-3 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mx-auto mt-4 grid max-w-lg grid-cols-2 gap-2.5 sm:mt-5 sm:flex sm:max-w-none sm:justify-center sm:gap-3">
            <Link
              href="/categories"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-950/20 transition hover:-translate-y-0.5 hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1d2b] sm:min-h-[3.25rem] sm:px-6 sm:text-base"
            >
              Browse categories <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href={user ? '/quizzes/new' : '/login?next=%2Fquizzes%2Fnew'}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1d2b] sm:min-h-[3.25rem] sm:px-6 sm:text-base"
            >
              Create a quiz <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <nav aria-label="Explore Cliniolab" className="mx-auto mt-7 grid max-w-4xl grid-cols-2 gap-2.5 sm:mt-9 sm:grid-cols-4 sm:gap-3">
          {quickLinks.map(({ href, label, detail, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.055] p-3 text-left transition hover:-translate-y-0.5 hover:border-teal-200/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200 sm:p-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-300/10 text-teal-200 transition group-hover:bg-teal-300/20 sm:h-11 sm:w-11">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-white sm:text-base">{label}</span>
                <span className="mt-0.5 block truncate text-[11px] text-slate-400 sm:text-xs">{detail}</span>
              </span>
              <ChevronRight className="hidden h-4 w-4 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-teal-200 sm:block" aria-hidden="true" />
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
