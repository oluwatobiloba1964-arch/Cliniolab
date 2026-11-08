// File: src/app/mnemonics/page.tsx
// Mnemonics library route. Pure client-side after hydration: no fetch,
// no API call, no database read. Reads the bundled mnemonics data and
// renders an interactive, star-able, filterable list.

import type { Metadata } from 'next';
import { MnemonicsClient } from './MnemonicsClient';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cliniolab.com';

export const metadata: Metadata = {
  title: 'Mnemonics · Cliniolab',
  description: 'A hand-curated library of nursing and clinical mnemonics for revision. Star your favourites and filter by category.',
  alternates: { canonical: `${BASE_URL}/mnemonics` },
  openGraph: {
    title: 'Mnemonics · Cliniolab',
    description: 'A hand-curated library of nursing and clinical mnemonics for revision. Star your favourites and filter by category.',
    url: `${BASE_URL}/mnemonics`,
    type: 'website',
  },
};

export default function MnemonicsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pulse-600">Memory aids</p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-ink-800 sm:text-4xl">Clinical mnemonics</h1>
        <p className="mt-2 text-sm leading-7 text-ink-500">
          A focused library of mnemonics that cover the topics that come up again and again on nursing and clinical exams.
          Star the ones you want to revisit before an exam, and filter by category.
        </p>
      </header>
      <div className="mt-8">
        <MnemonicsClient />
      </div>
    </div>
  );
}
