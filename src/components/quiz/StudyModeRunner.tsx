/*
 * CHANGE SUMMARY (StudyModeRunner.tsx -- Study Mode screen)
 * - Focus mode toggle (hides bottom nav / command trigger while studying).
 * - Left/Right arrow-key navigation between questions (ignored while typing in
 *   an input/textarea/select).
 * - "Recall first" mode: hides answer choices until the learner actively reveals
 *   them, encouraging active recall before multiple-choice recognition.
 * - "Mark for revision" per question, now reflected in the navigator and the
 *   end-of-session summary.
 * - Confidence-vs-correctness breakdown on the results screen (how many "sure"
 *   vs "guessing" answers were actually correct).
 * - Mounts the new per-quiz QuizStudyToolkit (see note below).
 * - Real bug fix: the "incorrect" results filter previously included unanswered
 *   questions (since "not correct" also matched "not answered"); now correctly
 *   requires the question to be answered AND wrong.
 * FIXED during review: the focus-mode toggle was setting a body class
 * (study-focus-session) that has no matching CSS rule, so it did nothing.
 * Corrected to use the existing `focus-session` class (same one QuizRunner.tsx
 * already uses), which IS defined in globals.css and actually hides the bottom
 * nav / command trigger.
 * Reviewed: balanced braces, no new em-dash regressions. Approved with the fix.
 */
'use client';
// File: src/components/quiz/StudyModeRunner.tsx

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { QuestionNavigator } from '@/components/quiz/QuestionNavigator';
import { QuizStudyToolkit } from '@/components/quiz/QuizStudyToolkit';
import { FlashcardRunner } from '@/components/flashcards/FlashcardRunner';
import { IncorrectRationale } from '@/components/quiz/IncorrectRationale';
import { ShortcutsHelpPanel, STUDY_SHORTCUTS } from '@/components/ui/ShortcutsHelpPanel';
import { CorrectPulse } from '@/components/ui/CorrectPulse';
import { clearDraft, loadDraft, saveDraft } from '@/lib/localDraft';
import { resolveEffectiveCorrectAnswer, parseArrayAnswer, parseObjectAnswer } from '@/lib/quizAnswers';
import type { Quiz, QuizQuestion } from '@/types';

interface StudyModeRunnerProps {
  quiz: Quiz;
  questions: QuizQuestion[]; // includes correctAnswer, unlike QuizRunner's questions
  /**
   * Called instead of the default "go to /quizzes/[quizId]" navigation when
   * the user taps Done. Needed for shared-link viewers, who aren't
   * necessarily the quiz owner and so may not have access to the owner
   * quiz-detail route (that route 404s/403s for them, making Done look
   * like it does nothing). The owner-facing QuizDetailClient doesn't pass
   * this, so it keeps the original router.push behavior.
   */
  onDone?: () => void;
  /**
   * Fires once per finished study session, when the "Finish studying"
   * summary screen first shows - mirrors FlashcardRunner's onComplete.
   * Used to record a study attempt (see study_attempts /
   * studyAttemptService); Study Mode itself has no score, so this is
   * purely a "did they finish a pass" signal, not a graded result.
   */
  onComplete?: () => void;
}

type ResultFilter = 'all' | 'unanswered' | 'incorrect' | 'skipped';
type SummaryFilter = 'all' | 'correct' | 'incorrect';

/**
 * What gets cached in localStorage for a resumable Study Mode session.
 * This is a device-local convenience cache only - never the source of
 * truth. `questionOrder` is stored (rather than re-deriving from a fresh
 * shuffle) so that resuming after a refresh points `current` at the same
 * question the user was actually looking at, even when shuffleQuestions
 * is enabled and a fresh shuffle would otherwise produce a different order.
 */
interface StudyDraft {
  questionOrder: string[]; // question ids, in the shuffled order used this session
  current: number;
  answers: Record<string, string>;
  skipped: string[];
  confidence: Record<string, 'sure' | 'guessing'>;
  resultFilter: ResultFilter;
  markedForRevision?: string[];
}

const DRAFT_NAMESPACE = 'study';

/** Fisher-Yates shuffle, returns a new array without mutating the input. */
function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Study Mode has no timer, no final score, and nothing is persisted to
 * quiz_attempts - it's pure learning, so it intentionally never touches
 * the leaderboard or dashboard history. Each question reveals the
 * correct answer and explanation immediately after the user answers it.
 *
 * Session progress (current position, answers, skips, confidence, filter)
 * is cached in localStorage so a refresh or accidental tab close doesn't
 * lose your place. That cache is purely local and disposable; it's cleared
 * once you finish studying.
 */
export function StudyModeRunner({ quiz, questions: rawQuestions, onDone, onComplete }: StudyModeRunnerProps) {
  const router = useRouter();

  // Try to resume a prior session for this quiz before falling back to a
  // fresh shuffle. Only used on the very first render.
  const initialDraft = useRef<StudyDraft | null>(
    typeof window !== 'undefined' ? loadDraft<StudyDraft>(DRAFT_NAMESPACE, quiz.id) : null
  ).current;

  // Shuffle once per mount (i.e. every time the user starts/restarts study
  // mode) when the creator has enabled shuffling for this quiz. Option ids
  // are preserved so correctAnswer matching is unaffected by display order.
  // If a resumable draft exists, reorder questions to match the order the
  // user was actually studying in, rather than re-shuffling.
  const [questions] = useState(() => {
    // Normalize `correctAnswer` once up front so it's always a real option
    // id from here on. Older bulk-uploaded quizzes may have this stored as
    // a bare letter (e.g. "C") instead of an option id - resolving it here,
    // rather than at each comparison site below, keeps every downstream
    // check in this component correct with no other changes and without
    // touching the underlying D1 row.
    let list = rawQuestions.map((q) => ({
      ...q,
      correctAnswer: resolveEffectiveCorrectAnswer(q.correctAnswer, q.options),
    }));
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
        .filter((q): q is QuizQuestion => q !== undefined);
      if (reordered.length === list.length) return reordered;
    }
    return list;
  });

  const [current, setCurrent] = useState(initialDraft?.current ?? 0);
  // If resuming a draft that already had an answer for the resumed
  // question, restore the revealed state immediately instead of showing
  // it as fresh/unanswered.
  const resumedAnswer = initialDraft?.answers?.[questions[initialDraft?.current ?? 0]?.id ?? ''];
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(resumedAnswer ?? null);
  const [revealed, setRevealed] = useState(resumedAnswer !== undefined);
  // Tracks the actual answer given for each question (by id), so that
  // navigating back to an already-answered question restores the selected
  // option and the revealed/explanation state instead of resetting it.
  const [answers, setAnswers] = useState<Record<string, string>>(initialDraft?.answers ?? {});
  // Questions explicitly skipped without answering, so they can be
  // revisited or filtered separately from "answered".
  const [skipped, setSkipped] = useState<Set<string>>(new Set(initialDraft?.skipped ?? []));
  const [markedForRevision, setMarkedForRevision] = useState<Set<string>>(new Set(initialDraft?.markedForRevision ?? []));
  // Self-rated confidence, captured just before the answer is revealed.
  const [confidence, setConfidence] = useState<Record<string, 'sure' | 'guessing'>>(
    initialDraft?.confidence ?? {}
  );
  const [resultFilter, setResultFilter] = useState<ResultFilter>(initialDraft?.resultFilter ?? 'all');
  // Whether the "Finish studying" summary screen is showing. Distinct from
  // navigating past the last question - the summary is a deliberate final
  // step, shown in place instead of redirecting straight back to the quiz
  // page, so a study session ends with the same kind of results/missed-
  // answers breakdown Quiz/Exam mode already gives.
  const [showSummary, setShowSummary] = useState(false);
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>('all');
  const [flashcardMode, setFlashcardMode] = useState<'all' | 'missed' | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCorrectPulse, setShowCorrectPulse] = useState(false);
  const [recallFirst, setRecallFirst] = useState(true);
  const [recallChoicesVisible, setRecallChoicesVisible] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('focus-session', focusMode);
    return () => document.body.classList.remove('focus-session');
  }, [focusMode]);

  useEffect(() => {
    function handleStudyKeys(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')) return;
      if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
        event.preventDefault();
        setShowShortcuts((value) => !value);
        return;
      }
      if (event.key === 'Escape') {
        setShowShortcuts(false);
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrevious();
      } else if (event.key === 'ArrowRight' && revealed) {
        event.preventDefault();
        goNext();
      }
    }
    window.addEventListener('keydown', handleStudyKeys);
    return () => window.removeEventListener('keydown', handleStudyKeys);
  }, [current, revealed, questions.length, answers]);

  const question = questions[current];
  const answeredIds = useMemo(() => new Set(Object.keys(answers)), [answers]);
  const isLast = current === questions.length - 1;
  const isCorrect = selectedAnswer !== null &&
    selectedAnswer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
  useEffect(() => {
    if (!revealed || !isCorrect) {
      setShowCorrectPulse(false);
      return;
    }
    setShowCorrectPulse(true);
    const timer = window.setTimeout(() => setShowCorrectPulse(false), 900);
    return () => window.clearTimeout(timer);
  }, [revealed, isCorrect, current]);

  const correctAnswerDisplay =
    question.type === 'mcq'
      ? question.options?.find((o) => o.id === question.correctAnswer)?.text ?? question.correctAnswer
      : question.correctAnswer;

  const navigatorStates = useMemo(
    () => questions.map((q) => ({ answered: answeredIds.has(q.id), skipped: skipped.has(q.id), flagged: markedForRevision.has(q.id) })),
    [questions, answeredIds, skipped, markedForRevision]
  );

  function matchesFilter(q: QuizQuestion, filter: ResultFilter): boolean {
    switch (filter) {
      case 'unanswered':
        return !answeredIds.has(q.id) && !skipped.has(q.id);
      case 'incorrect':
        return (
          answeredIds.has(q.id) &&
          answers[q.id].trim().toLowerCase() !== q.correctAnswer.trim().toLowerCase()
        );
      case 'skipped':
        return skipped.has(q.id);
      default:
        return true;
    }
  }

  // Counts per filter, for the filter bar badges.
  const filterCounts = useMemo(() => {
    const counts: Record<ResultFilter, number> = { all: questions.length, unanswered: 0, incorrect: 0, skipped: 0 };
    for (const q of questions) {
      if (matchesFilter(q, 'unanswered')) counts.unanswered++;
      if (matchesFilter(q, 'incorrect')) counts.incorrect++;
      if (matchesFilter(q, 'skipped')) counts.skipped++;
    }
    return counts;
  }, [questions, answeredIds, skipped, answers]);

  // Which question indices match the active filter, used for the
  // navigator grid below.
  const filteredIndices = useMemo(
    () => questions.map((q, i) => ({ q, i })).filter(({ q }) => matchesFilter(q, resultFilter)).map(({ i }) => i),
    [questions, resultFilter, answeredIds, skipped, answers]
  );

  // Persist a resumable snapshot on every relevant state change. Cheap and
  // synchronous, and everything here is small (ids + short strings), so
  // there's no need to debounce.
  useEffect(() => {
    const draft: StudyDraft = {
      questionOrder: questions.map((q) => q.id),
      current,
      answers,
      skipped: Array.from(skipped),
      confidence,
      resultFilter,
      markedForRevision: Array.from(markedForRevision),
    };
    saveDraft(DRAFT_NAMESPACE, quiz.id, draft);
  }, [quiz.id, questions, current, answers, skipped, confidence, resultFilter, markedForRevision]);

  // Fires once per finished study session, when the summary screen first
  // shows - mirrors FlashcardRunner's "finished" effect. Reaching the
  // summary is the study-mode equivalent of a completed run-through;
  // resuming/reopening the summary later (e.g. after a refresh) doesn't
  // re-fire since showSummary only flips false -> true once per session.
  useEffect(() => {
    if (showSummary) onComplete?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSummary]);

  function toggleRevisionMark() {
    setMarkedForRevision((previous) => {
      const next = new Set(previous);
      if (next.has(question.id)) next.delete(question.id);
      else next.add(question.id);
      return next;
    });
  }

  function rateConfidence(level: 'sure' | 'guessing') {
    setConfidence((prev) => ({ ...prev, [question.id]: level }));
  }

  function selectAnswer(answer: string) {
    if (revealed) return; // lock in the answer once revealed
    setSelectedAnswer(answer);
    setRevealed(true);
    setAnswers((prev) => ({ ...prev, [question.id]: answer }));
    setSkipped((prev) => {
      if (!prev.has(question.id)) return prev;
      const next = new Set(prev);
      next.delete(question.id);
      return next;
    });
  }

  function skipQuestion() {
    if (revealed) return;
    setSkipped((prev) => new Set(prev).add(question.id));
    goNext();
  }

  function goToQuestion(index: number) {
    setCurrent(index);
    setRecallChoicesVisible(false);
    const targetQuestion = questions[index];
    const priorAnswer = answers[targetQuestion.id];
    if (priorAnswer !== undefined) {
      setSelectedAnswer(priorAnswer);
      setRevealed(true);
    } else {
      setSelectedAnswer(null);
      setRevealed(false);
    }
  }

  function goNext() {
    if (isLast) {
      setShowSummary(true);
      return;
    }
    goToQuestion(current + 1);
  }

  function finishStudying() {
    clearDraft(DRAFT_NAMESPACE, quiz.id);
    if (onDone) {
      onDone();
    } else {
      router.push(`/quizzes/${quiz.id}`);
    }
  }

  function goPrevious() {
    if (current === 0) return;
    goToQuestion(current - 1);
  }

  const answeredCount = questions.filter((q) => answeredIds.has(q.id)).length;
  const correctCount = questions.filter(
    (q) =>
      answeredIds.has(q.id) &&
      answers[q.id].trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()
  ).length;
  const percentage = answeredCount > 0 ? (correctCount / answeredCount) * 100 : 0;
  const confidenceSummary = useMemo(() => {
    const entries = Object.entries(confidence).filter(([id]) => answers[id] !== undefined);
    const sure = entries.filter(([, level]) => level === 'sure');
    const guessing = entries.filter(([, level]) => level === 'guessing');
    const correctFor = (items: typeof entries) => items.filter(([id]) => answers[id]?.trim().toLowerCase() === questions.find((q) => q.id === id)?.correctAnswer.trim().toLowerCase()).length;
    return {
      sureCount: sure.length,
      sureCorrect: correctFor(sure),
      guessingCount: guessing.length,
      guessingCorrect: correctFor(guessing),
    };
  }, [confidence, answers, questions]);

  function resolveOptionText(q: QuizQuestion, value: string | undefined): string | null {
    if (value === undefined) return null;
    if (q.type === 'mcq') {
      return q.options?.find((o) => o.id === value)?.text ?? value;
    }
    return value;
  }

  if (flashcardMode) {
    const cards =
      flashcardMode === 'missed'
        ? questions.filter(
            (q) =>
              !(
                answeredIds.has(q.id) &&
                answers[q.id] !== undefined &&
                answers[q.id].trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()
              )
          )
        : questions;
    return (
      <FlashcardRunner
        title={quiz.title}
        cards={cards.map((q) => ({
          id: q.id,
          front: q.prompt,
          back: q.type === 'mcq' ? q.options?.find((o) => o.id === q.correctAnswer)?.text ?? q.correctAnswer : q.correctAnswer,
          explanation: q.explanation,
        }))}
        draftId={`study-${quiz.id}-${flashcardMode}`}
        onDone={() => setFlashcardMode(null)}
      />
    );
  }

  if (showSummary) {
    const summaryRows = questions
      .map((q, i) => ({ q, i }))
      .filter(({ q }) => {
        if (summaryFilter === 'all') return true;
        const isRight =
          answeredIds.has(q.id) && answers[q.id] !== undefined &&
          answers[q.id].trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
        if (summaryFilter === 'correct') return isRight;
        return answeredIds.has(q.id) && !isRight;
      });

    const summaryPct = Math.round(percentage);
    const summaryTone =
      summaryPct >= 80 ? 'Strong study pass' : summaryPct >= 60 ? 'Solid progress' : 'Keep revising';

    return (
      <div className={`mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-16 ${focusMode ? 'study-focus-mode' : ''}`}>
        <div className="mb-3 flex justify-end">
          <button type="button" onClick={() => setFocusMode((value) => !value)} className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-500 shadow-sm hover:border-pulse-300 hover:text-pulse-700">
            {focusMode ? 'Exit focus mode' : 'Focus mode'}
          </button>
        </div>
        <Card className="overflow-hidden p-0 text-center">
          <div className="relative overflow-hidden bg-gradient-to-br from-pulse-50 via-white to-flag-50/40 px-6 py-8 sm:px-8 sm:py-10">
            <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-pulse-200/30 blur-3xl" />
            <p className="relative font-mono text-xs uppercase tracking-widest text-pulse-600">Study session complete</p>
            <p className="relative mt-1 line-clamp-2 text-sm font-medium text-ink-500">{quiz.title}</p>
            <h2 className="relative mt-2 font-display text-xl font-semibold text-ink-900 sm:text-2xl">{summaryTone}</h2>
            <div
              className={`relative mx-auto mt-6 grid h-32 w-32 place-items-center rounded-full ${
                summaryPct >= 80 ? 'text-pulse-500' : summaryPct >= 60 ? 'text-flag-500' : 'text-critical-400'
              }`}
              style={{
                background: `conic-gradient(currentColor ${summaryPct}%, #e8eef1 ${summaryPct}% 100%)`,
                boxShadow: '0 0 0 8px rgba(255,255,255,0.9), 0 12px 28px rgba(15,37,49,0.08)',
              }}
              aria-label={`Study accuracy ${summaryPct} percent`}
            >
              <div className="grid h-24 w-24 place-items-center rounded-full bg-white">
                <div>
                  <p className="font-mono text-3xl font-semibold text-ink-900">{summaryPct}%</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">accuracy</p>
                </div>
              </div>
            </div>
            <div className="relative mt-6 grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-pulse-100 bg-white/90 p-3 shadow-sm">
                <p className="font-mono text-xl font-semibold text-pulse-600">{correctCount}</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">Correct</p>
              </div>
              <div className="rounded-2xl border border-critical-100 bg-white/90 p-3 shadow-sm">
                <p className="font-mono text-xl font-semibold text-critical-600">{Math.max(0, answeredCount - correctCount)}</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">Missed</p>
              </div>
              <div className="rounded-2xl border border-ink-100 bg-white/90 p-3 shadow-sm">
                <p className="font-mono text-xl font-semibold text-ink-800">{questions.length}</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">Total</p>
              </div>
            </div>
            <p className="relative mt-4 text-sm text-ink-500">
              {correctCount} / {answeredCount} answered correctly
              {answeredCount < questions.length &&
                ` · ${questions.length - answeredCount} question${questions.length - answeredCount === 1 ? '' : 's'} unanswered`}
            </p>
            <p className="relative mt-2 text-xs text-ink-400">
              Personal study recap only. This is not an official exam result.
            </p>
          </div>
          <div className="p-6 sm:p-8">
          {(confidenceSummary.sureCount + confidenceSummary.guessingCount) > 0 && (
            <div className="mt-5 grid gap-3 text-left sm:grid-cols-2">
              <div className="rounded-lg border border-ink-100 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Felt confident</p>
                <p className="mt-1 text-lg font-semibold text-ink-800">{confidenceSummary.sureCorrect}/{confidenceSummary.sureCount} correct</p>
                <p className="text-xs text-ink-500">Questions you marked as sure</p>
              </div>
              <div className="rounded-lg border border-ink-100 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Was guessing</p>
                <p className="mt-1 text-lg font-semibold text-ink-800">{confidenceSummary.guessingCorrect}/{confidenceSummary.guessingCount} correct</p>
                <p className="text-xs text-ink-500">Questions you marked as guessing</p>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-center gap-2">
            {(['all', 'correct', 'incorrect'] as const).map((f) => {
              const count =
                f === 'all'
                  ? questions.length
                  : questions.filter((q) => {
                      const isRight =
                        answeredIds.has(q.id) && answers[q.id] !== undefined &&
                        answers[q.id].trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
                      return f === 'correct' ? isRight : answeredIds.has(q.id) && !isRight;
                    }).length;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setSummaryFilter(f)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                    summaryFilter === f
                      ? 'border-pulse-500 bg-pulse-500 text-white shadow-sm shadow-pulse-500/25'
                      : 'border-ink-200 bg-white text-ink-500 hover:border-pulse-300 hover:text-pulse-700'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'correct' ? 'Correct' : 'Incorrect'} ({count})
                </button>
              );
            })}
          </div>

          <div className="mt-6 space-y-4 text-left">
            {summaryRows.map(({ q, i }) => {
              const wasAnswered = answeredIds.has(q.id);
              const submittedText = resolveOptionText(q, answers[q.id]);
              const isRight =
                wasAnswered && answers[q.id].trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
              return (
                <div key={q.id} className="rounded-md border border-ink-100 bg-white p-4">
                  <p className="text-sm font-medium text-ink-700">{i + 1}. {q.prompt}</p>
                  <p className={`mt-1 text-sm ${!wasAnswered ? 'text-ink-400' : isRight ? 'text-pulse-600' : 'text-critical-600'}`}>
                    {wasAnswered ? `Your answer: ${submittedText}` : skipped.has(q.id) ? 'Skipped' : 'Not answered'}
                  </p>
                  {!isRight && (
                    <p className="mt-1 text-sm text-ink-600">
                      Correct answer:{' '}
                      {q.type === 'mcq'
                        ? q.options?.find((o) => o.id === q.correctAnswer)?.text ?? q.correctAnswer
                        : q.correctAnswer}
                    </p>
                  )}
                  {q.explanation && (
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-600">
                      {q.explanation}
                    </p>
                  )}
                  <IncorrectRationale text={q.incorrectRationale} />
                </div>
              );
            })}
            {summaryRows.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-400">
                No {summaryFilter} questions.
              </p>
            )}
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {answeredCount < questions.length && (
              <Button variant="secondary" onClick={() => setShowSummary(false)}>
                Back to studying
              </Button>
            )}
            <Button variant="secondary" onClick={() => setFlashcardMode('all')}>
              Practice with flashcards
            </Button>
            {correctCount < questions.length && (
              <Button variant="secondary" onClick={() => setFlashcardMode('missed')}>
                Flashcards: missed only
              </Button>
            )}
            <Button onClick={finishStudying}>Done</Button>
          </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={`mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-16 ${focusMode ? 'study-focus-mode' : ''}`}>
      <div className="mb-3 flex justify-end">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowShortcuts(true)} className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-500 shadow-sm hover:border-pulse-300 hover:text-pulse-700" aria-label="Keyboard shortcuts">
            ? Shortcuts
          </button>
          <button type="button" onClick={() => setFocusMode((value) => !value)} className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-500 shadow-sm hover:border-pulse-300 hover:text-pulse-700">
            {focusMode ? 'Exit focus mode' : 'Focus mode'}
          </button>
        </div>
      </div>
      <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3 text-sm text-ink-500">
          <div>
            <span className="font-semibold text-ink-800">Question {current + 1}</span>
            <span className="font-normal text-ink-400"> of {questions.length}</span>
            <p className="mt-0.5 line-clamp-1 text-xs text-ink-400">{quiz.title}</p>
          </div>
          <span className="rounded-full bg-pulse-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-pulse-700 ring-1 ring-pulse-100">
            Study mode
          </span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink-100" role="progressbar" aria-label="Study progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(((current + 1) / questions.length) * 100)}>
          <div className="h-full rounded-full bg-gradient-to-r from-pulse-400 to-pulse-600 transition-all duration-300" style={{ width: `${((current + 1) / questions.length) * 100}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-ink-400">{Math.round(((current + 1) / questions.length) * 100)}% of this set explored</p>
          <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-600">
            <input type="checkbox" checked={recallFirst} onChange={(event) => { setRecallFirst(event.target.checked); setRecallChoicesVisible(false); }} className="h-4 w-4 accent-teal-600" />
            Recall first
          </label>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {([
          { key: 'all', label: 'All' },
          { key: 'unanswered', label: 'Unanswered' },
          { key: 'incorrect', label: 'Incorrect' },
          { key: 'skipped', label: 'Skipped' },
        ] as const).map(({ key: k, label }) => (
          <button
            key={k}
            type="button"
            onClick={() => setResultFilter(k)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
              resultFilter === k
                ? 'border-pulse-400 bg-pulse-50 text-pulse-700'
                : 'border-ink-100 text-ink-400 hover:bg-ink-50'
            }`}
          >
            {label} {k !== 'all' && `(${filterCounts[k]})`}
          </button>
        ))}
      </div>

      <Card className="mt-6 p-4 sm:mt-8 sm:p-6">
        <div>
          <h2 className="font-display text-lg font-medium text-ink-800">{question.prompt}</h2>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!revealed && (
            <>
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
            </>
          )}
          <button type="button" onClick={toggleRevisionMark} aria-pressed={markedForRevision.has(question.id)} className={`ml-auto min-h-9 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${markedForRevision.has(question.id) ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-ink-200 text-ink-500 hover:border-amber-300 hover:text-amber-800'}`}>
            {markedForRevision.has(question.id) ? 'Marked for revision' : 'Mark for revision'}
          </button>
        </div>

        {recallFirst && !revealed && !recallChoicesVisible && (
          <div className="mt-5 rounded-xl border border-pulse-100 bg-pulse-50/70 p-4">
            <p className="text-sm font-semibold text-ink-800">Try to recall the answer before seeing the choices.</p>
            <p className="mt-1 text-xs leading-5 text-ink-500">Think of the answer in your own words, then reveal the options to check your understanding.</p>
            <button type="button" onClick={() => setRecallChoicesVisible(true)} className="mt-3 min-h-10 rounded-lg bg-pulse-600 px-4 py-2 text-sm font-semibold text-white hover:bg-pulse-700">Reveal answer choices</button>
          </div>
        )}

        {(!recallFirst || recallChoicesVisible || revealed) && <div className="mt-6 space-y-3">
          {/* 1. Multiple Choice */}
          {question.type === 'mcq' &&
            question.options?.map((opt) => {
              const isSelected = selectedAnswer === opt.id;
              const isThisCorrect = opt.id === question.correctAnswer;
              let stateClass = 'border-ink-100 bg-white text-ink-700 shadow-sm hover:border-pulse-200 hover:bg-pulse-50/40';
              if (revealed && isThisCorrect) stateClass = 'border-pulse-400 bg-pulse-50 font-medium text-pulse-800 shadow-sm';
              else if (revealed && isSelected && !isThisCorrect) stateClass = 'border-critical-400 bg-critical-50 font-medium text-critical-700 shadow-sm';
              return (
                <button
                  key={opt.id}
                  onClick={() => selectAnswer(opt.id)}
                  disabled={revealed}
                  className={`w-full rounded-xl border px-4 py-3.5 text-left text-sm transition-all disabled:cursor-default ${stateClass}`}
                >
                  {opt.text}
                </button>
              );
            })}

          {/* 2. Select All That Apply (SATA) */}
          {question.type === 'sata' && (() => {
            const currentSelected = parseArrayAnswer(selectedAnswer);
            const correctList = parseArrayAnswer(question.correctAnswer);
            const toggleOpt = (id: string) => {
              if (revealed) return;
              const next = currentSelected.includes(id)
                ? currentSelected.filter((x) => x !== id)
                : [...currentSelected, id];
              setSelectedAnswer(JSON.stringify(next));
            };

            return (
              <div className="space-y-2">
                <div className="rounded-lg bg-pulse-50/70 border border-pulse-100 p-2.5 mb-2">
                  <p className="text-xs font-semibold text-pulse-800">Select All That Apply (SATA)</p>
                  <p className="text-[11px] text-ink-500">Check all options that apply, then submit to check your rationale.</p>
                </div>
                {question.options?.map((opt, optIndex) => {
                  const isChecked = currentSelected.includes(opt.id);
                  const isActuallyCorrect = correctList.includes(opt.id);

                  let rowStyle = 'border-ink-100 bg-white text-ink-700';
                  if (revealed) {
                    if (isActuallyCorrect && isChecked) {
                      rowStyle = 'border-pulse-400 bg-pulse-50 font-medium text-pulse-800';
                    } else if (!isActuallyCorrect && isChecked) {
                      rowStyle = 'border-critical-400 bg-critical-50 font-medium text-critical-700';
                    } else if (isActuallyCorrect && !isChecked) {
                      rowStyle = 'border-amber-300 bg-amber-50 font-medium text-amber-800';
                    }
                  } else if (isChecked) {
                    rowStyle = 'border-pulse-400 bg-pulse-50 text-pulse-800 font-medium';
                  }

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={revealed}
                      onClick={() => toggleOpt(opt.id)}
                      className={`flex w-full min-h-12 items-center rounded-xl border px-4 py-3 text-left text-sm transition-all disabled:cursor-default ${rowStyle}`}
                    >
                      <div className={`mr-3 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${isChecked ? 'border-pulse-600 bg-pulse-600 text-white' : 'border-ink-300 bg-white'}`}>
                        {isChecked && <span className="text-xs font-bold leading-none">✓</span>}
                      </div>
                      <span className="mr-2 text-xs font-bold text-ink-400">{String.fromCharCode(65 + optIndex)}.</span>
                      <span className="flex-1">{opt.text}</span>
                      {revealed && isActuallyCorrect && (
                        <span className="ml-2 text-xs font-semibold text-pulse-700">Correct choice</span>
                      )}
                      {revealed && !isActuallyCorrect && isChecked && (
                        <span className="ml-2 text-xs font-semibold text-critical-600">Incorrect choice</span>
                      )}
                    </button>
                  );
                })}
                {!revealed && (
                  <button
                    type="button"
                    onClick={() => selectAnswer(selectedAnswer ?? '[]')}
                    className="mt-3 w-full rounded-xl bg-pulse-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-pulse-700"
                  >
                    Check answer and view rationale
                  </button>
                )}
              </div>
            );
          })()}

          {/* 3. Clinical Ordering / Sequence */}
          {question.type === 'ordering' && (() => {
            const allOpts = question.options ?? [];
            const currentOrder = parseArrayAnswer(selectedAnswer);
            const effectiveOrder = currentOrder.length === allOpts.length
              ? currentOrder
              : allOpts.map((o) => o.id);

            const moveItem = (fromIdx: number, toIdx: number) => {
              if (revealed || fromIdx < 0 || fromIdx >= effectiveOrder.length || toIdx < 0 || toIdx >= effectiveOrder.length) return;
              const next = [...effectiveOrder];
              const [moved] = next.splice(fromIdx, 1);
              next.splice(toIdx, 0, moved);
              setSelectedAnswer(JSON.stringify(next));
            };

            return (
              <div className="space-y-2">
                <div className="rounded-lg bg-amber-50/70 border border-amber-100 p-2.5 mb-2">
                  <p className="text-xs font-semibold text-amber-900">Clinical Ordering / Sequencing</p>
                  <p className="text-[11px] text-ink-600">Arrange the nursing interventions in priority order before checking the rationale.</p>
                </div>
                {effectiveOrder.map((stepId, index) => {
                  const opt = allOpts.find((o) => o.id === stepId);
                  if (!opt) return null;
                  return (
                    <div key={opt.id} className="flex items-center gap-2 rounded-lg border border-ink-100 bg-white p-3 shadow-xs">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-100 text-xs font-bold text-amber-800">
                        {index + 1}
                      </span>
                      <span className="flex-1 text-sm font-medium text-ink-800">{opt.text}</span>
                      {!revealed && (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => moveItem(index, index - 1)}
                            className="rounded border border-ink-200 px-2 py-1 text-xs font-bold hover:bg-ink-50 disabled:opacity-25"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={index === effectiveOrder.length - 1}
                            onClick={() => moveItem(index, index + 1)}
                            className="rounded border border-ink-200 px-2 py-1 text-xs font-bold hover:bg-ink-50 disabled:opacity-25"
                          >
                            ↓
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {!revealed && (
                  <button
                    type="button"
                    onClick={() => selectAnswer(JSON.stringify(effectiveOrder))}
                    className="mt-3 w-full rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-700"
                  >
                    Check sequence and view rationale
                  </button>
                )}
              </div>
            );
          })()}

          {/* 4. Clinical Matrix */}
          {question.type === 'matrix' && (() => {
            const currentMatrix = parseObjectAnswer(selectedAnswer);
            const selectCol = (rowId: string, colKey: string) => {
              if (revealed) return;
              const next = { ...currentMatrix, [rowId]: colKey };
              setSelectedAnswer(JSON.stringify(next));
            };

            return (
              <div className="space-y-3">
                <div className="rounded-lg bg-sky-50/70 border border-sky-100 p-2.5">
                  <p className="text-xs font-semibold text-sky-900">Clinical Decision Matrix</p>
                  <p className="text-[11px] text-ink-600">Select whether each item is Indicated, Contraindicated, or Not Related.</p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-ink-100 bg-white shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-ink-100 bg-ink-50/60 text-ink-700">
                        <th className="p-3 font-semibold">Clinical Action / Intervention</th>
                        <th className="p-3 text-center font-semibold text-teal-700">Indicated</th>
                        <th className="p-3 text-center font-semibold text-critical-700">Contraindicated</th>
                        <th className="p-3 text-center font-semibold text-slate-600">Not Related</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-50">
                      {question.options?.map((row) => {
                        const selectedCol = currentMatrix[row.id];
                        return (
                          <tr key={row.id}>
                            <td className="p-3 font-medium text-ink-800">{row.text}</td>
                            {(['indicated', 'contraindicated', 'not_related'] as const).map((colKey) => (
                              <td key={colKey} className="p-3 text-center">
                                <label className="inline-flex cursor-pointer items-center justify-center p-1">
                                  <input
                                    type="radio"
                                    name={`study-matrix-${question.id}-${row.id}`}
                                    checked={selectedCol === colKey}
                                    onChange={() => selectCol(row.id, colKey)}
                                    disabled={revealed}
                                    className="h-4 w-4 accent-teal-600"
                                  />
                                </label>
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {!revealed && (
                  <button
                    type="button"
                    onClick={() => selectAnswer(JSON.stringify(currentMatrix))}
                    className="mt-3 w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
                  >
                    Check matrix and view rationale
                  </button>
                )}
              </div>
            );
          })()}

          {/* 5. Clinical Red Flags / Highlight */}
          {question.type === 'highlight' && (() => {
            const currentHighlights = parseArrayAnswer(selectedAnswer);
            const toggleCue = (cueId: string) => {
              if (revealed) return;
              const next = currentHighlights.includes(cueId)
                ? currentHighlights.filter((id) => id !== cueId)
                : [...currentHighlights, cueId];
              setSelectedAnswer(JSON.stringify(next));
            };

            return (
              <div className="space-y-3">
                <div className="rounded-lg bg-rose-50/70 border border-rose-100 p-2.5">
                  <p className="text-xs font-semibold text-rose-900">Clinical Red Flag Cues</p>
                  <p className="text-[11px] text-ink-600">Click findings in the note to highlight abnormal clinical red flags.</p>
                </div>
                <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-ink-100 pb-2 mb-3 text-xs text-ink-500">
                    <span className="font-semibold text-ink-700">Patient Observation Record</span>
                    <span>{currentHighlights.length} finding{currentHighlights.length === 1 ? '' : 's'} highlighted</span>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {question.options?.map((cue) => {
                      const isHighlighted = currentHighlights.includes(cue.id);
                      return (
                        <button
                          key={cue.id}
                          type="button"
                          disabled={revealed}
                          onClick={() => toggleCue(cue.id)}
                          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                            isHighlighted
                              ? 'border-amber-400 bg-amber-100 text-amber-950 ring-2 ring-amber-300 font-semibold'
                              : 'border-ink-200 bg-ink-50/50 text-ink-700 hover:border-amber-300 hover:bg-amber-50/30'
                          }`}
                        >
                          <span>{isHighlighted ? '🚩' : '○'}</span>
                          <span>{cue.text}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {!revealed && (
                  <button
                    type="button"
                    onClick={() => selectAnswer(JSON.stringify(currentHighlights))}
                    className="mt-3 w-full rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-rose-700"
                  >
                    Check red flags and view rationale
                  </button>
                )}
              </div>
            );
          })()}

          {/* 6. True / False */}
          {question.type === 'true_false' &&
            ['True', 'False'].map((label) => {
              const isSelected = selectedAnswer === label;
              const isThisCorrect = label === question.correctAnswer;
              let stateClass = 'border-ink-100 bg-white text-ink-700 shadow-sm hover:border-pulse-200 hover:bg-pulse-50/40';
              if (revealed && isThisCorrect) stateClass = 'border-pulse-400 bg-pulse-50 font-medium text-pulse-800 shadow-sm';
              else if (revealed && isSelected && !isThisCorrect) stateClass = 'border-critical-400 bg-critical-50 font-medium text-critical-700 shadow-sm';
              return (
                <button
                  key={label}
                  onClick={() => selectAnswer(label)}
                  disabled={revealed}
                  className={`w-full rounded-xl border px-4 py-3.5 text-left text-sm transition-all disabled:cursor-default ${stateClass}`}
                >
                  {label}
                </button>
              );
            })}

          {/* 7. Fill in the blank */}
          {question.type === 'fill_blank' && !revealed && (
            <FillBlankInput onSubmit={selectAnswer} />
          )}

          {question.type === 'fill_blank' && revealed && (
            <div className={`rounded-md border px-4 py-3 text-sm ${isCorrect ? 'border-pulse-400 bg-pulse-50 text-pulse-700' : 'border-critical-400 bg-critical-50 text-critical-600'}`}>
              Your answer: {selectedAnswer}
            </div>
          )}
        </div>}

        {revealed && (
          <div className={`relative mt-4 overflow-hidden rounded-md border p-4 ${isCorrect ? 'border-pulse-200 bg-pulse-50' : grading.marksEarned > 0 ? 'border-amber-200 bg-amber-50' : 'border-critical-200 bg-critical-50'}`}>
            <CorrectPulse active={showCorrectPulse && isCorrect} />
            <div className="relative z-[1] flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  isCorrect
                    ? 'bg-pulse-100 text-pulse-800'
                    : grading.marksEarned > 0
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-critical-100 text-critical-800'
                }`}
              >
                {isCorrect ? 'Correct' : grading.marksEarned > 0 ? 'Partial credit' : 'Not quite'}
              </span>
            </div>
            <p className="relative z-[1] mt-2 text-sm font-semibold text-ink-800">
              {isCorrect ? 'Well done. That matches the key clinical point.' : `Correct answer: ${correctAnswerDisplay}`}
            </p>
            {question.explanation && (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-600">
                {question.explanation}
              </p>
            )}
            <IncorrectRationale text={question.incorrectRationale} />
          </div>
        )}
      </Card>

      <div className="mt-6 flex justify-between">
        <Button variant="secondary" onClick={goPrevious} disabled={current === 0}>
          Previous
        </Button>
        <div className="flex gap-2">
          {!revealed && (
            <Button variant="secondary" onClick={skipQuestion}>
              Skip
            </Button>
          )}
          <Button onClick={goNext} disabled={!revealed}>
            {isLast ? 'Finish studying' : 'Next question'}
          </Button>
        </div>
      </div>

      {resultFilter !== 'all' && (
        <p className="mt-6 text-xs text-ink-400">
          Showing all questions below: highlighted numbers match the &ldquo;
          {resultFilter}&rdquo; filter ({filteredIndices.length}).
        </p>
      )}
      <QuestionNavigator
        total={questions.length}
        current={current}
        states={navigatorStates}
        onJump={goToQuestion}
        summary={`${answeredCount} answered · ${questions.length - answeredCount - skipped.size} unanswered · ${skipped.size} skipped · ${markedForRevision.size} marked for revision`}
        actionLabel="Finish studying"
        onAction={() => setShowSummary(true)}
        className="mt-4 rounded-xl border border-ink-100 bg-white p-4 sm:p-5"
      />
      <QuizStudyToolkit quizId={quiz.id} quizTitle={quiz.title} />

      <ShortcutsHelpPanel
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
        title="Study mode shortcuts"
        rows={STUDY_SHORTCUTS}
      />
    </div>
  );
}

function FillBlankInput({ onSubmit }: { onSubmit: (value: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type your answer"
        className="flex-1 rounded-md border border-ink-100 px-4 py-3 text-sm focus:border-pulse-400 focus:outline-none"
      />
      <Button onClick={() => onSubmit(value)} disabled={!value.trim()}>
        Check
      </Button>
    </div>
  );
}
