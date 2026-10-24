'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, FileQuestion, Search, SlidersHorizontal, X, LibraryBig } from 'lucide-react';
import { ResourceCard } from '@/components/resources/ResourceCard';
import type { Resource, ResourceCategory } from '@/types';
import { publicFetchJsonLocalCached, PUBLIC_LIST_TTL_MS } from '@/lib/client/publicFetch';
import {
  readResourceFilters,
  writeResourceFilters,
  clearResourceFilters,
  readListDensity,
  writeListDensity,
  type ListDensity,
} from '@/lib/services/localUiPrefs';

type KindFilter = 'all' | 'book' | 'past_question_pack';
type PriceFilter = 'all' | 'free' | 'paid';
type SortMode = 'newest' | 'title' | 'free-first' | 'relevance';

export default function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [categories, setCategories] = useState<ResourceCategory[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<KindFilter>('all');
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');
  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('newest');
  const [density, setDensity] = useState<ListDensity>('comfortable');
  const [prefsReady, setPrefsReady] = useState(false);

  useEffect(() => {
    const initialQuery = new URLSearchParams(window.location.search).get('q');
    if (initialQuery) setSearch(initialQuery);
  }, []);

  useEffect(() => {
    const saved = readResourceFilters();
    if (saved.filter === 'all' || saved.filter === 'book' || saved.filter === 'past_question_pack') setFilter(saved.filter);
    if (saved.priceFilter === 'all' || saved.priceFilter === 'free' || saved.priceFilter === 'paid') setPriceFilter(saved.priceFilter);
    if (typeof saved.categorySlug === 'string' || saved.categorySlug === null) setCategorySlug(saved.categorySlug ?? null);
    if (saved.sort === 'newest' || saved.sort === 'title' || saved.sort === 'free-first' || saved.sort === 'relevance') setSort(saved.sort);
    setDensity(readListDensity('resources'));
    setPrefsReady(true);
  }, []);

  useEffect(() => {
    if (!prefsReady) return;
    writeResourceFilters({ filter, priceFilter, categorySlug, sort });
  }, [filter, priceFilter, categorySlug, sort, prefsReady]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      publicFetchJsonLocalCached<{ enabled?: boolean; resources?: Resource[] }>('/api/resources', PUBLIC_LIST_TTL_MS),
      publicFetchJsonLocalCached<{ categories?: ResourceCategory[] }>('/api/admin/resource-categories', PUBLIC_LIST_TTL_MS).catch(() => ({ categories: [] as ResourceCategory[] })),
    ])
      .then(([resourceData, categoryData]) => {
        if (cancelled) return;
        setEnabled(resourceData.enabled !== false);
        setResources(Array.isArray(resourceData.resources) ? resourceData.resources : []);
        setCategories(Array.isArray(categoryData.categories) ? categoryData.categories : []);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function handleSearchShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.getElementById('resource-search')?.focus();
      }
      if (event.key === 'Escape' && document.activeElement?.id === 'resource-search') {
        if (search) setSearch('');
        else (document.activeElement as HTMLElement | null)?.blur();
      }
    }
    window.addEventListener('keydown', handleSearchShortcut);
    return () => window.removeEventListener('keydown', handleSearchShortcut);
  }, [search]);

  // Category selection is cleared whenever the Book/PQ tab changes because
  // categories are scoped to a resource kind.
  function selectFilter(next: KindFilter) {
    setFilter(next);
    setCategorySlug(null);
  }

  const visibleCategories = useMemo(
    () => categories.filter((category) => filter === 'all' || category.kind === filter),
    [categories, filter],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matches = resources.filter((resource) => {
      if (filter !== 'all' && resource.kind !== filter) return false;
      if (priceFilter !== 'all' && resource.pricing !== priceFilter) return false;
      if (categorySlug && resource.categorySlug !== categorySlug) return false;
      if (!term) return true;
      return [resource.title, resource.description, resource.institutionName, resource.subjectTag, resource.categoryName]
        .some((value) => value?.toLowerCase().includes(term));
    });

    return matches.sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      if (sort === 'free-first' && a.pricing !== b.pricing) return a.pricing === 'free' ? -1 : 1;
      if (sort === 'relevance' && term) {
        const score = (resource: Resource) => {
          const fields = [resource.title, resource.subjectTag, resource.categoryName, resource.institutionName, resource.description].map((value) => (value ?? '').toLowerCase());
          return fields.reduce((total, value, index) => total + (value === term ? 8 : value.startsWith(term) ? 4 : value.includes(term) ? (index === 0 ? 3 : 1) : 0), 0);
        };
        const difference = score(b) - score(a);
        if (difference) return difference;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [resources, filter, priceFilter, categorySlug, search, sort]);

  const hasActiveFilters = Boolean(search.trim() || filter !== 'all' || priceFilter !== 'all' || categorySlug);
  function clearFilters() {
    setSearch('');
    setFilter('all');
    setPriceFilter('all');
    setCategorySlug(null);
    setSort('newest');
    clearResourceFilters();
  }

  // Shared resource links use #resource-{id}. Scroll and briefly highlight the
  // matching card once filtered results have rendered.
  useEffect(() => {
    if (filtered.length === 0) return;
    const hash = window.location.hash;
    if (!hash.startsWith('#resource-')) return;
    const element = document.getElementById(hash.slice(1));
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.classList.add('ring-2', 'ring-pulse-400');
    const timer = window.setTimeout(() => element.classList.remove('ring-2', 'ring-pulse-400'), 2200);
    return () => window.clearTimeout(timer);
  }, [filtered]);

  if (!enabled) {
    return <div className="mx-auto max-w-2xl px-6 py-24 text-center"><LibraryBig className="mx-auto h-8 w-8 text-ink-300" /><h1 className="mt-4 font-display text-2xl font-semibold text-ink-800">Resource library unavailable</h1><p className="mt-2 text-sm text-ink-500">Resources are currently unavailable. Please check back later.</p></div>;
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <section className="relative overflow-hidden rounded-2xl border border-ink-100 bg-gradient-to-br from-pulse-50 via-white to-white p-5 sm:p-8">
        <div className="relative z-10 max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-pulse-100 bg-white/80 px-3 py-1 text-xs font-semibold text-pulse-700"><LibraryBig className="h-3.5 w-3.5" /> Cliniolab study library</p>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">Books &amp; Past Questions</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-600 sm:text-base">Find study guides, e-books, and institution-specific past question packs. Search by title, subject, institution, or category.</p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-md">
            <div className="rounded-xl border border-white bg-white/90 p-3 shadow-sm"><div className="flex items-center gap-2 text-pulse-700"><BookOpen className="h-4 w-4" /><span className="text-xs font-medium">Books</span></div><p className="mt-1 text-xl font-semibold text-ink-900">{resources.filter((resource) => resource.kind === 'book').length}</p></div>
            <div className="rounded-xl border border-white bg-white/90 p-3 shadow-sm"><div className="flex items-center gap-2 text-pulse-700"><FileQuestion className="h-4 w-4" /><span className="text-xs font-medium">Past question packs</span></div><p className="mt-1 text-xl font-semibold text-ink-900">{resources.filter((resource) => resource.kind === 'past_question_pack').length}</p></div>
          </div>
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-pulse-100/60 blur-3xl" />
      </section>

      <section className="sticky top-16 z-20 mt-6 rounded-2xl border border-ink-100 bg-white/95 p-4 shadow-sm backdrop-blur-sm sm:p-5" aria-label="Filter resources">
        <label htmlFor="resource-search" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-ink-500">Search library</label>
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input id="resource-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Try pharmacology, OSCE, or an institution…" className="min-h-11 w-full rounded-lg border border-ink-200 bg-white py-2 pl-10 pr-10 text-sm text-ink-800 outline-none transition placeholder:text-ink-400 focus:border-pulse-400 focus:ring-2 focus:ring-pulse-100" />
            {search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-700"><X className="h-4 w-4" /></button>}
          </div>
          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-ink-200 px-3 text-sm text-ink-600 lg:w-56"><SlidersHorizontal className="h-4 w-4 shrink-0 text-ink-400" /><span className="sr-only">Sort resources</span><select aria-label="Sort resources" value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="min-w-0 flex-1 bg-transparent outline-none"><option value="newest">Newest first</option><option value="title">Title A–Z</option><option value="free-first">Free resources first</option><option value="relevance" disabled={!search.trim()}>Most relevant</option></select></label>
        </div>
        <p className="mt-2 text-xs text-ink-400">Tip: Ctrl/Cmd+K focuses search. Escape clears it. Filter choices are remembered on this device.</p>

        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Resource type">
          {(['all', 'book', 'past_question_pack'] as const).map((kind) => {
            const active = filter === kind;
            const label = kind === 'all' ? 'All resources' : kind === 'book' ? 'Books' : 'Past question packs';
            return <button key={kind} type="button" aria-pressed={active} onClick={() => selectFilter(kind)} className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition ${active ? 'border-pulse-300 bg-pulse-50 text-pulse-700' : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:bg-ink-50'}`}>{label}</button>;
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Price filter">
          {(['all', 'free', 'paid'] as const).map((price) => {
            const active = priceFilter === price;
            const label = price === 'all' ? 'Any price' : price === 'free' ? 'Free' : 'Paid';
            return <button key={price} type="button" aria-pressed={active} onClick={() => setPriceFilter(price)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${active ? 'bg-ink-800 text-white' : 'bg-ink-50 text-ink-600 hover:bg-ink-100'}`}>{label}</button>;
          })}
        </div>

        {visibleCategories.length > 0 && <div className="mt-4 border-t border-ink-100 pt-3"><p className="mb-2 text-xs font-medium text-ink-500">Browse by category</p><div className="flex flex-wrap gap-2"><button type="button" aria-pressed={categorySlug === null} onClick={() => setCategorySlug(null)} className={`rounded-full border px-3 py-1.5 text-xs transition ${categorySlug === null ? 'border-ink-400 bg-ink-50 font-semibold text-ink-800' : 'border-ink-100 text-ink-500 hover:border-ink-300'}`}>All categories</button>{visibleCategories.map((category) => <button key={category.id} type="button" aria-pressed={categorySlug === category.slug} onClick={() => setCategorySlug(category.slug)} className={`rounded-full border px-3 py-1.5 text-xs transition ${categorySlug === category.slug ? 'border-ink-400 bg-ink-50 font-semibold text-ink-800' : 'border-ink-100 text-ink-500 hover:border-ink-300'}`}>{category.name}</button>)}</div></div>}
      </section>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-display text-xl font-semibold text-ink-900">Browse resources</h2><p className="mt-1 text-sm text-ink-500">{loading ? 'Loading the library…' : `${filtered.length} ${filtered.length === 1 ? 'resource' : 'resources'} found`}</p></div>
        <div className="flex flex-wrap items-center gap-2">
          {hasActiveFilters && <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-pulse-700 hover:bg-pulse-50"><X className="h-4 w-4" />Clear filters</button>}
          <button
            type="button"
            onClick={() => {
              const next = density === 'compact' ? 'comfortable' : 'compact';
              setDensity(next);
              writeListDensity('resources', next);
            }}
            className="text-xs font-semibold text-ink-500 hover:text-pulse-700"
            title="Toggle denser card grid (saved on this device)"
          >
            {density === 'compact' ? 'Comfortable view' : 'Compact view'}
          </button>
        </div>
      </div>

      {loading && <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading resources" aria-busy="true">{[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="animate-pulse rounded-xl border border-ink-100 p-4"><div className="h-32 rounded-lg bg-ink-100" /><div className="mt-4 h-3 w-1/3 rounded bg-ink-100" /><div className="mt-3 h-4 w-3/4 rounded bg-ink-100" /><div className="mt-2 h-3 w-full rounded bg-ink-50" /><div className="mt-4 h-9 rounded bg-ink-100" /></div>)}</div>}

      {!loading && loadError && <div className="mt-4 rounded-xl border border-critical-100 bg-critical-50 p-6 text-center"><h3 className="font-semibold text-critical-700">We couldn’t load the resource library</h3><p className="mt-2 text-sm text-critical-600">Check your connection and refresh the page to try again.</p><button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-critical-700 ring-1 ring-critical-200 hover:bg-critical-50">Try again</button></div>}

      {!loading && !loadError && <>
        <div className={`mt-4 grid grid-cols-1 ${density === 'compact' ? 'gap-3 sm:grid-cols-2 xl:grid-cols-4' : 'gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3'}`}>{filtered.map((resource) => <ResourceCard key={resource.id} resource={resource} />)}</div>
        {filtered.length === 0 && <div className="mt-4 rounded-2xl border border-dashed border-ink-200 bg-ink-50/50 px-5 py-12 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-ink-400 shadow-sm"><Search className="h-5 w-5" /></div><h3 className="mt-4 font-semibold text-ink-800">No matching resources</h3><p className="mx-auto mt-1 max-w-md text-sm leading-6 text-ink-500">Try a different keyword or remove one of your filters to see more books and past question packs.</p>{hasActiveFilters && <button type="button" onClick={clearFilters} className="mt-4 rounded-lg bg-pulse-600 px-4 py-2 text-sm font-semibold text-white hover:bg-pulse-700">Show all resources</button>}</div>}
      </>}
    </main>
  );
}
