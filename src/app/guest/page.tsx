import type { Metadata } from 'next';
import { GuestHubClient } from './GuestHubClient';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cliniolab.com';

export const metadata: Metadata = {
  title: 'Guest Practice — Free Quizzes, Study Mode & Flashcards | Cliniolab',
  description:
    'Practice quizzes, study mode and flashcards on Cliniolab without creating an account. Nothing is saved except an anonymous completion count.',
  alternates: { canonical: `${BASE_URL}/guest` },
};

export default function GuestHubPage() {
  return <GuestHubClient />;
}
