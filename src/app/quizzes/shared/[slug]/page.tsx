import type { Metadata } from 'next';
import { quizService } from '@/lib/db';
import { getQuizzesWithStatsByIds } from '@/lib/db/services/quizService';
import { SharedQuizClient } from './SharedQuizClient';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cliniolab.com';

interface PageProps {
  params: Promise<{ slug: string }>;
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
 * Per-shared-quiz metadata, generated server-side, same idea as the public
 * quiz page's generateMetadata. A share link is still meant to be posted
 * into groups/DMs, so it should unfurl with the same rich preview card
 * (price, time, question count, attempts) — only the *questions* stay
 * behind login/the slug, never the summary shown here.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const quiz = await quizService.getQuizByShareSlug(slug).catch(() => null);

  if (!quiz) {
    // Invalid/expired slugs get a neutral title rather than leaking
    // whether a quiz ever existed at this link.
    return { title: 'Quiz' };
  }

  const modeLabel = MODE_LABELS[quiz.mode] ?? 'Quiz';
  const title = `${quiz.title} · ${modeLabel} | Cliniolab`;

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
    ? `${quiz.description.slice(0, 140)} · ${statsLine}`
    : `${statsLine}. Practice ${quiz.title} on Cliniolab, a nursing and clinical exam practice platform.`;

  return {
    title,
    description,
    // Private links shouldn't be indexed/crawled even though the preview
    // card itself is rich — unlike public quiz pages.
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${BASE_URL}/quizzes/shared/${slug}`,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default function SharedQuizPage() {
  return <SharedQuizClient />;
}
