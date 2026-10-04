'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import type { MedicalAbbreviation } from '@/types';
import { publicFetchJson } from '@/lib/client/publicFetch';

const PAGE_SIZE = 40;

type Filter = 'all' | 'abbreviation' | 'glossary';

export default function AbbreviationsPage() {
  const [abbreviations, setAbbreviations] = useState<MedicalAbbreviation[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    publicFetchJson<{ enabled?: boolean }>('/api/flags/medical_abbreviations', 60_000)
      .then((data) => setEnabled(data.enabled !== false))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Reset back to page 1 whenever the search term or filter changes.
  useEffect(() => {
    setPage(1);
  }, [search, filter]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filter !== 'all') params.set('kind', filter);
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));

      publicFetchJson<{ abbreviations?: MedicalAbbreviation[]; totalPages?: number; total?: number }>(`/api/abbreviations?${params.toString()}`, 30_000)
        .then((data) => {
          setAbbreviations(data.abbreviations ?? []);
          setTotalPages(data.totalPages ?? 1);
          setTotal(data.total ?? 0);
        });
    }, 200); // small debounce so typing doesn't fire a request per keystroke
    return () => clearTimeout(timeout);
  }, [search, filter, page]);

  if (loaded && !enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Medical Abbreviations</h1>
        <p className="mt-2 text-ink-500">This page isn&apos;t available right now.</p>
      </div>
    );
  }

  // Windowed page-number list: current page ± 2, plus first/last, with
  // "…" gaps  -  standard so it doesn't sprawl to 40+ buttons on a big list.
  const pageNumbers = (() => {
    const nums: (number | 'ellipsis')[] = [];
    const add = (n: number) => nums.push(n);
    const window = 2;
    for (let n = 1; n <= totalPages; n++) {
      if (n === 1 || n === totalPages || (n >= page - window && n <= page + window)) {
        add(n);
      } else if (nums[nums.length - 1] !== 'ellipsis') {
        nums.push('ellipsis');
      }
    }
    return nums;
  })();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-ink-800">Abbreviations &amp; Glossary</h1>
      <p className="mt-2 text-ink-500">
        A quick-reference glossary of common clinical abbreviations and terms.
      </p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search a term or meaning…"
        className="mt-6 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
      />

      <div className="mt-4 flex gap-2">
        {(['all', 'abbreviation', 'glossary'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              filter === f ? 'bg-pulse-50 text-pulse-700' : 'text-ink-500 hover:bg-ink-50'
            }`}
          >
            {f === 'all' ? 'All' : f === 'abbreviation' ? 'Abbreviations' : 'Glossary terms'}
          </button>
        ))}
      </div>

      {total > 0 && (
        <p className="mt-4 text-xs text-ink-400">
          {total} entr{total === 1 ? 'y' : 'ies'}
          {totalPages > 1 ? `  -  page ${page} of ${totalPages}` : ''}
        </p>
      )}

      <div className="mt-3 space-y-2">
        {abbreviations.map((a) => (
          <Card key={a.id} className="p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-4">
              <span
                className={`shrink-0 rounded font-mono text-sm font-semibold break-words ${
                  a.isGlossary ? 'text-ink-700' : 'text-pulse-600 sm:w-20'
                }`}
              >
                {a.abbreviation}
              </span>
              <div className="min-w-0">
                <p className="text-sm text-ink-700 break-words">{a.meaning}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  {a.isGlossary && (
                    <span className="rounded bg-ink-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-400">
                      Glossary
                    </span>
                  )}
                  {a.category && <p className="text-xs text-ink-400">{a.category}</p>}
                </div>
              </div>
            </div>
          </Card>
        ))}
        {abbreviations.length === 0 && (
          <p className="text-sm text-ink-400">
            {search ? 'No matches found.' : 'No entries added yet.'}
          </p>
        )}
      </div>

      {totalPages > 1 && (
        <nav className="mt-8 flex flex-wrap items-center justify-center gap-1.5" aria-label="Pagination">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-500 hover:bg-ink-50 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            Prev
          </button>
          {pageNumbers.map((n, i) =>
            n === 'ellipsis' ? (
              <span key={`e${i}`} className="px-2 text-sm text-ink-300">
                …
              </span>
            ) : (
              <button
                key={n}
                onClick={() => setPage(n)}
                aria-current={n === page ? 'page' : undefined}
                className={`min-w-[2.25rem] rounded-md px-2.5 py-1.5 text-sm font-medium ${
                  n === page ? 'bg-pulse-600 text-white' : 'text-ink-600 hover:bg-ink-50'
                }`}
              >
                {n}
              </button>
            )
          )}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-500 hover:bg-ink-50 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}
