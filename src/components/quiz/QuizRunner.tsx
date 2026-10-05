// File: src/components/quiz/QuizRunner.tsx
// src/components/quiz/QuizRunner.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ClipboardEvent, MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { QuestionNavigator } from '@/components/quiz/QuestionNavigator';
import { FlashcardRunner } from '@/components/flashcards/FlashcardRunner';
import { IncorrectRationale } from '@/components/quiz/IncorrectRationale';
import { clearDraft, loadDraft, saveDraft } from '@/lib/localDraft';
import type { AttemptResult, Quiz, QuizQuestion } from '@/types';

interface QuizRunnerProps {
  quiz: Quiz;
  questions: Omit<QuizQuestion, 'correctAnswer'>[];
  submitEndpoint: string;
  /**
   * Whether this is the user's first-ever attempt at this specific quiz
   * (across quiz and exam modes; study mode never renders QuizRunner at
   * all, so it's unaffected). Drives the copy-block anti-cheat overlay on
   * the question card below - true on a genuine first attempt regardless
   * of the quiz's own antiCheatEnabled/retake settings, false on any
   * attempt after that, so returning users can freely copy questions
   * they've already seen once (e.g. to look something up while
   * reviewing).
   */
  isFirstAttempt: boolean;
  /**
   * Fired once, right after a submit succeeds (whether or not it was
   * persisted to quiz_attempts) so a parent can react to "this visitor
   * has now attempted the quiz"  -  e.g. to reveal a leaderboard that's
   * only meant for people who've actually taken it.
   */
  onSubmitted?: () => void;
  /**
   * Guest Practice: results are graded by a no-save endpoint, nothing goes
   * to the account dashboard or leaderboard, flagging (needs login) is
   * hidden, and the results screen points to sign-up instead of the
   * dashboard. Missed question ids are kept in localStorage only.
   */
  guest?: boolean;
  /** Offline mode: grades entirely on-device instead of calling submitEndpoint. */
  gradeLocally?: (payload: {
    questionIds: string[];
    answers: { questionId: string; submittedAnswer: string | null }[];
    timeTakenSeconds: number;
  }) => AttemptResult;
}

/**
 * Draft autosave cache for an in-progress attempt. This is purely a
 * device-local safety net so a refresh, crash, or accidental tab close
 * doesn't lose answers before they've been submitted to D1  -  it is never
 * itself the graded record. It's cleared the moment a submit succeeds.
 *
 * Disabled entirely for anti-cheat exams: those are meant to be a single,
 * uninterrupted sitting, and resuming a cached timer/answer state across a
 * refresh would undermine that guarantee.
 */
interface AttemptDraft {
  questionOrder: string[]; // question ids, in the shuffled order used this attempt
  current: number;
  answers: Record<string, string>;
  markedForReview: string[];
  confidence: Record<string, 'sure' | 'guessing'>;
  skipped: string[];
  startedAt: number;
  // Absolute deadline (ms since epoch), not a countdown. A countdown
  // number only advances while this tab's JS is actively running an
  // interval, so it's meaningless the moment the tab is closed,
  // backgrounded, or the device sleeps -- exactly the case this exists to
  // survive. A fixed deadline can be checked against wall-clock time
  // whenever the person actually comes back, however long that takes.
  deadline: number | null;
}

const DRAFT_NAMESPACE = 'attempt';
const RESULT_NAMESPACE = 'attempt-result';

/** Fisher-Yates shuffle, returns a new array without mutating the input. */
function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function QuizRunner({ quiz, questions: rawQuestions, submitEndpoint, isFirstAttempt, onSubmitted, guest = false, gradeLocally }: QuizRunnerProps) {
  const router = useRouter();

  // Anti-cheat exams intentionally never read or write a draft: no resume
  // across a refresh, no clock recovery. Everything else (quizzes, and
  // exams without anti-cheat) gets the resumable safety net.
  const draftsEnabled = !quiz.antiCheatEnabled;

  const initialDraft = useRef<AttemptDraft | null>(
    draftsEnabled && typeof window !== 'undefined' ? loadDraft<AttemptDraft>(DRAFT_NAMESPACE, quiz.id) : null
  ).current;

  // If the user already submitted and then reloaded (or came back later)
  // before navigating away from the results screen, restore the cached
  // result instead of dropping them into a brand-new attempt. Same
  // draftsEnabled gate as the in-progress draft above -- anti-cheat exams
  // never cache anything client-side.
  const initialResult = useRef<AttemptResult | null>(
    draftsEnabled && typeof window !== 'undefined' ? loadDraft<AttemptResult>(RESULT_NAMESPACE, quiz.id) : null
  ).current;

  // Shuffle once per attempt (on mount), not on every render, so the order
  // doesn't jump around as the user answers. Option IDs are preserved so
  // grading (which matches on option id) is unaffected by display order.
  // If a resumable draft exists, reorder questions to match the order the
  // user was actually attempting, rather than re-shuffling.
  const [questions] = useState(() => {
    let list = rawQuestions;
    if (quiz.shuffleQuestions) list = shuffleArray(list);
    if (quiz.shuffleOptions) {
      list = list.map((q) =>
        q.options ? { ...q, options: shuffleArray(q.options) } : q
      );
    }

    if (initialDraft?.questionOrder?.length === list.length) {
      const byId = new Map(list.map((q) => [q.id, q]));
      const reordered = initialDraft.questionOrder
        .map((id) => byId.get(id))
        .filter((q): q is Omit<QuizQuestion, 'correctAnswer'> => q !== undefined);
      if (reordered.length === list.length) return reordered;
    }
    return list;
  });

  const [current, setCurrent] = useState(initialDraft?.current ?? 0);
  const [answers, setAnswers] = useState<Record<string, string>>(initialDraft?.answers ?? {});
  const [startedAt] = useState(() => initialDraft?.startedAt ?? Date.now());
  // Fixed point in time the attempt must end by, computed once (either
  // recovered from the draft, or freshly derived from startedAt + the
  // quiz's time limit). Never recomputed from a countdown -- see
  // AttemptDraft.deadline above for why.
  const [deadline] = useState<number | null>(() => {
    if (initialDraft?.deadline) return initialDraft.deadline;
    if (!quiz.timeLimitSeconds) return null;
    return startedAt + quiz.timeLimitSeconds * 1000;
  });
  // Purely a display value, recomputed each tick from `deadline`  -  never
  // itself the source of truth for whether time is up.
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    deadline ? Math.max(0, Math.round((deadline - Date.now()) / 1000)) : 0
  );
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(initialResult ?? null);
  const [error, setError] = useState<string | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [resultFilter, setResultFilter] = useState<'all' | 'correct' | 'incorrect'>('all');
  // Whether "Practice with flashcards" has been launched from the results
  // screen. Reuses the same shared FlashcardRunner as the standalone
  // Flashcard feature  -  this just feeds it the quiz's own questions
  // (front = prompt, back = correct answer, explanation carried over).
  const [flashcardMode, setFlashcardMode] = useState<'all' | 'missed' | null>(null);
  // Separate from resultFilter above (which filters the post-submit
  // results screen). This filters the in-progress question navigator, so
  // the user can jump between unanswered/answered/skipped questions while
  // still attempting. Deliberately "answered" not "correct/incorrect" -
  // correctness isn't known (or shown) until after submit.
  const [progressFilter, setProgressFilter] = useState<'all' | 'unanswered' | 'answered' | 'skipped'>('all');
  const [confidence, setConfidence] = useState<Record<string, 'sure' | 'guessing'>>(
    initialDraft?.confidence ?? {}
  );
  // Questions explicitly skipped without answering, so they can be
  // revisited or filtered separately from "answered".
  const [skipped, setSkipped] = useState<Set<string>>(new Set(initialDraft?.skipped ?? []));
  const [flaggedQuestionIds, setFlaggedQuestionIds] = useState<Set<string>>(new Set());
  const [flaggingQuestionId, setFlaggingQuestionId] = useState<string | null>(null);
  const [flagError, setFlagError] = useState<string | null>(null);
  // "Mark for review" during the attempt (CBT-style), distinct from the
  // post-result "report this question" flag above.
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(
    new Set(initialDraft?.markedForReview ?? [])
  );

  function toggleMarkForReview(questionId: string) {    setMarkedForReview((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }

  function rateConfidence(level: 'sure' | 'guessing') {
    setConfidence((prev) => ({ ...prev, [question.id]: level }));
  }

  function setAnswerAndUnskip(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setSkipped((prev) => {
      if (!prev.has(questionId)) return prev;
      const next = new Set(prev);
      next.delete(questionId);
      return next;
    });
  }

  function skipQuestion() {
    setSkipped((prev) => new Set(prev).add(question.id));
    setCurrent((c) => Math.min(questions.length - 1, c + 1));
  }

  // Blocks copy/cut/right-click on the question prompt and answer options
  // during a user's genuine first attempt at this quiz (see isFirstAttempt
  // above), and surfaces a brief on-screen notice so the block reads as
  // intentional rather than a broken button. This is a UX-level deterrent,
  // not real security - it stops casual copy-paste, but can't stop a
  // screenshot, the browser's "view source"/devtools, or OCR on a photo of
  // the screen. It's meant to discourage casual sharing of question banks,
  // not to be airtight.
  const [copyBlockedNotice, setCopyBlockedNotice] = useState(false);
  const copyBlockedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function blockCopy(e: ClipboardEvent | MouseEvent) {
    e.preventDefault();
    setCopyBlockedNotice(true);
    if (copyBlockedTimeoutRef.current) clearTimeout(copyBlockedTimeoutRef.current);
    copyBlockedTimeoutRef.current = setTimeout(() => setCopyBlockedNotice(false), 2500);
  }

  useEffect(() => {
    return () => {
      if (copyBlockedTimeoutRef.current) clearTimeout(copyBlockedTimeoutRef.current);
    };
  }, []);

  // Whether this attempt is timed  -  true for exam mode (always) and for
  // quiz mode when the creator opted into a time limit for a speed-drill.
  const hasTimer = !!quiz.timeLimitSeconds;

  // The single source of truth for "is time up"  -  always re-derived from
  // the fixed deadline against the current wall clock, never from a
  // counter that only moves while this tab is actively running. Called
  // on mount, on every tick, and whenever the tab regains focus, so a
  // person who was away for the interval's callback to matter (tab
  // closed, phone locked, app backgrounded) gets auto-submitted using
  // whatever was in their draft the moment they're back, rather than the
  // timer silently having "kept going" with no one watching.
  function checkDeadline() {
    if (!deadline || result) return;
    const secondsLeft = Math.max(0, Math.round((deadline - Date.now()) / 1000));
    setRemainingSeconds(secondsLeft);
    if (secondsLeft <= 0) {
      void handleSubmit();
    }
  }

  // Runs once, synchronously on mount (before the first paint the user
  // would otherwise see of a question), so returning to an already-expired
  // attempt submits immediately instead of briefly showing a stale timer.
  const checkedOnMount = useRef(false);
  const [autoSubmittingExpired, setAutoSubmittingExpired] = useState(false);
  if (!checkedOnMount.current && deadline) {
    checkedOnMount.current = true;
    if (Date.now() >= deadline) {
      setAutoSubmittingExpired(true);
      // Deferred one tick: handleSubmit reads component state/refs that
      // aren't fully wired up mid-render.
      queueMicrotask(() => void handleSubmit());
    }
  }

  useEffect(() => {
    if (!hasTimer || result) return;
    const interval = setInterval(checkDeadline, 1000);
    // Also re-check the instant the tab/app regains focus, rather than
    // waiting up to a full second for the next interval tick  -  covers the
    // common "unlocked phone, glanced at the screen" case as fast as
    // possible.
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') checkDeadline();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTimer, result]);

  const question = questions[current];
  const progressPercent = useMemo(
    () => Math.round(((current + 1) / questions.length) * 100),
    [current, questions.length]
  );
  const navigatorStates = useMemo(
    () =>
      questions.map((q) => ({
        answered: answers[q.id] !== undefined && answers[q.id] !== '',
        flagged: markedForReview.has(q.id),
      })),
    [questions, answers, markedForReview]
  );
  const unansweredCount = useMemo(
    () => questions.filter((q) => answers[q.id] === undefined || answers[q.id] === '').length,
    [questions, answers]
  );

  function isAnswered(questionId: string): boolean {
    return answers[questionId] !== undefined && answers[questionId] !== '';
  }

  function matchesProgressFilter(questionId: string, filter: typeof progressFilter): boolean {
    switch (filter) {
      case 'unanswered':
        return !isAnswered(questionId) && !skipped.has(questionId);
      case 'answered':
        return isAnswered(questionId);
      case 'skipped':
        return skipped.has(questionId);
      default:
        return true;
    }
  }

  // Counts per progress filter, for the filter bar badges during the
  // attempt itself (not the post-submit results screen).
  const progressFilterCounts = useMemo(() => {
    const counts = { all: questions.length, unanswered: 0, answered: 0, skipped: 0 };
    for (const q of questions) {
      if (matchesProgressFilter(q.id, 'unanswered')) counts.unanswered++;
      if (matchesProgressFilter(q.id, 'answered')) counts.answered++;
      if (matchesProgressFilter(q.id, 'skipped')) counts.skipped++;
    }
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, answers, skipped]);

  // The timer's setInterval callback is created once and would otherwise
  // close over the `answers` value from that render, so an auto-submit on
  // timeout would silently send an empty answer set even if the user had
  // answered everything. Keep a ref in sync with the latest answers so the
  // timeout path always submits what's actually been selected.
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // Autosave a resumable draft of the in-progress attempt. Skipped
  // entirely for anti-cheat exams (see draftsEnabled above), and stopped
  // once a result has come back since there's nothing left to protect.
  useEffect(() => {
    if (!draftsEnabled || result) return;
    const draft: AttemptDraft = {
      questionOrder: questions.map((q) => q.id),
      current,
      answers,
      markedForReview: Array.from(markedForReview),
      confidence,
      skipped: Array.from(skipped),
      startedAt,
      deadline,
    };
    saveDraft(DRAFT_NAMESPACE, quiz.id, draft);
  }, [draftsEnabled, result, quiz.id, questions, current, answers, markedForReview, confidence, skipped, startedAt, deadline]);

  async function handleSubmit() {
    if (submitting || result) return;
    setSubmitting(true);
    setError(null);
    try {
      const timeTakenSeconds = Math.round((Date.now() - startedAt) / 1000);
      const submission = {
        questionIds: questions.map((q) => q.id),
        answers: Object.entries(answersRef.current).map(([questionId, submittedAnswer]) => ({
          questionId,
          submittedAnswer,
        })),
        timeTakenSeconds,
      };
      let resultData: AttemptResult;
      if (gradeLocally) {
        resultData = gradeLocally(submission);
      } else {
        const res = await fetch(submitEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submission),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? 'Failed to submit attempt');
          setSubmitting(false);
          return;
        }
        resultData = data.result;
      }
      setResult(resultData);
      if (guest) {
        // Device-local only: lets "Retake missed only" work without any account or database row.
        try {
          const missedIds = resultData.perQuestion.filter((pq) => !pq.isCorrect).map((pq) => pq.questionId);
          window.localStorage.setItem(`cl-guest-missed:${quiz.id}`, JSON.stringify(missedIds));
        } catch {
          // Storage may be unavailable (private mode); retake-missed simply falls back to all questions.
        }
      }
      onSubmitted?.();
      if (draftsEnabled) {
        clearDraft(DRAFT_NAMESPACE, quiz.id);
        // Cache the result itself now, so a reload of this results screen
        // restores it instead of starting a fresh attempt. Cleared only
        // once the user actually navigates away (see leaveResults below).
        saveDraft(RESULT_NAMESPACE, quiz.id, resultData);
      }
    } catch {
      setError('Network error while submitting. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFlagQuestion(questionId: string) {
    if (flaggedQuestionIds.has(questionId) || flaggingQuestionId) return;
    setFlaggingQuestionId(questionId);
    setFlagError(null);
    try {
      const res = await fetch(`/api/quizzes/${quiz.id}/questions/${questionId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setFlagError(data.error ?? 'Failed to flag question');
        return;
      }
      setFlaggedQuestionIds((prev) => new Set(prev).add(questionId));
    } catch {
      setFlagError('Network error while flagging. Please try again.');
    } finally {
      setFlaggingQuestionId(null);
    }
  }

  // Clears the cached results-screen state. Called when the user actually
  // leaves this results screen for good (dashboard, or starting a fresh
  // "retake missed" attempt) -- NOT on a plain reload, which is exactly
  // the case this cache exists to survive.
  function leaveResults() {
    if (draftsEnabled) clearDraft(RESULT_NAMESPACE, quiz.id);
  }

  if (autoSubmittingExpired && !result) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <p className="text-ink-500">
          Your time ran out while you were away. Submitting the answers you had…
        </p>
      </div>
    );
  }

  if (flashcardMode && result) {
    const cards =
      flashcardMode === 'missed'
        ? result.perQuestion.filter((pq) => !pq.isCorrect)
        : result.perQuestion;
    return (
      <FlashcardRunner
        title={quiz.title}
        cards={cards.map((pq) => ({
          id: pq.questionId,
          front: pq.prompt,
          back: pq.options.find((o) => o.id === pq.correctAnswer)?.text ?? pq.correctAnswer,
          explanation: pq.explanation,
        }))}
        draftId={`quiz-${quiz.id}-${flashcardMode}`}
        onDone={() => setFlashcardMode(null)}
      />
    );
  }

  if (result) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <Card className="p-8 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-pulse-600">Result</p>
          <p className="mt-4 font-display text-5xl font-semibold text-ink-800">
            {Math.round(result.percentage)}%
          </p>
          <p className="mt-2 text-ink-500">
            {result.score} / {result.totalQuestions} correct
            {result.showMarks && ` · ${result.marksEarned} / ${result.totalMarks} marks`}
          </p>
          <p className="mt-3 text-sm font-medium text-ink-700">
            {result.percentage >= 80
              ? 'Strong performance — keep reviewing the questions you missed.'
              : result.percentage >= 60
                ? 'Good progress — review the missed questions before your next attempt.'
                : 'Use the review below to focus your next study session on the questions you missed.'}
          </p>
          {guest && (
            <p className="mt-3 text-xs text-ink-500">
              Guest Practice: this result is not saved. Log in or create a free account and retake this
              quiz to keep your history and streaks and, where available, join the leaderboard and earn a certificate.
            </p>
          )}
          {!guest && result.previouslyPracticedAsGuest && (
            <p className="mt-3 text-xs text-flag-600">
              You already practiced this quiz as a guest, so this result is not saved and does not
              count toward the leaderboard or certificates. You can keep practicing as much as you like.
            </p>
          )}
          {!guest && !result.previouslyPracticedAsGuest && !result.countedForLeaderboard && (
            <p className="mt-3 text-xs text-flag-600">
              This quiz allows unlimited retakes, so only your first attempt is saved to your
              dashboard and the leaderboard. This attempt&apos;s score is shown here but wasn&apos;t recorded.
            </p>
          )}
          <div className="mt-6 flex justify-center gap-2">
            {(['all', 'correct', 'incorrect'] as const).map((f) => {
              const count =
                f === 'all'
                  ? result.perQuestion.length
                  : result.perQuestion.filter((pq) => (f === 'correct' ? pq.isCorrect : !pq.isCorrect)).length;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setResultFilter(f)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    resultFilter === f
                      ? 'border-pulse-400 bg-pulse-50 text-pulse-700'
                      : 'border-ink-100 text-ink-500 hover:bg-ink-50'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'correct' ? 'Correct' : 'Incorrect'} ({count})
                </button>
              );
            })}
          </div>
          <div className="mt-6 space-y-4 text-left">
            {result.perQuestion
              .map((pq, i) => ({ pq, i }))
              .filter(({ pq }) =>
                resultFilter === 'all' ? true : resultFilter === 'correct' ? pq.isCorrect : !pq.isCorrect
              )
              .map(({ pq, i }) => {
              const resolve = (value: string | null) => {
                if (value === null) return null;
                const match = pq.options.find((o) => o.id === value);
                return match ? match.text : value;
              };
              const submittedText = resolve(pq.submittedAnswer);
              const correctText = resolve(pq.correctAnswer);
              return (
              <div key={pq.questionId} className="rounded-md border border-ink-100 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-ink-700">{i + 1}. {pq.prompt}</p>
                  {result.showMarks && (
                    <span className="shrink-0 text-xs font-medium text-ink-400">
                      {pq.isCorrect ? pq.mark : 0} / {pq.mark} mark{pq.mark === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                <p className={`mt-1 text-sm ${pq.isCorrect ? 'text-pulse-600' : 'text-critical-600'}`}>
                  Your answer: {submittedText ?? 'Not answered'}
                </p>
                {!pq.isCorrect && (
                  <p className="mt-1 text-sm text-ink-600">Correct answer: {correctText ?? 'Not available'}</p>
                )}
                {pq.options && pq.options.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {pq.options.map((opt) => {
                      const isCorrectOpt = opt.id === pq.correctAnswer;
                      const isSubmittedOpt = opt.id === pq.submittedAnswer;
                      return (
                        <li
                          key={opt.id}
                          className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                            isCorrectOpt
                              ? 'border-pulse-300 bg-pulse-50 text-pulse-700'
                              : isSubmittedOpt
                                ? 'border-critical-300 bg-critical-50 text-critical-700'
                                : 'border-ink-100 text-ink-600'
                          }`}
                        >
                          <span>{opt.text}</span>
                          {isCorrectOpt && (
                            <span className="ml-auto text-xs font-medium uppercase tracking-wide">Correct</span>
                          )}
                          {isSubmittedOpt && !isCorrectOpt && (
                            <span className="ml-auto text-xs font-medium uppercase tracking-wide">Your pick</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {pq.explanation && (
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-600">
                    {pq.explanation}
                  </p>
                )}
                <IncorrectRationale text={pq.incorrectRationale} />
                {quiz.allowFlagging && !guest && (
                  <div className="mt-2">
                    {flaggedQuestionIds.has(pq.questionId) ? (
                      <p className="text-xs font-medium text-pulse-600">
                        Flagged. The creator has been notified.
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleFlagQuestion(pq.questionId)}
                        disabled={flaggingQuestionId === pq.questionId}
                        className="text-xs font-medium text-ink-400 underline decoration-dotted hover:text-critical-500 disabled:opacity-50"
                      >
                        {flaggingQuestionId === pq.questionId ? 'Flagging…' : 'Flag this question'}
                      </button>
                    )}
                  </div>
                )}
              </div>
              );
            })}
            {result.perQuestion.filter((pq) =>
              resultFilter === 'all' ? true : resultFilter === 'correct' ? pq.isCorrect : !pq.isCorrect
            ).length === 0 && (
              <p className="py-6 text-center text-sm text-ink-400">
                No {resultFilter} questions.
              </p>
            )}
          </div>
          {flagError && <p className="mt-3 text-xs text-critical-500">{flagError}</p>}
          <div className="mt-8 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:justify-center">
            {draftsEnabled && (
              <Button
                variant="secondary"
                onClick={() => {
                  leaveResults();
                  const url = new URL(window.location.href);
                  url.searchParams.delete('retakeMissed');
                  url.searchParams.set('retake', '1');
                  window.location.href = url.toString();
                }}
              >
                Retake all
              </Button>
            )}
            {result.perQuestion.some((pq) => !pq.isCorrect) && (
              <Button
                variant="secondary"
                onClick={() => {
                  leaveResults();
                  const url = new URL(window.location.href);
                  url.searchParams.delete('retake');
                  url.searchParams.set('retakeMissed', '1');
                  window.location.href = url.toString();
                }}
              >
                Retake missed only
              </Button>
            )}
            <Button variant="secondary" onClick={() => setFlashcardMode('all')}>
              Practice with flashcards
            </Button>
            {result.perQuestion.some((pq) => !pq.isCorrect) && (
              <Button variant="secondary" onClick={() => setFlashcardMode('missed')}>
                Flashcards: missed only
              </Button>
            )}
            {guest ? (
              <>
                <Button
                  onClick={() => {
                    leaveResults();
                    router.push('/register');
                  }}
                >
                  Create free account
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    leaveResults();
                    router.push(`/login?next=${encodeURIComponent(`/quizzes/${quiz.id}`)}`);
                  }}
                >
                  Log in &amp; take it for real
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    leaveResults();
                    router.push('/guest');
                  }}
                >
                  More guest practice
                </Button>
              </>
            ) : (
              <Button
                onClick={() => {
                  leaveResults();
                  router.push('/dashboard');
                }}
              >
                Go to dashboard
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="sticky top-16 z-20 -mx-4 border-b border-ink-100 bg-paper/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
        <div className="flex items-center justify-between gap-3 text-sm text-ink-500">
        <span>Question {current + 1} of {questions.length}</span>
        {hasTimer && (
          <span className="rounded-full bg-critical-50 px-2.5 py-1 font-mono text-xs font-semibold text-critical-600">
            {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')}
          </span>
        )}
        </div>
        <div className="mt-2 h-1.5 w-full rounded-full bg-ink-100">
        <div className="h-1 rounded-full bg-pulse-500 transition-all" style={{ width: `${progressPercent}%` }} />
      </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-ink-400">
          <span>{Math.round(progressPercent)}% complete</span>
          <span>{unansweredCount} unanswered</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {([
          { key: 'all', label: 'All' },
          { key: 'unanswered', label: 'Unanswered' },
          { key: 'answered', label: 'Answered' },
          { key: 'skipped', label: 'Skipped' },
        ] as const).map(({ key: k, label }) => (
          <button
            key={k}
            type="button"
            onClick={() => setProgressFilter(k)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
              progressFilter === k
                ? 'border-pulse-400 bg-pulse-50 text-pulse-700'
                : 'border-ink-100 text-ink-400 hover:bg-ink-50'
            }`}
          >
            {label} {k !== 'all' && `(${progressFilterCounts[k]})`}
          </button>
        ))}
      </div>

      <Card
        className="mt-6 p-4 sm:mt-8 sm:p-6"
        onCopy={isFirstAttempt ? blockCopy : undefined}
        onCut={isFirstAttempt ? blockCopy : undefined}
        onContextMenu={isFirstAttempt ? blockCopy : undefined}
      >
        <h2
          className={`font-display text-lg font-medium text-ink-800 ${isFirstAttempt ? 'select-none' : ''}`}
        >
          {question.prompt}
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => toggleMarkForReview(question.id)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
              markedForReview.has(question.id)
                ? 'border-flag-400 bg-flag-50 text-flag-600'
                : 'border-ink-100 text-ink-400 hover:bg-ink-50'
            }`}
          >
            {markedForReview.has(question.id) ? 'Marked ✓' : 'Mark for review'}
          </button>
          {quiz.showMarks && (
            <span className="rounded-full bg-ink-50 px-2.5 py-1 text-xs font-medium text-ink-500">
              {question.mark ?? quiz.defaultMark} mark{(question.mark ?? quiz.defaultMark) === 1 ? '' : 's'}
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-ink-400">How confident are you?</span>
          {(['sure', 'guessing'] as const).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => rateConfidence(level)}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                confidence[question.id] === level
                  ? 'border-pulse-400 bg-pulse-50 text-pulse-700'
                  : 'border-ink-100 text-ink-400 hover:bg-ink-50'
              }`}
            >
              {level}
            </button>
          ))}
        </div>

        <div className={`mt-6 space-y-2 ${isFirstAttempt ? 'select-none' : ''}`}>
          {question.type === 'mcq' &&
            question.options?.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setAnswerAndUnskip(question.id, opt.id)}
                onCopy={isFirstAttempt ? blockCopy : undefined}
                onContextMenu={isFirstAttempt ? blockCopy : undefined}
                className={`flex min-h-12 w-full items-center rounded-lg border px-4 py-3 text-left text-sm leading-6 transition-colors ${
                  answers[question.id] === opt.id
                    ? 'border-pulse-400 bg-pulse-50 text-pulse-700'
                    : 'border-ink-100 text-ink-700 hover:bg-ink-50'
                }`}
              >
                {opt.text}
              </button>
            ))}

          {question.type === 'true_false' &&
            ['True', 'False'].map((label) => (
              <button
                key={label}
                onClick={() => setAnswerAndUnskip(question.id, label)}
                className={`flex min-h-12 w-full items-center rounded-lg border px-4 py-3 text-left text-sm leading-6 transition-colors ${
                  answers[question.id] === label
                    ? 'border-pulse-400 bg-pulse-50 text-pulse-700'
                    : 'border-ink-100 text-ink-700 hover:bg-ink-50'
                }`}
              >
                {label}
              </button>
            ))}

          {question.type === 'fill_blank' && (
            <input
              type="text"
              value={answers[question.id] ?? ''}
              onChange={(e) => setAnswerAndUnskip(question.id, e.target.value)}
              placeholder="Type your answer"
              className="w-full select-text rounded-md border border-ink-100 px-4 py-3 text-sm focus:border-pulse-400 focus:outline-none"
            />
          )}
        </div>
      </Card>

      {error && <p className="mt-4 text-sm text-critical-500">{error}</p>}

      <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:justify-between">
        <Button
          variant="secondary"
          disabled={current === 0}
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
        >
          Previous
        </Button>
        <div className="col-span-2 grid grid-cols-2 gap-2 sm:col-span-1 sm:flex">
          {!isAnswered(question.id) && (
            <Button variant="secondary" onClick={skipQuestion}>
              Skip
            </Button>
          )}
          {current < questions.length - 1 ? (
            <Button onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}>
              Next
            </Button>
          ) : (
            <Button onClick={() => setShowSubmitConfirm(true)} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit'}
            </Button>
          )}
        </div>
      </div>

      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 px-4">
          <Card className="w-full max-w-sm p-6">
            <h3 className="font-display text-lg font-semibold text-ink-800">Submit {quiz.mode === 'exam' ? 'exam' : 'quiz'}?</h3>
            <p className="mt-2 text-sm text-ink-500">
              {unansweredCount > 0
                ? `You have ${unansweredCount} unanswered question${unansweredCount === 1 ? '' : 's'}. Once submitted, you can't change your answers.`
                : "Once submitted, you can't change your answers."}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowSubmitConfirm(false)}>
                Keep reviewing
              </Button>
              <Button
                onClick={() => {
                  setShowSubmitConfirm(false);
                  void handleSubmit();
                }}
                disabled={submitting}
              >
                {submitting ? 'Submitting…' : 'Yes, submit'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      <QuestionNavigator
        total={questions.length}
        current={current}
        states={navigatorStates}
        onJump={(i) => setCurrent(i)}
        className="mt-6"
      />

      {copyBlockedNotice && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md bg-ink-900 px-4 py-2.5 text-sm text-white shadow-lg">
          Copying is disabled on your first attempt at this quiz.
        </div>
      )}
    </div>
  );
}
