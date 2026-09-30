import type { Metadata } from 'next';
import { guestService } from '@/lib/db';
import { GuestFlashcardClient } from './GuestFlashcardClient';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cliniolab.com';

interface PageProps {
  params: Promise<{ setId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { setId } = await params;
  const set = await guestService.getGuestFlashcardSet(setId).catch(() => null);
  if (!set) return { title: 'Guest Practice | Cliniolab' };
  const title = `${set.title} — Flashcards (Guest Practice) | Cliniolab`;
  const description = set.description?.slice(0, 150) || `Study ${set.title} for free, no account needed, on Cliniolab.`;
  return {
    title,
    description,
    alternates: { canonical: `${BASE_URL}/guest/flashcards/${set.id}` },
  };
}

export default async function GuestFlashcardPage({ params }: PageProps) {
  const { setId } = await params;
  return <GuestFlashcardClient setId={setId} />;
}
