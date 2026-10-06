'use client';
// File: src/components/layout/AbbreviationsTeaser.tsx

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import type { MedicalAbbreviation } from '@/types';
import { getSiteWidgets } from '@/lib/client/siteWidgets';

export function AbbreviationsTeaser() {
  const [abbreviations, setAbbreviations] = useState<MedicalAbbreviation[]>([]);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    getSiteWidgets()
      .then((data) => {
        setEnabled(data.abbreviations.enabled);
        setAbbreviations(data.abbreviations.items ?? []);
      })
      .catch(() => {});
  }, []);

  if (!enabled || abbreviations.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold text-ink-800">Abbreviations &amp; Glossary</h2>
        <Link href="/abbreviations" className="text-sm font-medium text-pulse-600 hover:text-pulse-700">
          See all →
        </Link>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {abbreviations.map((a) => (
          <Card key={a.id} className="p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
              <span
                className={`shrink-0 break-words font-mono text-sm font-semibold ${
                  a.isGlossary ? 'text-ink-700' : 'text-pulse-600'
                }`}
              >
                {a.abbreviation}
              </span>
              <p className="min-w-0 break-words text-sm text-ink-600">{a.meaning}</p>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
