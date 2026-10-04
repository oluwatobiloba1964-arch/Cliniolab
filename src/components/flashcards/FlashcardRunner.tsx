'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { clearDraft, loadDraft, saveDraft } from '@/lib/localDraft';

export interface FlashcardRunnerCard {
  id: string;
  front: string;
  back: string;
  explanation?: string | null;
}

interface FlashcardRunnerProps {
  cards: FlashcardRunnerCard[];
  /** Shown above the progress bar, e.g. "Flashcards" or a quiz/set title. */
  title?: string;
  onDone?: () => void;
  /**
   * Fired once, automatically, the moment the deck is completed (the
   * user reaches the end) - independent of the "Done" button, which
   * just closes the completion screen. Used to record a completed
   * attempt server-side without requiring an extra tap.
   */
  onComplete?: () => void;
  /**
   * Stable id used to key the resumable localStorage draft (e.g. the
   * flashcard set id, or `quiz-${quizId}-missed` for the embedded
   * "Practice with flashcards" entry points). Sessions with different
   * draftIds never collide. If omitted, progress isn't persisted.
   */
  draftId?: string;
  /** Shuffle card order once per mount. Defaults to false  -  off for the shared "practice with flashcards" quiz entry point, which has no per-set shuffle concept. */
  shuffle?: boolean;
}

/** Fisher-Yates shuffle, returns a new array without mutating the input. */
function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** What gets cached in localStorage for a resumable flashcard session. */
interface FlashcardDraft {
  current: number;
  knownIds: string[];
  reviewIds: string[];
}

export const FLASHCARD_DRAFT_NAMESPACE = 'flashcards';
const DRAFT_NAMESPACE = FLASHCARD_DRAFT_NAMESPACE;

/**
 * Shared flip-card study UI. Used both by the standalone Flashcard
 * section (/flashcards/[setId]) and by "Practice with flashcards" on a
 * regular quiz's results/detail screen  -  same front/back/explanation
 * shape either way, so one component covers both entry points.
 *
 * Session progress (position, known/review marks) is cached in
 * localStorage, keyed by draftId, so closing the tab or navigating away
 * mid-session doesn't lose your place  -  same pattern as Study Mode.
 */
export function FlashcardRunner({ cards: rawCards, title, onDone, onComplete, draftId, shuffle }: FlashcardRunnerProps) {
  // Shuffle once per mount, same pattern as QuizRunner  -  not on every
  // re-render, so flipping/marking a card doesn't reorder the deck.
  const [cards] = useState(() => (shuffle ? shuffleArray(rawCards) : rawCards));

  const initialDraft = useRef<FlashcardDraft | null>(
    draftId ? loadDraft<FlashcardDraft>(DRAFT_NAMESPACE, draftId) : null
  ).current;

  const [current, setCurrent] = useState(
    initialDraft && initialDraft.current < cards.length ? initialDraft.current : 0
  );
  const [flipped, setFlipped] = useState(false);
  const [knownIds, setKnownIds] = useState<Set<string>>(new Set(initialDraft?.knownIds ?? []));
  const [reviewIds, setReviewIds] = useState<Set<string>>(new Set(initialDraft?.reviewIds ?? []));
  const [finished, setFinished] = useState(false);

  const card = cards[current];
  const isLast = current === cards.length - 1;

  // Persist progress after every change. Cleared once the session
  // finishes, same as Study Mode's draft.
  useEffect(() => {
    if (!draftId || finished) return;
    saveDraft<FlashcardDraft>(DRAFT_NAMESPACE, draftId, {
      current,
      knownIds: Array.from(knownIds),
      reviewIds: Array.from(reviewIds),
    });
  }, [draftId, current, knownIds, reviewIds, finished]);

  // Fires once per completed run-through, including after "Study again" -
  // each full pass through the deck is its own attempt.
  useEffect(() => {
    if (finished) onComplete?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  function goNext() {
    if (isLast) {
      setFinished(true);
      if (draftId) clearDraft(DRAFT_NAMESPACE, draftId);
      return;
    }
    setCurrent((c) => c + 1);
    setFlipped(false);
  }

  function goPrevious() {
    if (current === 0) return;
    setCurrent((c) => c - 1);
    setFlipped(false);
  }

  function markKnown() {
    setKnownIds((prev) => new Set(prev).add(card.id));
    setReviewIds((prev) => {
      const next = new Set(prev);
      next.delete(card.id);
      return next;
    });
    goNext();
  }

  function markReview() {
    setReviewIds((prev) => new Set(prev).add(card.id));
    goNext();
  }

  function restart() {
    setCurrent(0);
    setFlipped(false);
    setKnownIds(new Set());
    setReviewIds(new Set());
    setFinished(false);
    if (draftId) clearDraft(DRAFT_NAMESPACE, draftId);
  }

  if (cards.length === 0) {
    return <p className="py-12 text-center text-sm text-ink-400">No cards to study yet.</p>;
  }

  if (finished) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <Card className="p-8 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-pulse-600">Flashcards complete</p>
          <p className="mt-4 font-display text-3xl font-semibold text-ink-800">
            {knownIds.size} / {cards.length} known
          </p>
          {reviewIds.size > 0 && (
            <p className="mt-2 text-sm text-ink-500">
              {reviewIds.size} card{reviewIds.size === 1 ? '' : 's'} marked for review.
            </p>
          )}
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <Button variant="secondary" onClick={restart}>
              Study again
            </Button>
            {onDone && <Button onClick={onDone}>Done</Button>}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex items-center justify-between gap-3 text-sm text-ink-500">
        <span className="font-medium">Card {current + 1} of {cards.length}</span>
        {title && <span className="font-mono text-xs uppercase tracking-widest text-pulse-600">{title}</span>}
      </div>
      <div className="mt-3 h-1.5 w-full rounded-full bg-ink-100">
        <div
          className="h-1 rounded-full bg-pulse-500 transition-all"
          style={{ width: `${((current + 1) / cards.length) * 100}%` }}
        />
      </div>

      <button
        type="button"
        aria-label={flipped ? 'Show the front of the card' : 'Reveal the back of the card'}
        onClick={() => setFlipped((f) => !f)}
        className="mt-7 block w-full text-left"
      >
        <Card className="flex min-h-[260px] flex-col justify-center p-6 text-center transition-shadow hover:shadow-md sm:min-h-[300px] sm:p-10">
          <p className="font-mono text-xs uppercase tracking-widest text-ink-400">
            {flipped ? 'Back' : 'Front'}
          </p>
          <p className="mt-4 whitespace-pre-line font-display text-xl font-medium text-ink-800">
            {flipped ? card.back : card.front}
          </p>
          {flipped && card.explanation && (
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink-500">
              {card.explanation}
            </p>
          )}
          <p className="mt-6 text-xs text-ink-400">Tap card to flip</p>
        </Card>
      </button>

      <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:justify-between">
        <Button variant="secondary" onClick={goPrevious} disabled={current === 0}>
          Previous
        </Button>
        {flipped ? (
          <div className="col-span-2 grid grid-cols-2 gap-2 sm:col-span-1 sm:flex">
            <Button variant="secondary" onClick={markReview}>
              Review again
            </Button>
            <Button onClick={markKnown}>I knew this</Button>
          </div>
        ) : (
          <Button onClick={() => setFlipped(true)}>Flip</Button>
        )}
      </div>
    </div>
  );
}
