// File: src/components/flashcards/FlashcardRunner.tsx
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

  // Keyboard shortcuts. Ignores typing fields and interactive controls so
  // Space/Enter still activate focused buttons and links elsewhere on the page.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable ||
        target instanceof HTMLButtonElement ||
        target instanceof HTMLAnchorElement
      ) {
        return;
      }
      if (finished) return;
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        setFlipped((value) => !value);
      } else if (event.key === 'ArrowLeft') {
        if (current > 0) {
          event.preventDefault();
          setCurrent((c) => c - 1);
          setFlipped(false);
        }
      } else if (event.key === 'ArrowRight') {
        if (flipped) {
          event.preventDefault();
          if (current === cards.length - 1) {
            setFinished(true);
            if (draftId) clearDraft(DRAFT_NAMESPACE, draftId);
          } else {
            setCurrent((c) => c + 1);
            setFlipped(false);
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [current, flipped, finished, cards.length, draftId]);

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
    const knownPercent = Math.round((knownIds.size / cards.length) * 100);
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <Card className="overflow-hidden p-0">
          <div className="bg-gradient-to-br from-pulse-50 via-white to-ink-50 p-8 text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-pulse-600">Session complete</p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-ink-900">Nice work.</h2>
            <p className="mt-2 text-sm text-ink-500">You finished every card in this study session.</p>
            <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-pulse-100 bg-white px-3 py-1.5 text-xs font-semibold text-pulse-700 shadow-sm">
              {knownPercent}% marked as known
            </div>
            <div className="mx-auto mt-6 h-3 max-w-sm overflow-hidden rounded-full bg-ink-100">
              <div className="h-full rounded-full bg-pulse-500 transition-all duration-700" style={{ width: `${knownPercent}%` }} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-pulse-100 bg-white p-3 shadow-sm">
                <p className="font-mono text-2xl font-semibold text-pulse-600">{knownIds.size}</p>
                <p className="mt-1 text-xs text-ink-400">Known</p>
              </div>
              <div className="rounded-xl border border-flag-100 bg-white p-3 shadow-sm">
                <p className="font-mono text-2xl font-semibold text-flag-500">{reviewIds.size}</p>
                <p className="mt-1 text-xs text-ink-400">Review again</p>
              </div>
            </div>
          </div>
          <div className="p-6 text-center">
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="secondary" onClick={restart}>
              Study again
            </Button>
            {onDone && <Button onClick={onDone}>Done</Button>}
          </div>
          </div>
        </Card>
      </div>
    );
  }

  const progressPercent = Math.round(((current + 1) / cards.length) * 100);
  const reviewedCount = knownIds.size + reviewIds.size;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="rounded-xl border border-ink-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 text-sm text-ink-500">
          <div>
            <span className="font-semibold text-ink-700">Card {current + 1}</span>
            <span className="text-ink-400"> of {cards.length}</span>
          </div>
          {title && <span className="max-w-[45%] truncate font-mono text-[10px] uppercase tracking-widest text-pulse-600">{title}</span>}
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink-100">
          <div
            className="h-full rounded-full bg-pulse-500 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-ink-400">
          <span>{progressPercent}% through</span>
          <span>{reviewedCount} reviewed</span>
        </div>
      </div>

      <button
        type="button"
        aria-label={flipped ? 'Show the front of the card' : 'Reveal the back of the card'}
        onClick={() => setFlipped((f) => !f)}
        className="mt-7 block w-full text-left"
      >
        <Card className="flex min-h-[280px] flex-col justify-center border-ink-100 p-6 text-center transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg sm:min-h-[330px] sm:p-10">
          <div className="mx-auto rounded-full bg-pulse-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-pulse-700">
            {flipped ? 'Answer' : 'Recall'}
          </div>
          <p className="mt-5 whitespace-pre-line font-display text-xl font-medium leading-8 text-ink-800 sm:text-2xl">
            {flipped ? card.back : card.front}
          </p>
          {flipped && card.explanation && (
            <div className="mx-auto mt-5 max-w-xl rounded-xl border border-ink-100 bg-ink-50/70 p-4 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">Explanation</p>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-600">{card.explanation}</p>
            </div>
          )}
          <p className="mt-6 text-xs text-ink-400">{flipped ? 'Choose how well you knew it' : 'Tap to reveal the answer'}</p>
        </Card>
      </button>

      <div className="mt-3 flex justify-center">
        <Button
          variant="secondary"
          onClick={() => setFlipped((value) => !value)}
          aria-label={flipped ? 'Show card front' : 'Reveal card answer'}
        >
          {flipped ? '↺ Show front' : '↻ Reveal answer'}
        </Button>
      </div>
      <p className="mt-2 text-center text-[11px] text-ink-400">Space/Enter to flip · ←/→ to navigate</p>

      <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:justify-between">
        <Button variant="secondary" onClick={goPrevious} disabled={current === 0}>
          ← Previous
        </Button>
        {flipped ? (
          <div className="col-span-2 grid grid-cols-2 gap-2 sm:col-span-1 sm:flex">
            <Button variant="secondary" onClick={markReview}>
              Review again
            </Button>
            <Button onClick={markKnown}>I knew this ✓</Button>
          </div>
        ) : (
          <Button onClick={() => setFlipped(true)}>Reveal answer →</Button>
        )}
      </div>
    </div>
  );
}
