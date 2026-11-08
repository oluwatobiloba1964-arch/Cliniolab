// File: src/components/dashboard/MissedQuestionSrsCard.tsx
// Dashboard card for the missed-question spaced-repetition deck. Pure
// client-side: no fetch, no API call, no database read. Lets the learner
// review one missed question at a time using an SM-2-inspired schedule.

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Brain, CheckCircle2, Eye, Inbox, RotateCcw, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import {
  describeInterval,
  getAllSrsItems,
  getDueItems,
  reseedFromMissReasons,
  removeSrsItem,
  reviewItem,
  SRS_RATING_LABELS,
  type MissedQuestionSrsItem,
  type SrsRating,
} from '@/lib/services/missedQuestionSrsService';

const RATING_ORDER: SrsRating[] = ['again', 'hard', 'good', 'easy'];

const RATING_BUTTON_CLASS: Record<SrsRating, string> = {
  again: 'bg-critical-100 text-critical-700 hover:bg-critical-200',
  hard: 'bg-flag-100 text-flag-700 hover:bg-flag-200',
  good: 'bg-pulse-100 text-pulse-700 hover:bg-pulse-200',
  easy: 'bg-ink-100 text-ink-700 hover:bg-ink-200',
};

export function MissedQuestionSrsCard() {
  const [items, setItems] = useState<MissedQuestionSrsItem[]>([]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [revealed, setRevealed] = useState<MissedQuestionSrsItem | null>(null);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    // Once per mount: re-seed the SRS deck from the existing miss-reason
    // log so learners who already have data see their due cards without
    // having to re-take a quiz.
    reseedFromMissReasons();
    setItems(getDueItems());
    setSeeded(true);
  }, []);

  useEffect(() => {
    if (!seeded) return;
    setItems(getDueItems());
  }, [seeded]);

  const dueCount = items.length;
  const totalCount = getAllSrsItems().length;
  const current = items[0] ?? null;

  function handleReview(rating: SrsRating) {
    if (!current) return;
    reviewItem(current.id, rating);
    setItems(getDueItems());
    setShowAnswer(false);
    setRevealed(null);
  }

  function handleRemove() {
    if (!current) return;
    removeSrsItem(current.id);
    setItems(getDueItems());
    setShowAnswer(false);
    setRevealed(null);
  }

  function restart() {
    setItems(getDueItems());
    setShowAnswer(false);
    setRevealed(null);
  }

  if (!seeded) return null;
  if (totalCount === 0) return null;

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pulse-600">Missed-question SRS</p>
            <h3 className="mt-1 font-display text-lg font-semibold text-ink-900">Review what you got wrong</h3>
            <p className="mt-1 text-sm text-ink-500">
              {dueCount > 0
                ? `${dueCount} card${dueCount === 1 ? ' is' : 's are'} due for review now.`
                : 'No cards due right now. Cards you miss will reappear here on their schedule.'}
            </p>
          </div>
          <span className="rounded-full bg-ink-50 px-3 py-1 text-[10px] font-semibold text-ink-400">
            {dueCount} due · {totalCount} total
          </span>
        </div>

        {current ? (
          <div className="rounded-2xl border border-pulse-100 bg-gradient-to-br from-pulse-50/60 to-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pulse-600 text-white">
                <Brain className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-pulse-600">
                  {current.quizTitle || 'Saved miss'}
                </p>
                <p className="mt-1 text-sm leading-6 text-ink-800">{current.prompt}</p>
              </div>
            </div>

            {!showAnswer ? (
              <button
                type="button"
                onClick={() => setShowAnswer(true)}
                className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-800"
              >
                <Eye aria-hidden="true" className="h-4 w-4" />
                Show answer & rate
              </button>
            ) : (
              <div className="mt-4">
                <p className="text-xs text-ink-500">
                  Recalled how well? The next interval will be:
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {RATING_ORDER.map((rating) => {
                    const next = previewNext(rating, current);
                    return (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => handleReview(rating)}
                        className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-2.5 text-xs font-semibold transition ${RATING_BUTTON_CLASS[rating]}`}
                      >
                        <span>{SRS_RATING_LABELS[rating]}</span>
                        <span className="text-[10px] font-normal opacity-80">{next}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-critical-600 hover:text-critical-700"
                >
                  <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                  Remove from deck
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-ink-100 bg-white p-5 text-center">
            <Inbox className="mx-auto h-6 w-6 text-ink-400" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-ink-700">Nothing due right now</p>
            <p className="mt-1 text-xs text-ink-500">
              Cards you miss in future quizzes will reappear here automatically.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link
                href="/quizzes"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-800"
              >
                <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                Take a quiz
              </Link>
              <button
                type="button"
                onClick={restart}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700 transition hover:bg-ink-50"
              >
                <RotateCcw aria-hidden="true" className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>
        )}

        {revealed && (
          <p className="text-xs text-ink-400">
            Last reviewed: {new Date(revealed.lastReviewedAt).toLocaleDateString()} · Next due: {describeInterval(revealed.intervalDays)}
          </p>
        )}
      </div>
    </Card>
  );
}

function previewNext(rating: SrsRating, current: MissedQuestionSrsItem): string {
  // Mirrors the nextInterval logic in the service for a friendly preview.
  let days: number;
  if (rating === 'again') days = 10 / 60 / 24;
  else if (current.repetitions === 0) days = rating === 'hard' ? 1 : rating === 'good' ? 3 : 7;
  else if (current.repetitions === 1) days = 6;
  else days = Math.max(1, Math.round(Math.max(current.intervalDays, 1) * current.ease));
  if (rating === 'hard' && days >= 1) days = Math.round(days * 0.8);
  return describeInterval(days);
}
