// src/app/quizzes/[quizId]/page.tsx
import type { Metadata } from 'next';
import { quizService } from '@/lib/db';
import { getQuizzesWithStatsByIds } from '@/lib/db/services/quizService';
import { QuizDetailClient } from './QuizDetailClient';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cliniolab.com';

interface PageProps {
  params: Promise<{ quizId: string }>;
}

const MODE_LABELS: Record<string, string> = {
  study: 'Study Mode',
  quiz: 'Quiz',
  exam: 'CBT Exam',
};

const RETAKE_LABELS: Record<string, (limit: number | null) => string> = {
  unlimited: () => 'Unlimited attempts',
  single: () => '1 attempt',
  daily_limit: (limit) => `${limit ?? 1} attempt${limit === 1 ? '' : 's'} per day`,
  cooldown: (limit) => `${limit ?? 1} attempt${limit === 1 ? '' : 's'} (cooldown applies)`,
};

function formatPrice(pricing: 'free' | 'paid', priceKobo: number | null): string {
  if (pricing === 'free' || !priceKobo) return 'Free';
  return `₦${(priceKobo / 100).toLocaleString('en-NG')}`;
}

function formatTime(seconds: number | null): string | null {
  if (!seconds) return null;
  const totalMinutes = Math.round(seconds / 60);
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hrs > 0) return `${hrs}h${mins > 0 ? ` ${mins}m` : ''}`;
  return `${mins} min`;
}

/**
 * Per-quiz metadata, generated server-side. This is the highest-value SEO
 * surface on the whole platform - people searching a specific clinical
 * topic ("pharmacology dosage calculation quiz", "UBTH nursing entrance
 * past questions") land on one quiz page, not the homepage. The OG
 * description also doubles as the "shareable preview card" info
 * (price, time, question count, attempts) so links unfurl richly in
 * WhatsApp/Telegram/Twitter, similar to QuizzerWeb's quiz preview cards.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { quizId } = await params;
  const quiz = await quizService.getQuizById(quizId).catch(() => null);

  if (!quiz || quiz.visibility !== 'public') {
    // Private/missing quizzes get a neutral title rather than leaking
    // their existence or content via search engine metadata.
    return { title: 'Quiz' };
  }

  const modeLabel = MODE_LABELS[quiz.mode] ?? 'Quiz';
  const title = `${quiz.title} — ${modeLabel} | Cliniolab`;

  // Pull stats (question count, creator, price, retake policy) the same
  // way the bookmarks page does, so the OG card matches what's shown
  // on-page rather than only the base quiz description.
  const [withStats] = await getQuizzesWithStatsByIds([quiz.id]).catch(() => []);

  const price = formatPrice(quiz.pricing, quiz.priceKobo);
  const time = formatTime(quiz.timeLimitSeconds);
  const attempts = RETAKE_LABELS[quiz.retakePolicy]?.(quiz.retakeLimit) ?? 'See quiz for attempt limit';

  const statsLine = [
    `By ${withStats?.creatorName ?? 'Cliniolab'}`,
    modeLabel,
    `Price: ${price}`,
    time ? `Time: ${time}` : null,
    withStats ? `${withStats.questionCount} question${withStats.questionCount === 1 ? '' : 's'}` : null,
    attempts,
  ]
    .filter(Boolean)
    .join(' · ');

  const description = quiz.description?.slice(0, 140)
    ? `${quiz.description.slice(0, 140)} — ${statsLine}`
    : `${statsLine}. Practice ${quiz.title} on Cliniolab, a nursing and clinical exam practice platform.`;

  return {
    title,
    description,
    alternates: { canonical: `${BASE_URL}/quizzes/${quiz.id}` },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${BASE_URL}/quizzes/${quiz.id}`,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
    // Paid quizzes: still indexable (the listing itself is legitimate
    // content), but noindex would be the wrong call here since the title/
    // price page has standalone value; only the questions are gated.
  };
}

export default async function QuizDetailPage({ params }: PageProps) {
  const { quizId } = await params;

  // Public preview stats (price, time, question count, attempts, creator)
  // fetched server-side so they're visible on first paint, matching the
  // QuizzerWeb-style summary card, and available even before the
  // login-gated client fetch resolves. Only fetched for public quizzes -
  // private ones keep their existing gated flow untouched.
  const quiz = await quizService.getQuizById(quizId).catch(() => null);
  const previewStats =
    quiz && (quiz.visibility === 'public' || quiz.visibility === 'guest')
      ? (await getQuizzesWithStatsByIds([quizId]).catch(() => []))[0] ?? null
      : null;

  return <QuizDetailClient quizId={quizId} previewStats={previewStats} />;
}
