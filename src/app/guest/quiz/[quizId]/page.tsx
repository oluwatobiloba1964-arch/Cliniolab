import type { Metadata } from 'next';
import { guestService } from '@/lib/db';
import { GuestQuizClient } from './GuestQuizClient';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cliniolab.com';

interface PageProps {
  params: Promise<{ quizId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { quizId } = await params;
  const quiz = await guestService.getGuestQuiz(quizId).catch(() => null);
  if (!quiz) return { title: 'Guest Practice | Cliniolab' };
  const title = `${quiz.title} (Guest Practice) | Cliniolab`;
  const description =
    quiz.description?.slice(0, 150) || `Practice ${quiz.title} for free, no account needed, on Cliniolab.`;
  return {
    title,
    description,
    alternates: { canonical: `${BASE_URL}/guest/quiz/${quiz.id}` },
    openGraph: { title, description, type: 'website', url: `${BASE_URL}/guest/quiz/${quiz.id}` },
  };
}

export default async function GuestQuizPage({ params }: PageProps) {
  const { quizId } = await params;
  return <GuestQuizClient quizId={quizId} />;
}
