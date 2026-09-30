'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, DifficultyBadge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { usePublicConfig } from '@/lib/hooks/usePublicConfig';
import type { GuestItem, GuestItemKind } from '@/lib/db/services/guestService';

const KIND_LABEL: Record<GuestItem['kind'], string> = {
  quiz: 'Quiz',
  study: 'Study Mode',
  flashcards: 'Flashcards',
};

const FILTERS: { key: GuestItemKind | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'quiz', label: 'Quiz' },
  { key: 'study', label: 'Study Mode' },
  { key: 'flashcards', label: 'Flashcards' },
];

const PAGE_SIZE = 24;

export function GuestHubClient() {
  const { flags } = usePublicConfig();
  const [items, setItems] = useState<GuestItem[]>([]);
  const [total, setTotal] = useState(0);
  const [kind, setKind] = useState<GuestItemKind | 'all'>('all');
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (kind !== 'all') params.set('kind', kind);
    fetch(`/api/guest/items?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : { items: [], total: 0 }))
      .then((data) => {
        setItems((prev) => (offset === 0 ? data.items ?? [] : [...prev, ...(data.items ?? [])]));
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [kind, offset]);

  if (!flags.guestPractice) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Guest Practice is unavailable</h1>
        <p className="mt-2 text-ink-500">
          <Link href="/register" className="text-pulse-600 underline">Create a free account</Link> to keep practicing.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-14">
      <h1 className="font-display text-3xl font-semibold text-ink-800">Guest Practice</h1>
      <p className="mt-2 max-w-2xl text-ink-500">
        Try quizzes, study mode and flashcards right now. No account needed, and nothing is saved.
      </p>

      <div className="mt-6 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => {
              setKind(f.key);
              setOffset(0);
            }}
            className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm ${kind === f.key ? 'border-pulse-400 bg-pulse-50 text-pulse-700' : 'border-ink-100 text-ink-600 hover:border-pulse-400'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {items.length === 0 && !loading ? (
        <p className="mt-12 text-center text-ink-400">No guest items available right now. Check back soon.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Link key={`${item.kind}-${item.id}`} href={item.href}>
              <Card className="h-full p-5 transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-pulse-50 px-2 py-0.5 text-xs font-semibold text-pulse-600">
                    {KIND_LABEL[item.kind]}
                  </span>
                  {item.difficulty && <DifficultyBadge difficulty={item.difficulty as 'easy' | 'medium' | 'hard'} />}
                </div>
                <h3 className="mt-3 line-clamp-2 font-display text-lg font-semibold text-ink-800">{item.title}</h3>
                <p className="mt-1 text-xs text-ink-400">
                  {item.categoryName} · {item.subcategoryName}
                </p>
                <p className="mt-3 text-xs text-ink-500">
                  {item.itemCount} {item.kind === 'flashcards' ? 'cards' : 'questions'}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {items.length < total && (
        <div className="mt-8 text-center">
          <Button variant="secondary" onClick={() => setOffset((o) => o + PAGE_SIZE)} disabled={loading}>
            {loading ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}

      <p className="mt-12 text-center text-sm text-ink-400">
        Want to save your progress, earn certificates and join the leaderboard?{' '}
        <Link href="/register" className="text-pulse-600 underline">Create a free account</Link>
      </p>
    </div>
  );
}
