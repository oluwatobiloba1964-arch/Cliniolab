/*
 * CHANGE SUMMARY (blog/BlogListingClient.tsx -- NEW FILE)
 * - Client-side search, category filter, sort (newest/oldest/title A-Z), and a
 *   personal "reading list" (saved via localStorage, device-only, no new API)
 * - Empty state with "reset filters" when nothing matches
 * Note: the category filter here uses the legacy free-text `post.category` field,
 * a different axis from the "/blog/category/[slug]" pills above it on the page
 * (which use blogCategoryId). Both work, but are two separate category concepts
 * coexisting on one page -- worth knowing if it ever looks inconsistent to users.
 * Reviewed: type-safe against BlogPost, no new API/db. Approved as-is.
 *
 * UI additions (local-only): sticky filter bar, active filter chips, remembered
 * sort/category, optional compact grid density — nothing removed.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { BlogPostCard } from '@/components/cms/BlogPostCard';
import type { BlogPost } from '@/types';
import {
  readBlogFilters,
  writeBlogFilters,
  clearBlogFilters,
  readListDensity,
  writeListDensity,
  type ListDensity,
} from '@/lib/services/localUiPrefs';

const SAVED_KEY = 'cliniolab-reading-list-v1';
const PAGE_SIZE = 20;

export function BlogListingClient({ posts }: { posts: BlogPost[] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'title'>('newest');
  const [savedOnly, setSavedOnly] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [density, setDensity] = useState<ListDensity>('comfortable');
  const [prefsReady, setPrefsReady] = useState(false);

  useEffect(() => {
    try {
      const value = window.localStorage.getItem(SAVED_KEY);
      if (value) setSavedIds(JSON.parse(value) as string[]);
    } catch {
      setSavedIds([]);
    }
    const saved = readBlogFilters();
    if (typeof saved.category === 'string' && saved.category) setCategory(saved.category);
    if (saved.sort === 'newest' || saved.sort === 'oldest' || saved.sort === 'title') setSort(saved.sort);
    setDensity(readListDensity('blog'));
    setReady(true);
    setPrefsReady(true);
  }, []);

  useEffect(() => {
    if (!prefsReady) return;
    writeBlogFilters({ category, sort });
  }, [category, sort, prefsReady]);

  function toggleSaved(id: string) {
    setSavedIds((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      try { window.localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch { /* storage may be unavailable */ }
      return next;
    });
  }

  const categories = useMemo(() => Array.from(new Set(posts.map((post) => post.category).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b)), [posts]);
  const visiblePosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts
      .filter((post) => category === 'all' || post.category === category)
      .filter((post) => !savedOnly || savedIds.includes(post.id))
      .filter((post) => !q || `${post.title} ${post.excerpt ?? ''} ${post.content ?? ''} ${post.category ?? ''}`.replace(/<[^>]*>/g, ' ').toLowerCase().includes(q))
      .slice()
      .sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : sort === 'oldest' ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [posts, query, category, savedOnly, savedIds, sort]);

  // Any change to what's being shown (search, filter, sort, reading list
  // toggle) should restart pagination at the first page.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, category, savedOnly, sort]);

  const pagedPosts = visiblePosts.slice(0, visibleCount);
  const hasMore = visibleCount < visiblePosts.length;

  const activeChips: { key: string; label: string; onClear: () => void }[] = [];
  if (query.trim()) activeChips.push({ key: 'q', label: `Search: ${query.trim()}`, onClear: () => setQuery('') });
  if (category !== 'all') activeChips.push({ key: 'cat', label: category, onClear: () => setCategory('all') });
  if (savedOnly) activeChips.push({ key: 'saved', label: 'Reading list only', onClear: () => setSavedOnly(false) });

  function resetFilters() {
    setQuery('');
    setCategory('all');
    setSavedOnly(false);
    setSort('newest');
    clearBlogFilters();
  }

  return (
    <>
      <section aria-label="Find articles" className="sticky top-16 z-20 mt-7 rounded-2xl border border-ink-100 bg-white/95 p-4 shadow-sm backdrop-blur-sm sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="sr-only" htmlFor="blog-search">Search articles</label>
          <input id="blog-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search articles, topics, or keywords" className="min-h-11 rounded-xl border border-ink-200 bg-white px-3 text-sm outline-none focus:border-pulse-400 focus:ring-2 focus:ring-pulse-100" />
          <label className="sr-only" htmlFor="blog-sort">Sort articles</label>
          <select id="blog-sort" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="min-h-11 rounded-xl border border-ink-200 bg-white px-3 text-sm"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="title">Title A to Z</option></select>
          <button type="button" onClick={() => setSavedOnly((value) => !value)} aria-pressed={savedOnly} className={`min-h-11 rounded-xl border px-4 text-sm font-semibold ${savedOnly ? 'border-pulse-500 bg-pulse-50 text-pulse-700' : 'border-ink-200 bg-white text-ink-600'}`}>{savedOnly ? 'Showing saved' : `Reading list (${ready ? savedIds.length : 0})`}</button>
        </div>
        {categories.length > 0 && <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => setCategory('all')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${category === 'all' ? 'bg-ink-800 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-100'}`}>All topics</button>{categories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${category === item ? 'bg-ink-800 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-100'}`}>{item}</button>)}</div>}
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
          <span>Showing {pagedPosts.length} of {visiblePosts.length} articles{visiblePosts.length !== posts.length ? ` (filtered from ${posts.length})` : ''}</span>
          {(query || category !== 'all' || savedOnly || sort !== 'newest') && <button type="button" onClick={resetFilters} className="font-semibold text-pulse-600">Reset filters</button>}
          <button
            type="button"
            onClick={() => {
              const next = density === 'compact' ? 'comfortable' : 'compact';
              setDensity(next);
              writeListDensity('blog', next);
            }}
            className="ml-auto text-xs font-semibold text-ink-500 hover:text-pulse-700"
            title="Toggle denser card grid (saved on this device)"
          >
            {density === 'compact' ? 'Comfortable view' : 'Compact view'}
          </button>
        </div>
      </section>
      <div className={`mt-6 grid grid-cols-1 gap-5 ${density === 'compact' ? 'sm:grid-cols-2 lg:grid-cols-3 gap-3' : 'sm:grid-cols-2'}`}>
        {pagedPosts.map((post) => <div key={post.id} className="relative"><BlogPostCard post={post} /><button type="button" onClick={() => toggleSaved(post.id)} aria-pressed={savedIds.includes(post.id)} aria-label={savedIds.includes(post.id) ? `Remove ${post.title} from reading list` : `Save ${post.title} to reading list`} className="absolute right-3 top-3 z-10 rounded-full border border-ink-100 bg-white/95 px-3 py-2 text-xs font-semibold text-ink-700 shadow-sm hover:bg-pulse-50">{savedIds.includes(post.id) ? '♥ Saved' : '♡ Save'}</button></div>)}
        {visiblePosts.length === 0 && <div className="col-span-full rounded-2xl border border-dashed border-ink-200 bg-white px-5 py-12 text-center"><p className="font-semibold text-ink-700">No articles match these filters.</p><p className="mt-1 text-sm text-ink-400">Try another search or reset the filters.</p><button type="button" onClick={resetFilters} className="mt-3 text-sm font-semibold text-pulse-600">Reset filters</button></div>}
      </div>
      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
            className="min-h-11 rounded-xl border border-ink-200 bg-white px-6 text-sm font-semibold text-ink-700 shadow-sm hover:bg-ink-50"
          >
            Load more articles ({visiblePosts.length - pagedPosts.length} remaining)
          </button>
        </div>
      )}
      <p className="mt-5 text-xs text-ink-400">Your reading list and filter preferences are saved on this device only.</p>
    </>
  );
}
