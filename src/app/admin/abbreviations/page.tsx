'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { MedicalAbbreviation } from '@/types';

type Filter = 'all' | 'abbreviation' | 'glossary';

export default function AdminAbbreviationsPage() {
  const [abbreviations, setAbbreviations] = useState<MedicalAbbreviation[]>([]);
  const [abbreviation, setAbbreviation] = useState('');
  const [meaning, setMeaning] = useState('');
  const [category, setCategory] = useState('');
  const [isGlossary, setIsGlossary] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const pageSize = 40;

  function load() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (filter !== 'all') params.set('kind', filter);
    fetch(`/api/abbreviations?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setAbbreviations(data.abbreviations ?? []);
        setTotalPages(data.totalPages ?? 1);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [filter, page]);

  function changeFilter(f: Filter) {
    setFilter(f);
    setPage(1);
  }

  function startEdit(a: MedicalAbbreviation) {
    setEditingId(a.id);
    setAbbreviation(a.abbreviation);
    setMeaning(a.meaning);
    setCategory(a.category ?? '');
    setIsGlossary(a.isGlossary);
  }

  function resetForm() {
    setEditingId(null);
    setAbbreviation('');
    setMeaning('');
    setCategory('');
    setIsGlossary(false);
  }

  async function save() {
    if (!abbreviation.trim() || !meaning.trim()) return;
    setError(null);
    const payload = { abbreviation, meaning, category: category || undefined, isGlossary };
    const res = editingId
      ? await fetch(`/api/abbreviations/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      : await fetch('/api/abbreviations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

    if (res.ok) {
      resetForm();
      load();
    } else {
      const data = await res.json();
      setError(data.error);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this entry?')) return;
    const res = await fetch(`/api/abbreviations/${id}`, { method: 'DELETE' });
    if (res.ok) load();
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-800">Abbreviations &amp; Glossary</h1>
          <p className="mt-1 text-sm text-ink-500">
            Short abbreviations (e.g. NPO) and full glossary terms (e.g. Homeostasis) live in one
            list. Entered manually or via bulk upload, because a wrong entry in a clinical glossary is a
            real risk, so double-check before saving. Turn the page and homepage widget on/off
            from Feature Flags.
          </p>
        </div>
        <Link href="/admin/abbreviations/bulk-upload">
          <Button variant="secondary" size="sm">Bulk upload</Button>
        </Link>
      </div>

      <Card className="mt-6 space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-medium text-ink-700">
            <input
              type="radio"
              checked={!isGlossary}
              onChange={() => setIsGlossary(false)}
              className="accent-pulse-500"
            />
            Abbreviation
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-ink-700">
            <input
              type="radio"
              checked={isGlossary}
              onChange={() => setIsGlossary(true)}
              className="accent-pulse-500"
            />
            Glossary term
          </label>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            value={abbreviation}
            onChange={(e) => setAbbreviation(e.target.value)}
            placeholder={isGlossary ? 'Term, e.g. Homeostasis' : 'Abbreviation, e.g. NPO'}
            className="rounded-md border border-ink-100 px-3 py-1.5 text-sm focus:border-pulse-400 focus:outline-none"
          />
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category (optional)"
            className="rounded-md border border-ink-100 px-3 py-1.5 text-sm focus:border-pulse-400 focus:outline-none"
          />
          <Button size="sm" onClick={save}>{editingId ? 'Save changes' : 'Add entry'}</Button>
        </div>
        <textarea
          value={meaning}
          onChange={(e) => setMeaning(e.target.value)}
          placeholder={
            isGlossary
              ? 'Full definition, e.g. The body\u2019s tendency to maintain a stable internal environment'
              : 'Full meaning, e.g. Nil per os (nothing by mouth)'
          }
          rows={2}
          className="w-full rounded-md border border-ink-100 px-3 py-1.5 text-sm focus:border-pulse-400 focus:outline-none"
        />
        {editingId && (
          <button onClick={resetForm} className="text-xs text-ink-400 hover:text-ink-600">
            Cancel editing
          </button>
        )}
        {error && <p className="text-sm text-critical-500">{error}</p>}
      </Card>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {(['all', 'abbreviation', 'glossary'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => changeFilter(f)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                filter === f ? 'bg-pulse-50 text-pulse-700' : 'text-ink-500 hover:bg-ink-50'
              }`}
            >
              {f === 'all' ? 'All' : f === 'abbreviation' ? 'Abbreviations' : 'Glossary terms'}
            </button>
          ))}
        </div>
        {total > 0 && (
          <p className="text-xs text-ink-400">
            {total} {total === 1 ? 'entry' : 'entries'}
          </p>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {loading && (
          <p className="text-sm text-ink-400">Loading…</p>
        )}
        {!loading && abbreviations.map((a) => (
          <Card key={a.id} className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-4 sm:min-w-0">
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
              <div className="flex shrink-0 gap-3 sm:gap-2">
                <button onClick={() => startEdit(a)} className="text-xs font-medium text-pulse-600 hover:text-pulse-700">
                  Edit
                </button>
                <button onClick={() => remove(a.id)} className="text-xs font-medium text-critical-500 hover:text-critical-600">
                  Delete
                </button>
              </div>
            </div>
          </Card>
        ))}
        {!loading && abbreviations.length === 0 && <p className="text-sm text-ink-400">No entries yet.</p>}
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
          >
            Previous
          </Button>
          <span className="text-xs text-ink-500">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
