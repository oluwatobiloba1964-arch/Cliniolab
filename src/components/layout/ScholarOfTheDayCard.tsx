// src/components/layout/ScholarOfTheDayCard.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import type { ScholarOfTheDay } from '@/types';
import { publicFetchJson } from '@/lib/client/publicFetch';

export function ScholarOfTheDayCard() {
  const [scholar, setScholar] = useState<ScholarOfTheDay | null>(null);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    Promise.all([
      publicFetchJson<{ enabled?: boolean }>('/api/flags/scholar_of_the_day', 60_000),
      publicFetchJson<{ scholar: ScholarOfTheDay | null }>('/api/scholars/active', 300_000),
    ])
      .then(([flag, data]) => {
        setEnabled(flag.enabled !== false);
        setScholar(data.scholar);
      })
      .catch(() => {});
  }, []);

  if (!enabled || !scholar) return null;

  return (
    <section className="border-y border-ink-100 bg-white">
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-pulse-600">Scholar of the Day</p>
        <Card className="mt-4 p-8">
          {scholar.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={scholar.photoUrl}
              alt={scholar.name}
              className="mx-auto h-24 w-24 rounded-full bg-ink-50 object-contain"
            />
          ) : (
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-pulse-50 text-2xl font-semibold text-pulse-600">
              {scholar.name.charAt(0)}
            </div>
          )}
          <h3 className="mt-4 font-display text-xl font-semibold text-ink-800">{scholar.name}</h3>
          {scholar.achievement && (
            <p className="mt-1 text-sm font-medium text-pulse-600">{scholar.achievement}</p>
          )}
          {scholar.bio && <p className="mt-3 text-sm text-ink-500">{scholar.bio}</p>}
          {scholar.quote && (
            <p className="mt-4 text-sm italic text-ink-400">&ldquo;{scholar.quote}&rdquo;</p>
          )}
        </Card>
      </div>
    </section>
  );
}
