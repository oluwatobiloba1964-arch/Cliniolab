import type { Metadata } from 'next';
import { quizService } from '@/lib/db';
import { QuizzesClient } from './QuizzesClient';

export const revalidate = 300;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cliniolab.com';
const PAGE_SIZE = 12;

export const metadata: Metadata = {
  title: 'Latest Quizzes | Cliniolab',
  description:
    'Browse the latest clinical exam practice quizzes on Cliniolab.',
  alternates: { canonical: `${BASE_URL}/quizzes` },
  openGraph: {
    title: 'Latest Quizzes | Cliniolab',
    description:
      'Browse the latest clinical exam practice quizzes on Cliniolab.',
    type: 'website',
    url: `${BASE_URL}/quizzes`,
  },
};

export default async function QuizzesPage() {
  const initial = await quizService
    .listLatestPublicQuizzesPaginated(1, PAGE_SIZE)
    .catch(() => ({ quizzes: [], total: 0, page: 1, pageSize: PAGE_SIZE }));

  return (
    <QuizzesClient
      initialQuizzes={initial.quizzes}
      initialTotal={initial.total}
      pageSize={PAGE_SIZE}
    />
  );
}
