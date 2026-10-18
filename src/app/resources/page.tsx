'use client';

// src/app/resources/page.tsx

import { useEffect, useMemo, useState } from 'react';
import { ResourceCard } from '@/components/resources/ResourceCard';
import type { Resource, ResourceCategory } from '@/types';

export default function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [categories, setCategories] = useState<ResourceCategory[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [filter, setFilter] = useState<'all' | 'book' | 'past_question_pack'>('all');
  const [categorySlug, setCategorySlug] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/resources')
      .then((res) => res.json())
      .then((data) => {
        setEnabled(data.enabled);
        setResources(data.resources ?? []);
      });
    fetch('/api/admin/resource-categories')
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []));
  }, []);

  // Category selection is cleared whenever the Book/PQ tab changes, since
  // categories are scoped to a kind and a stale slug from the other tab
  // wouldn't match anything.
  function selectFilter(f: typeof filter) {
    setFilter(f);
    setCategorySlug(null);
  }

  const visibleCategories = useMemo(
    () => categories.filter((c) => filter === 'all' || c.kind === filter),
    [categories, filter]
  );

  const filtered = resources.filter((r) => {
    if (filter !== 'all' && r.kind !== filter) return false;
    if (categorySlug && r.categorySlug !== categorySlug) return false;
    return true;
  });

  // A shared resource link is this page with a #resource-{id} hash (see
  // ResourceCard's ShareButton). Once the matching resource has actually
  // rendered, scroll it into view and briefly highlight it so it's easy
  // to spot among everything else on the page.
  useEffect(() => {
    if (filtered.length === 0) return;
    const hash = window.location.hash;
    if (!hash.startsWith('#resource-')) return;
    const el = document.getElementById(hash.slice(1));
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-2', 'ring-pulse-400');
    const timer = setTimeout(() => el.classList.remove('ring-2', 'ring-pulse-400'), 2000);
    return () => clearTimeout(timer);
  }, [filtered]);

  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <p className="text-sm text-ink-400">Resources are currently unavailable.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-ink-800">Books &amp; Past Questions</h1>
      <p className="mt-2 text-ink-500">
        Study guides, e-books, and institution-specific past question packs.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {(['all', 'book', 'past_question_pack'] as const).map((f) => (
          <button
            key={f}
            onClick={() => selectFilter(f)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
              filter === f ? 'border-pulse-400 bg-pulse-50 text-pulse-700' : 'border-ink-100 text-ink-600'
            }`}
          >
            {f === 'all' ? 'All' : f === 'book' ? 'Books' : 'Past Question Packs'}
          </button>
        ))}
      </div>

      {visibleCategories.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setCategorySlug(null)}
            className={`rounded-full border px-3 py-1 text-xs ${
              categorySlug === null
                ? 'border-ink-400 bg-ink-50 text-ink-700'
                : 'border-ink-100 text-ink-500'
            }`}
          >
            All categories
          </button>
          {visibleCategories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategorySlug(c.slug)}
              className={`rounded-full border px-3 py-1 text-xs ${
                categorySlug === c.slug
                  ? 'border-ink-400 bg-ink-50 text-ink-700'
                  : 'border-ink-100 text-ink-500'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-5">
        {filtered.map((resource) => (
          <ResourceCard key={resource.id} resource={resource} />
        ))}
        {filtered.length === 0 && <p className="col-span-full text-sm text-ink-400">No resources yet.</p>}
      </div>
    </div>
  );
}
