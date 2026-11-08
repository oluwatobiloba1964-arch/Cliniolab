'use client';
// File: src/components/layout/ScholarOfTheDayCard.tsx

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import type { ScholarOfTheDay } from '@/types';
import { getSiteWidgets } from '@/lib/client/siteWidgets';

export function ScholarOfTheDayCard() {
  const [scholar, setScholar] = useState<ScholarOfTheDay | null>(null);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    getSiteWidgets()
      .then((data) => {
        setEnabled(data.scholar.enabled);
        setScholar(data.scholar.scholar);
      })
      .catch(() => {});
  }, []);

  if (!enabled || !scholar) return null;

  return (
    <section className="border-y border-ink-100 bg-white">
      <div className="mx-auto max-w-3xl px-4 py-10 text-center sm:px-6 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-wide text-pulse-600">Scholar of the Day</p>
        <Card className="mt-4 p-5 sm:p-8">
          {scholar.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={scholar.photoUrl}
              alt={`Profile photo of ${scholar.name}`}
              loading="lazy"
              decoding="async"
              className="mx-auto h-20 w-20 rounded-full bg-ink-50 object-contain sm:h-24 sm:w-24"
            />
          ) : (
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-pulse-50 text-2xl font-semibold text-pulse-600 sm:h-24 sm:w-24">
              {scholar.name.charAt(0)}
            </div>
          )}
          <h3 className="mt-4 font-display text-lg font-semibold text-ink-800 sm:text-xl">{scholar.name}</h3>
          {scholar.achievement && (
            <p className="mt-1 text-sm font-medium text-pulse-600">{scholar.achievement}</p>
          )}
          {scholar.bio && <p className="mt-3 text-sm leading-6 text-ink-500">{scholar.bio}</p>}
          {scholar.quote && (
            <p className="mt-4 text-sm italic leading-6 text-ink-400">&ldquo;{scholar.quote}&rdquo;</p>
          )}
        </Card>
      </div>
    </section>
  );
}
