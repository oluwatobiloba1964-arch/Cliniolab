import type { Metadata } from 'next';
import { flashcardService } from '@/lib/db';
import { FlashcardDetailClient } from './FlashcardDetailClient';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cliniolab.com';

interface PageProps {
  params: Promise<{ setId: string }>;
}

function formatPrice(pricing: 'free' | 'paid', priceKobo: number | null): string {
  if (pricing === 'free' || !priceKobo) return 'Free';
  return `₦${(priceKobo / 100).toLocaleString('en-NG')}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { setId } = await params;
  const set = await flashcardService.getFlashcardSetById(setId).catch(() => null);

  if (!set || set.visibility !== 'public') {
    return { title: 'Flashcards' };
  }

  const title = `${set.title} · Flashcards | Cliniolab`;
  const price = formatPrice(set.pricing, set.priceKobo);
  const description = set.description?.slice(0, 140)
    ? `${set.description.slice(0, 140)} · Price: ${price}`
    : `Study ${set.title} with flip-card flashcards on Cliniolab. Price: ${price}`;

  return {
    title,
    description,
    alternates: { canonical: `${BASE_URL}/flashcards/${set.id}` },
    openGraph: { title, description, type: 'website', url: `${BASE_URL}/flashcards/${set.id}` },
    twitter: { card: 'summary', title, description },
  };
}

export default async function FlashcardSetDetailPage({ params }: PageProps) {
  const { setId } = await params;
  return <FlashcardDetailClient setId={setId} />;
}
