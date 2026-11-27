import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { ShareButton } from '@/components/quiz/ShareButton';
import { BookmarkButton } from '@/components/ui/BookmarkButton';
import type { FlashcardSetWithStats } from '@/types';
import { flashcardSetPath } from '@/lib/utils/flashcardUrl';

function shareStats(set: FlashcardSetWithStats) {
  return {
    creatorName: set.creatorName,
    pricing: set.pricing,
    priceKobo: set.priceKobo,
    questionCount: set.cardCount,
    categoryName: set.categoryName,
    subcategoryName: set.subcategoryName,
  };
}

export function FlashcardSetCard({ set }: { set: FlashcardSetWithStats }) {
  return (
    <Link href={flashcardSetPath(set)}>
      <Card className="border-l-4 border-l-pulse-300 p-5 transition-shadow hover:shadow-md">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-lg font-semibold text-ink-800">{set.title}</h3>
          <div className="flex items-center gap-2">
            {set.pricing === 'paid' && (
              <span className="rounded bg-flag-50 px-2 py-0.5 text-xs font-semibold text-flag-600">Paid</span>
            )}
            <span className="rounded bg-pulse-50 px-2 py-0.5 text-xs font-semibold text-pulse-600">Flashcard</span>
            <BookmarkButton kind="flashcard" targetId={set.id} />
          </div>
        </div>
        {set.description && (
          <p className="mt-1 line-clamp-2 text-sm text-ink-500">{set.description}</p>
        )}
        <div className="mt-4 flex items-center gap-4 font-mono text-xs text-ink-400">
          <span>{set.cardCount} cards</span>
          <span title="Number of completed study sessions">{set.attemptCount} attempts</span>
        </div>
        {(set.categoryName || set.subcategoryName) && (
          <div className="mt-3 text-xs text-ink-400">
            {set.categoryName} {set.subcategoryName ? `· ${set.subcategoryName}` : ''}
          </div>
        )}
        {set.creatorName && <div className="mt-1 text-xs text-ink-400">By {set.creatorName}</div>}
        {set.visibility === 'public' && (
          <div className="mt-3" onClick={(e) => e.preventDefault()}>
            <ShareButton
              url={typeof window !== 'undefined' ? `${window.location.origin}${flashcardSetPath(set)}` : ''}
              title={set.title}
              stats={shareStats(set)}
            />
          </div>
        )}
      </Card>
    </Link>
  );
}

export function FeaturedFlashcardSetCard({ set }: { set: FlashcardSetWithStats }) {
  return (
    <Link href={flashcardSetPath(set)}>
      <Card className="border-l-4 border-l-pulse-300 p-6 transition-shadow hover:shadow-md sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-2xl font-semibold text-ink-800 sm:text-3xl">{set.title}</h3>
          <div className="flex shrink-0 items-center gap-2">
            {set.pricing === 'paid' && (
              <span className="rounded bg-flag-50 px-2 py-0.5 text-xs font-semibold text-flag-600">Paid</span>
            )}
            <span className="rounded bg-pulse-50 px-2 py-0.5 text-xs font-semibold text-pulse-600">Flashcard</span>
            <BookmarkButton kind="flashcard" targetId={set.id} />
          </div>
        </div>
        {set.description && <p className="mt-2 text-sm text-ink-500">{set.description}</p>}
        <div className="mt-5 flex flex-wrap items-center gap-4 font-mono text-xs text-ink-400">
          <span>{set.cardCount} cards</span>
          <span title="Number of completed study sessions">{set.attemptCount} attempts</span>
        </div>
        {(set.categoryName || set.subcategoryName) && (
          <div className="mt-3 text-xs text-ink-400">
            {set.categoryName} {set.subcategoryName ? `· ${set.subcategoryName}` : ''}
          </div>
        )}
        {set.creatorName && <div className="mt-1 text-xs text-ink-400">By {set.creatorName}</div>}
        {set.visibility === 'public' && (
          <div className="mt-4" onClick={(e) => e.preventDefault()}>
            <ShareButton
              url={typeof window !== 'undefined' ? `${window.location.origin}${flashcardSetPath(set)}` : ''}
              title={set.title}
              stats={shareStats(set)}
            />
          </div>
        )}
      </Card>
    </Link>
  );
}

export function CompactFlashcardSetCard({ set }: { set: FlashcardSetWithStats }) {
  return (
    <Link href={flashcardSetPath(set)}>
      <div className="flex items-start justify-between gap-3 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-display text-base font-semibold text-ink-800">{set.title}</h4>
            {set.pricing === 'paid' && (
              <span className="rounded bg-flag-50 px-2 py-0.5 text-xs font-semibold text-flag-600">Paid</span>
            )}
            <span className="rounded bg-pulse-50 px-2 py-0.5 text-xs font-semibold text-pulse-600">Flashcard</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 font-mono text-xs text-ink-400">
            <span>{set.cardCount} cards</span>
            <span title="Number of completed study sessions">{set.attemptCount} attempts</span>
          </div>
          {set.creatorName && <div className="mt-1 text-xs text-ink-400">By {set.creatorName}</div>}
        </div>
        <div className="shrink-0" onClick={(e) => e.preventDefault()}>
          <BookmarkButton kind="flashcard" targetId={set.id} />
        </div>
      </div>
    </Link>
  );
}
