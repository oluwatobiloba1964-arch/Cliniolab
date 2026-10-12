import type { Metadata } from 'next';
import { featureFlagService, flashcardService } from '@/lib/db';
import { FlashcardsClient } from './FlashcardsClient';

export const revalidate = 300;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cliniolab.com';
const PAGE_SIZE = 12;

export const metadata: Metadata = {
  title: 'Flashcards | Cliniolab',
  description:
    'Browse public nursing and clinical exam flashcard sets on Cliniolab.',
  alternates: { canonical: `${BASE_URL}/flashcards` },
  openGraph: {
    title: 'Flashcards | Cliniolab',
    description:
      'Browse public nursing and clinical exam flashcard sets on Cliniolab.',
    type: 'website',
    url: `${BASE_URL}/flashcards`,
  },
};

export default async function FlashcardsPage() {
  const enabled = await featureFlagService.isFeatureEnabled('flashcards').catch(() => true);

  if (!enabled) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Flashcards unavailable</h1>
        <p className="mt-2 text-ink-500">This feature is currently turned off.</p>
      </div>
    );
  }

  const initial = await flashcardService
    .listLatestPublicFlashcardSetsPaginated(1, PAGE_SIZE)
    .catch(() => ({ sets: [], total: 0, page: 1, pageSize: PAGE_SIZE }));

  return (
    <FlashcardsClient
      initialSets={initial.sets}
      initialTotal={initial.total}
      pageSize={PAGE_SIZE}
    />
  );
}
