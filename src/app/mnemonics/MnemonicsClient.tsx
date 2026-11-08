// File: src/app/mnemonics/MnemonicsClient.tsx
// Pure client-side component for the mnemonics page. Reads the bundled
// mnemonics data and renders an interactive, star-able, filterable
// list. No fetch, no API call, no database read.

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Filter, Star, StarOff } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { MNEMONICS, MNEMONIC_CATEGORIES, type MnemonicCategory } from '@/lib/data/mnemonics';
import { getStarredIds, isStarred, toggleStar } from '@/lib/services/mnemonicsStarService';

export function MnemonicsClient() {
  const [category, setCategory] = useState<MnemonicCategory | 'all'>('all');
  const [starredOnly, setStarredOnly] = useState(false);
  const [starredVersion, setStarredVersion] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const filtered = useMemo(() => {
    return MNEMONICS.filter((m) => {
      if (category !== 'all' && m.category !== category) return false;
      if (starredOnly && mounted && !isStarred(m.id)) return false;
      return true;
    });
  }, [category, starredOnly, mounted, starredVersion]);

  function handleToggleStar(id: string) {
    toggleStar(id);
    setStarredVersion((v) => v + 1);
  }

  const starredCount = mounted ? getStarredIds().length : 0;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-ink-100 bg-white p-3 shadow-sm">
        <Filter className="h-4 w-4 text-ink-400" aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">Filter:</span>
        <button
          type="button"
          onClick={() => setCategory('all')}
          aria-pressed={category === 'all'}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            category === 'all' ? 'bg-pulse-600 text-white' : 'bg-ink-50 text-ink-600 hover:bg-ink-100'
          }`}
        >
          All
        </button>
        {MNEMONIC_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            aria-pressed={category === cat}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              category === cat ? 'bg-pulse-600 text-white' : 'bg-ink-50 text-ink-600 hover:bg-ink-100'
            }`}
          >
            {cat}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setStarredOnly((v) => !v)}
          aria-pressed={starredOnly}
          className="ml-auto inline-flex items-center gap-1 rounded-full border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-600 transition hover:border-pulse-300 hover:text-pulse-700"
        >
          <Star className="h-3.5 w-3.5" aria-hidden="true" />
          {starredOnly ? 'Starred only' : 'Starred'} {mounted && starredCount > 0 && (
            <span className="rounded-full bg-pulse-100 px-1.5 text-pulse-700">{starredCount}</span>
          )}
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {filtered.map((m) => {
          const starred = mounted && isStarred(m.id);
          return (
            <Card key={m.id} className="overflow-hidden p-0">
              <div className="flex items-start justify-between gap-3 border-b border-ink-100 bg-ink-50/40 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">{m.category}</p>
                  <h2 className="mt-0.5 font-display text-xl font-semibold text-ink-900">{m.title}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleStar(m.id)}
                  aria-pressed={starred}
                  aria-label={starred ? `Remove ${m.title} from starred mnemonics` : `Add ${m.title} to starred mnemonics`}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-500 transition hover:border-pulse-300 hover:text-pulse-600"
                >
                  {starred ? <Star className="h-4 w-4 fill-pulse-500 text-pulse-500" aria-hidden="true" /> : <StarOff className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
              <ol className="px-4 py-3">
                {m.letters.map((entry, index) => (
                  <li key={`${entry.letter}-${index}`} className="flex items-start gap-3 py-2">
                    <span
                      aria-hidden="true"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pulse-600 font-mono text-xs font-bold text-white"
                    >
                      {entry.letter}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink-800">{entry.word}</p>
                      <p className="text-xs leading-5 text-ink-500">{entry.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="border-t border-ink-100 bg-ink-50/40 px-4 py-3 text-xs leading-5 text-ink-500">
                {m.note}
              </p>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-ink-200 bg-white px-6 py-12 text-center">
          <p className="font-semibold text-ink-700">No starred mnemonics yet.</p>
          <p className="mt-1 text-sm text-ink-400">Tap the star icon on a mnemonic to save it here for quick revision before an exam.</p>
        </div>
      )}
    </div>
  );
}
