// File: src/components/quiz/QuizRunner.tsx
/*
 * CHANGE SUMMARY (QuizRunner.tsx -- live quiz/exam taking screen)
 * - Richer timer: color-coded urgency ring (teal -> amber -> red) with percentage
 *   and a status line ("Keep a steady pace" / "Time is running low" / "Finish and
 *   submit soon"), replacing the old plain mm:ss badge.
 * - Lettered MCQ options (A/B/C/D) with a per-option "cross out" (process of
 *   elimination) toggle; eliminated options are struck through and kept separate
 *   from the actual selected answer.
 * - The question navigator now shows a live summary (answered/unanswered/marked)
 *   and a built-in Submit button.
 * - Mounts the new per-quiz QuizStudyToolkit (notes/focus timer/streak, scoped to
 *   this quiz) below the navigator. See QuizStudyToolkit.tsx note below.
 * Reviewed: imports correct, braces/parens balanced. A pre-existing paren-count
 * false positive (string literal) exists in both old and new file -- not
 * introduced here. Approved as-is.
 */
// src/components/quiz/QuizRunner.tsx
'use client';
// File: src/components/quiz/QuizRunner.tsx

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ClipboardEvent, MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { QuestionNavigator } from '@/components/quiz/QuestionNavigator';
import { QuizStudyToolkit } from '@/components/quiz/QuizStudyToolkit';
import { FlashcardRunner } from '@/components/flashcards/FlashcardRunner';
import { IncorrectRationale } from '@/components/quiz/IncorrectRationale';
import { ShortcutsHelpPanel, QUIZ_SHORTCUTS } from '@/components/ui/ShortcutsHelpPanel';
import { parseArrayAnswer, parseObjectAnswer, formatAnswerDisplay } from '@/lib/quizAnswers';
import { clearDraft, loadDraft, saveDraft } from '@/lib/localDraft';
import { ATTEMPTED_QUIZZES_KEY, COPIED_EXPLANATIONS_KEY, makeId, readJson, writeJson } from '@/lib/services/localExtrasService';
import { MissReasonJournal } from '@/components/study/MissReasonJournal';
import { saveConfidenceEntries, saveScore } from '@/lib/services/localInsightsService';
// Feature #5: Animated score reveal + shareable PNG
import { AnimatedScoreReveal } from '@/components/quiz/AnimatedScoreReveal';
// Feature #13: Haptic feedback
import { haptic } from '@/lib/utils/haptics';
// Feature #14: Read-aloud for accessibility
import { ReadAloudButton } from '@/components/quiz/ReadAloudButton';
// NOTE: Feature #7 (keyboard nav) is implemented inline in this file
// (J/K/Arrow keys, 1-4 option select, F/M flag-for-review). The
// reusable useQuizKeyboardNav hook in ./KeyboardNav remains available
// for callers like StudyModeRunner that don't want to reimplement it.
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
const RESULT_META_NAMESPACE = 'attempt-result-meta';

interface ResultReviewMeta {
  markedForReview: string[];
  skipped: string[];
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

export function QuizRunner({ quiz, questions: rawQuestions, submitEndpoint, isFirstAttempt, onSubmitted, guest = false, gradeLocally }: QuizRunnerProps) {
  const router = useRouter();
  const { user } = useAuth();

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
  const initialResultMeta = useRef<ResultReviewMeta | null>(
    draftsEnabled && typeof window !== 'undefined' ? loadDraft<ResultReviewMeta>(RESULT_META_NAMESPACE, quiz.id) : null
  ).current;

  // Whether the cached draft actually belongs to THIS attempt. A length
  // match alone isn't enough -- two different attempts at the same quiz
  // (e.g. an abandoned run, then a fresh restart) can both have 60
  // questions, so a length-only check would silently reuse the old
  // attempt's answers, progress, and -- critically -- its startedAt
  // timestamp, producing a nonsense "time spent" on what is really a
  // brand-new attempt. Comparing the full set of question ids (order
  // doesn't matter here, only membership) is what actually tells us the
  // draft is a resume of this exact attempt rather than a coincidentally
  // same-sized stale one.
  const draftMatchesAttempt = (() => {
    if (!initialDraft?.questionOrder?.length) return false;
    if (initialDraft.questionOrder.length !== rawQuestions.length) return false;
    const currentIds = new Set(rawQuestions.map((q) => q.id));
    return initialDraft.questionOrder.every((id) => currentIds.has(id));
  })();

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

    if (draftMatchesAttempt && initialDraft) {
      const byId = new Map(list.map((q) => [q.id, q]));
      const reordered = initialDraft.questionOrder
        .map((id) => byId.get(id))
        .filter((q): q is Omit<QuizQuestion, 'correctAnswer'> => q !== undefined);
      if (reordered.length === list.length) return reordered;
    }
    return list;
  });

  // Every other draft field below is gated behind the same
  // draftMatchesAttempt check as the question order above, so a
  // non-matching (stale) draft never gets to silently supply progress,
  // answers, or -- the actual bug this fixes -- a startedAt timestamp
  // from an unrelated earlier attempt.
  const [current, setCurrent] = useState(draftMatchesAttempt ? initialDraft?.current ?? 0 : 0);
  const [answers, setAnswers] = useState<Record<string, string>>(draftMatchesAttempt ? initialDraft?.answers ?? {} : {});
  const [startedAt] = useState(() => (draftMatchesAttempt ? initialDraft?.startedAt ?? Date.now() : Date.now()));
  // Fixed point in time the attempt must end by, computed once (either
  // recovered from the draft, or freshly derived from startedAt + the
  // quiz's time limit). Never recomputed from a countdown -- see
  // AttemptDraft.deadline above for why.
  const [deadline] = useState<number | null>(() => {
    if (draftMatchesAttempt && initialDraft?.deadline) return initialDraft.deadline;
    if (!quiz.timeLimitSeconds) return null;
    return startedAt + quiz.timeLimitSeconds * 1000;
  });
  // Purely a display value, recomputed each tick from `deadline`  -  never
  // itself the source of truth for whether time is up.
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    deadline ? Math.max(0, Math.round((deadline - Date.now()) / 1000)) : 0
  );
  const [submitting, setSubmitting] = useState(false);
  // Synchronous re-entrancy guard for handleSubmit. `submitting` (state)
  // and `result` (state) are NOT safe to gate a submit on by themselves:
  // the timer's setInterval (checkDeadline) and the mount-time
  // auto-submit-on-expired-deadline path both close over whatever
  // `submitting`/`result` were at the render the interval/effect was set
  // up with, and state updates don't take effect until the next render.
  // That let a handful of ticks in a row - or the interval tick racing the
  // queueMicrotask auto-submit on mount - all read `submitting === false`
  // and all call handleSubmit() before the first POST's response (and the
  // resulting re-render) ever landed, each one writing its own
  // quiz_attempts row. A ref is read/written synchronously with no
  // render in between, so it closes the race.
  const submitInFlight = useRef(false);
  const [result, setResult] = useState<AttemptResult | null>(initialResult ?? null);
  const [error, setError] = useState<string | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [dismissDraftBanner, setDismissDraftBanner] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [largerQuestionText, setLargerQuestionText] = useState(false);
  const [comfortableQuestionSpacing, setComfortableQuestionSpacing] = useState(false);
  const [reduceStudyMotion, setReduceStudyMotion] = useState(false);
  const [attemptDurationSeconds, setAttemptDurationSeconds] = useState<number | null>(null);
  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem('cliniolab_local_study_toolkit_v1') || '{}');
      const prefs = stored.studyPreferences || {};
      setLargerQuestionText(Boolean(prefs.largerText));
      setComfortableQuestionSpacing(Boolean(prefs.comfortableSpacing));
      setReduceStudyMotion(Boolean(prefs.reduceMotion));
    } catch { /* Optional local preferences must never block a quiz. */ }
  }, []);
  const [eliminatedOptions, setEliminatedOptions] = useState<Record<string, string[]>>({});
  useEffect(() => { document.body.classList.toggle('focus-session', focusMode); return () => document.body.classList.remove('focus-session'); }, [focusMode]);
  const [resultFilter, setResultFilter] = useState<'all' | 'correct' | 'incorrect' | 'marked' | 'skipped'>('all');
  const [copiedExplanationId, setCopiedExplanationId] = useState<string | null>(null);
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
  const [progressFilter, setProgressFilter] = useState<'all' | 'unanswered' | 'answered' | 'skipped' | 'marked'>('all');
  const [confidence, setConfidence] = useState<Record<string, 'sure' | 'guessing'>>(
    draftMatchesAttempt ? initialDraft?.confidence ?? {} : {}
  );
  // Questions explicitly skipped without answering, so they can be
  // revisited or filtered separately from "answered".
  const [skipped, setSkipped] = useState<Set<string>>(new Set((draftMatchesAttempt ? initialDraft?.skipped : undefined) ?? initialResultMeta?.skipped ?? []));
  const [flaggedQuestionIds, setFlaggedQuestionIds] = useState<Set<string>>(new Set());
  const [flaggingQuestionId, setFlaggingQuestionId] = useState<string | null>(null);
  const [flagError, setFlagError] = useState<string | null>(null);
  // "Mark for review" during the attempt (CBT-style), distinct from the
  // post-result "report this question" flag above.
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(
    new Set((draftMatchesAttempt ? initialDraft?.markedForReview : undefined) ?? initialResultMeta?.markedForReview ?? [])
  );

  // Single source of truth for the results-screen review filters.
  function matchesReviewFilter(
    pq: { questionId: string; isCorrect: boolean },
    filter: 'all' | 'correct' | 'incorrect' | 'marked' | 'skipped'
  ): boolean {
    switch (filter) {
      case 'all': return true;
      case 'correct': return pq.isCorrect;
      case 'incorrect': return !pq.isCorrect;
      case 'marked': return markedForReview.has(pq.questionId);
      case 'skipped': return skipped.has(pq.questionId);
    }
  }

  function toggleMarkForReview(questionId: string) {    setMarkedForReview((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }

  function toggleEliminatedOption(questionId: string, optionId: string) {
    setEliminatedOptions((previous) => {
      const currentIds = previous[questionId] ?? [];
      const nextIds = currentIds.includes(optionId) ? currentIds.filter((id) => id !== optionId) : [...currentIds, optionId];
      return { ...previous, [questionId]: nextIds };
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
    // Feature #13 - Haptic feedback on mobile when an answer is selected.
    // Light vibration only; safe no-op on desktop (feature-detected).
    haptic('light');
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
    if (secondsLeft <= 0 && !submitInFlight.current) {
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
      // aren't fully wired up mid-render. submitInFlight guards against
      // this racing the timer interval's own checkDeadline call.
      queueMicrotask(() => {
        if (!submitInFlight.current) void handleSubmit();
      });
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

  // Desktop keyboard controls. These are purely local UI shortcuts and do
  // not create any network/database work. Ignore them while the user is
  // typing in a form control so normal text entry is never interrupted.
  useEffect(() => {
    if (result || submitting || !question) return;

    function handleQuizKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) return;

      if (event.key >= '1' && event.key <= '4' && question.options?.length) {
        const option = question.options[Number(event.key) - 1];
        if (option) {
          event.preventDefault();
          setAnswerAndUnskip(question.id, option.id);
        }
        return;
      }

      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCurrent((c) => Math.max(0, c - 1));
        return;
      }

      if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key.toLowerCase() === 'j') {
        event.preventDefault();
        setCurrent((c) => Math.min(questions.length - 1, c + 1));
        return;
      }

      // Feature #7 - 'f' is an alias for 'm' to mark/flag for review.
      // Matches the convention used by some CBT software.
      if (event.key.toLowerCase() === 'm' || event.key.toLowerCase() === 'f') {
        event.preventDefault();
        toggleMarkForReview(question.id);
        return;
      }

      if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
        event.preventDefault();
        setShowShortcuts((value) => !value);
        return;
      }

      if (event.key === 'Escape') {
        setShowShortcuts(false);
      }
    }

    window.addEventListener('keydown', handleQuizKeyDown);
    return () => window.removeEventListener('keydown', handleQuizKeyDown);
  }, [question, questions.length, result, submitting]);

  const progressPercent = useMemo(
    () => Math.round(((current + 1) / questions.length) * 100),
    [current, questions.length]
  );
  const timerPercent = hasTimer && quiz.timeLimitSeconds ? Math.max(0, Math.min(100, (remainingSeconds / quiz.timeLimitSeconds) * 100)) : 100;
  const timerUrgent = hasTimer && (remainingSeconds <= 60 || timerPercent <= 15);
  const timerWarning = hasTimer && !timerUrgent && timerPercent <= 30;
  const navigatorStates = useMemo(
    () =>
      questions.map((q) => ({
        answered: answers[q.id] !== undefined && answers[q.id] !== '',
        flagged: markedForReview.has(q.id),
        skipped: skipped.has(q.id),
        // Feature #3 - Ghost answer marker: indicates this question was
        // answered on a previous attempt of this quiz (cache lookup of
        // the missed-IDs record which only exists once the user has
        // attempted this quiz before). Pure visual aid; no behavior
        // change. Looked up once at memo time; safe if storage is empty.
        previouslyAnswered: (() => {
          if (typeof window === 'undefined') return false;
          try {
            const cacheOwner = guest ? 'guest' : (user?.id ?? 'anonymous');
            const raw = window.localStorage.getItem(`cl-missed:${quiz.id}:${cacheOwner}`);
            if (!raw) return false;
            const parsed = JSON.parse(raw) as { questionIds?: string[] };
            return Array.isArray(parsed.questionIds) && parsed.questionIds.includes(q.id);
          } catch {
            return false;
          }
        })(),
      })),
    [questions, answers, markedForReview, skipped, quiz.id, guest, user?.id]
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
      case 'marked':
        return markedForReview.has(questionId);
      default:
        return true;
    }
  }

  // Counts per progress filter, for the filter bar badges during the
  // attempt itself (not the post-submit results screen).
  const progressFilterCounts = useMemo(() => {
    const counts = { all: questions.length, unanswered: 0, answered: 0, skipped: 0, marked: 0 };
    for (const q of questions) {
      if (matchesProgressFilter(q.id, 'unanswered')) counts.unanswered++;
      if (matchesProgressFilter(q.id, 'answered')) counts.answered++;
      if (matchesProgressFilter(q.id, 'skipped')) counts.skipped++;
      if (matchesProgressFilter(q.id, 'marked')) counts.marked++;
    }
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, answers, skipped, markedForReview]);

  // The timer's setInterval callback is created once and would otherwise
  // close over the `answers` value from that render, so an auto-submit on
  // timeout would silently send an empty answer set even if the user had
  // answered everything. Keep a ref in sync with the latest answers so the
  // timeout path always submits what's actually been selected.
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // Log score history and confidence data locally for the insights panel,
  // once per result. Reuses data already present once grading completes.
  // Insights are a nicety and must never block or affect the results screen.
  const loggedInsightsForAttempt = useRef<string | null>(null);
  useEffect(() => {
    if (!result || loggedInsightsForAttempt.current === result.attemptId) return;
    loggedInsightsForAttempt.current = result.attemptId;
    try {
      const incorrectCount = result.perQuestion.filter((pq) => !pq.isCorrect).length;
      const correctCount = result.perQuestion.length - incorrectCount;
      saveScore({
        quizId: quiz.id,
        quizTitle: quiz.title,
        percentage: Math.round(result.percentage),
        totalQuestions: result.totalQuestions,
        correctCount,
        savedAt: new Date().toISOString(),
      });
      const confidenceEntries = result.perQuestion
        .filter((pq) => confidence[pq.questionId])
        .map((pq) => ({
          questionId: pq.questionId,
          quizId: quiz.id,
          quizTitle: quiz.title,
          prompt: pq.prompt.slice(0, 200),
          confidence: confidence[pq.questionId],
          isCorrect: pq.isCorrect,
          savedAt: new Date().toISOString(),
        }));
      if (confidenceEntries.length) saveConfidenceEntries(confidenceEntries);
    } catch {
      // Insights are a nicety; never block results.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

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
    if (submitInFlight.current || result) return;
    submitInFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const timeTakenSeconds = Math.round((Date.now() - startedAt) / 1000);
      setAttemptDurationSeconds(timeTakenSeconds);
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
      // Cache last attempt locally so quiz cards can show a "last: NN%" badge
      // without any server round trip. Client-side only.
      try {
        const cache = readJson<Record<string, { percentage: number; at: string }>>(
          ATTEMPTED_QUIZZES_KEY,
          {}
        );
        cache[quiz.id] = {
          percentage: Math.round(resultData.percentage),
          at: new Date().toISOString(),
        };
        writeJson(ATTEMPTED_QUIZZES_KEY, cache);
      } catch {
        // ignore, badge is a nicety
      }
      // Cache missed IDs for both signed-in and guest attempts. The user-scoped
      // key prevents one account on a shared device from seeing another account's list.
      try {
        const missedIds = resultData.perQuestion.filter((pq) => !pq.isCorrect).map((pq) => pq.questionId);
        const cacheOwner = guest ? 'guest' : (user?.id ?? 'anonymous');
        window.localStorage.setItem(`cl-missed:${quiz.id}:${cacheOwner}`, JSON.stringify({
          questionIds: missedIds,
          quizUpdatedAt: quiz.updatedAt,
          savedAt: Date.now(),
          userId: guest ? null : (user?.id ?? null),
        }));
        // Keep the legacy guest key because existing local revision tools read it.
        if (guest) window.localStorage.setItem(`cl-guest-missed:${quiz.id}`, JSON.stringify(missedIds));
      } catch {
        // Storage may be unavailable. Retake-missed will use the existing API fallback.
      }
      onSubmitted?.();
      if (draftsEnabled) {
        clearDraft(DRAFT_NAMESPACE, quiz.id);
        // Cache the result itself now, so a reload of this results screen
        // restores it instead of starting a fresh attempt. Cleared only
        // once the user actually navigates away (see leaveResults below).
        saveDraft(RESULT_NAMESPACE, quiz.id, resultData);
        saveDraft<ResultReviewMeta>(RESULT_META_NAMESPACE, quiz.id, {
          markedForReview: Array.from(markedForReview),
          skipped: Array.from(skipped),
        });
      }
    } catch {
      setError('Network error while submitting. Please try again.');
      submitInFlight.current = false;
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
    if (draftsEnabled) {
      clearDraft(RESULT_NAMESPACE, quiz.id);
      clearDraft(RESULT_META_NAMESPACE, quiz.id);
    }
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
    const roundedPercentage = Math.round(result.percentage);
    const incorrectCount = result.perQuestion.filter((pq) => !pq.isCorrect).length;
    const correctCount = result.perQuestion.length - incorrectCount;
    const resultTone = roundedPercentage >= 80 ? 'Excellent progress' : roundedPercentage >= 60 ? 'Good progress' : 'Keep building';
    const resultMessage = roundedPercentage >= 80
      ? 'You have a strong grasp of this set. Use the review below to polish the few gaps.'
      : roundedPercentage >= 60
        ? 'You are on the right track. A focused review of missed questions can move this score higher.'
        : 'Turn the missed questions into your next study session. Review, practise, then retake when ready.';

    const readiness = roundedPercentage >= 85
      ? { label: 'Exam ready', detail: 'Strong performance on this session.' }
      : roundedPercentage >= 70
        ? { label: 'Nearly ready', detail: 'A focused review can close the remaining gaps.' }
        : roundedPercentage >= 50
          ? { label: 'Developing', detail: 'Keep practising the missed concepts before your exam.' }
          : { label: 'Build your base', detail: 'Review the explanations, then try another short session.' };
    const achievement = roundedPercentage >= 90
      ? 'Clinical ace'
      : roundedPercentage >= 80
        ? 'Strong finish'
        : incorrectCount === 0
          ? 'Perfect run'
          : result.perQuestion.length >= 20
            ? 'Practice completed'
            : 'Session completed';
    const questionDensity = result.perQuestion.length >= 50
      ? { label: 'Intensive set', detail: 'Large question volume - use focused review breaks.' }
      : result.perQuestion.length >= 20
        ? { label: 'Standard set', detail: 'A balanced practice session for focused review.' }
        : { label: 'Focused set', detail: 'Short enough for targeted revision.' };

    return (
      <div className="quiz-results-print mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        {/* Print button intentionally removed: per project policy,
            no visitor should be able to print quiz content from the
            site, including results screens. window.print() would
            allow exactly that. */}
        <Card className="overflow-hidden p-0">
          <div className="relative overflow-hidden bg-gradient-to-br from-pulse-50 via-white to-flag-50/40 p-6 sm:p-9">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-center sm:text-left">
                <p className="font-mono text-xs uppercase tracking-widest text-pulse-600">
                  {quiz.mode === 'exam' ? 'Exam complete' : 'Quiz complete'}
                </p>
                <p className="mt-1 line-clamp-2 text-sm font-medium text-ink-500">{quiz.title}</p>
                <h2 className="mt-2 font-display text-2xl font-semibold text-ink-900 sm:text-3xl">{resultTone}</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-ink-500">{resultMessage}</p>
              </div>
              <div
                className={`relative grid h-36 w-36 shrink-0 place-items-center rounded-full ${
                  roundedPercentage >= 80
                    ? 'text-pulse-500'
                    : roundedPercentage >= 60
                      ? 'text-flag-500'
                      : 'text-critical-400'
                }`}
                style={{
                  background: `conic-gradient(currentColor ${roundedPercentage}%, #e8eef1 ${roundedPercentage}% 100%)`,
                  boxShadow: '0 0 0 8px rgba(255,255,255,0.9), 0 12px 28px rgba(15,37,49,0.08)',
                }}
                aria-label={`Score ${roundedPercentage} percent`}
              >
                <div className="grid h-28 w-28 place-items-center rounded-full bg-white shadow-inner">
                  <div className="text-center">
                    <p className="font-mono text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">{roundedPercentage}%</p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">score</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              <div className="rounded-2xl border border-pulse-100 bg-white/90 p-3.5 text-center shadow-sm backdrop-blur-sm">
                <p className="font-mono text-2xl font-semibold text-pulse-600">{correctCount}</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Correct</p>
              </div>
              <div className="rounded-2xl border border-critical-100 bg-white/90 p-3.5 text-center shadow-sm backdrop-blur-sm">
                <p className="font-mono text-2xl font-semibold text-critical-600">{incorrectCount}</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">To review</p>
              </div>
              <div className="rounded-2xl border border-ink-100 bg-white/90 p-3.5 text-center shadow-sm backdrop-blur-sm">
                <p className="font-mono text-2xl font-semibold text-ink-800">{result.totalQuestions}</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Questions</p>
              </div>
              <div className="rounded-2xl border border-ink-100 bg-white/90 p-3.5 text-center shadow-sm backdrop-blur-sm">
                <p className="font-mono text-2xl font-semibold text-ink-800">{attemptDurationSeconds === null ? 'N/A' : `${Math.floor(attemptDurationSeconds / 60)}m ${attemptDurationSeconds % 60}s`}</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Time spent</p>
              </div>
            </div>

            {/* Feature #5 - Animated score reveal + shareable PNG. Count-up
                animation on mount + a "Share as image" button that draws a
                branded result card on canvas and triggers Web Share / download.
                Pure client-side; no DB, no API call. */}
            <div className="mt-5 flex justify-center">
              <AnimatedScoreReveal
                percentage={result.percentage}
                correctCount={result.perQuestion.filter((pq) => pq.isCorrect).length}
                totalQuestions={result.totalQuestions}
                quizTitle={quiz.title}
              />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="rounded-xl border border-pulse-100 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-pulse-600">Exam readiness</p>
                    <p className="mt-1 text-base font-semibold text-ink-800">{readiness.label}</p>
                    <p className="mt-0.5 text-xs text-ink-500">{readiness.detail}</p>
                  </div>
                  <span className="rounded-full bg-pulse-50 px-3 py-1 text-xs font-semibold text-pulse-700">{achievement}</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-100">
                  <div className="h-full rounded-full bg-pulse-500 transition-all" style={{ width: `${roundedPercentage}%` }} />
                </div>
              </div>
              <div className="rounded-xl border border-ink-100 bg-white p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-widest text-ink-400">Review coverage</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-ink-800">{Math.round(((result.totalQuestions - incorrectCount) / Math.max(1, result.totalQuestions)) * 100)}%</p>
                <p className="text-xs text-ink-400">questions correct</p>
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-ink-500">
              {result.score} / {result.totalQuestions} correct
              {result.showMarks && ` · ${result.marksEarned} / ${result.totalMarks} marks`}
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-ink-100 bg-white px-3 py-2 text-left shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">Session density</p>
                <p className="mt-1 text-sm font-semibold text-ink-800">{questionDensity.label}</p>
                <p className="mt-0.5 text-xs text-ink-400">{questionDensity.detail}</p>
              </div>
              <div className="rounded-xl border border-pulse-100 bg-pulse-50/60 px-3 py-2 text-left shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-pulse-600">Achievement</p>
                <p className="mt-1 text-sm font-semibold text-ink-800">{achievement}</p>
                <p className="mt-0.5 text-xs text-ink-500">Use the filters below to turn this result into your next study session.</p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
          <div className={`mb-5 rounded-xl border p-4 ${incorrectCount > 0 ? 'border-amber-200 bg-amber-50/70' : 'border-pulse-100 bg-pulse-50/60'}`} aria-live="polite">
            <p className={`text-xs font-semibold uppercase tracking-wide ${incorrectCount > 0 ? 'text-amber-800' : 'text-pulse-700'}`}>Recommended next step</p>
            <p className="mt-1 text-sm font-semibold text-ink-800">{incorrectCount > 0 ? `Review ${incorrectCount} question${incorrectCount === 1 ? '' : 's'} you missed, then retest your recall.` : 'You answered every question correctly. Reinforce recall with a short flashcard session.'}</p>
            <p className="mt-1 text-xs leading-5 text-ink-600">Use the filters below to review the exact questions. Where supported, you can also turn questions into flashcards without creating new content.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {incorrectCount > 0 && <button type="button" onClick={() => setResultFilter('incorrect')} className="min-h-10 rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800">Review incorrect answers</button>}
              <button type="button" onClick={() => setFlashcardMode(incorrectCount > 0 ? 'missed' : 'all')} className="min-h-10 rounded-lg border border-pulse-200 bg-white px-3 py-2 text-xs font-semibold text-pulse-700 hover:bg-pulse-50">{incorrectCount > 0 ? 'Practise missed questions as flashcards' : 'Practise with flashcards'}</button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-100 bg-ink-50/60 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-ink-800">Review your answers</p>
              <p className="mt-0.5 text-xs text-ink-400">Focus on the questions marked for review.</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink-600">{incorrectCount} to review</span>
          </div>
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
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {(['all', 'correct', 'incorrect', 'marked', 'skipped'] as const).map((f) => {
              const count =
                f === 'all'
                  ? result.perQuestion.length
                  : f === 'correct'
                    ? result.perQuestion.filter((pq) => pq.isCorrect).length
                    : f === 'incorrect'
                      ? result.perQuestion.filter((pq) => !pq.isCorrect).length
                      : f === 'marked'
                        ? result.perQuestion.filter((pq) => markedForReview.has(pq.questionId)).length
                        : result.perQuestion.filter((pq) => skipped.has(pq.questionId)).length;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setResultFilter(f)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                    resultFilter === f
                      ? 'border-pulse-500 bg-pulse-500 text-white shadow-sm shadow-pulse-500/25'
                      : 'border-ink-200 bg-white text-ink-500 hover:border-pulse-300 hover:text-pulse-700'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'correct' ? 'Correct' : f === 'incorrect' ? 'Incorrect' : f === 'marked' ? 'Marked' : 'Skipped'} ({count})
                </button>
              );
            })}
          </div>
          <div className="mt-6 space-y-4 text-left">
            {result.perQuestion
              .map((pq, i) => ({ pq, i }))
              .filter(({ pq }) =>
                matchesReviewFilter(pq, resultFilter)
              )
              .map(({ pq, i }) => {
              const submittedText = formatAnswerDisplay(pq.type, pq.submittedAnswer, pq.options);
              const correctText = formatAnswerDisplay(pq.type, pq.correctAnswer, pq.options);
              const earnedMarks = pq.marksEarned !== undefined ? pq.marksEarned : (pq.isCorrect ? pq.mark : 0);
              return (
              <div
                key={pq.questionId}
                className={`rounded-xl border bg-white p-4 shadow-sm sm:p-5 ${
                  pq.isCorrect
                    ? 'border-pulse-100 border-l-4 border-l-pulse-500'
                    : earnedMarks > 0
                      ? 'border-amber-200 border-l-4 border-l-amber-500'
                      : 'border-critical-100 border-l-4 border-l-critical-400'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-ink-50 px-2 py-0.5 font-mono text-[10px] font-bold text-ink-500">
                        Q{i + 1}
                      </span>
                      {pq.type && (
                        <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold text-ink-600 uppercase tracking-wide">
                          {pq.type === 'sata' ? 'Select All That Apply' : pq.type === 'ordering' ? 'Clinical Ordering' : pq.type === 'matrix' ? 'Clinical Matrix' : pq.type === 'highlight' ? 'Red Flag Cues' : pq.type.toUpperCase()}
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          pq.isCorrect
                            ? 'bg-pulse-50 text-pulse-700'
                            : earnedMarks > 0
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-critical-50 text-critical-700'
                        }`}
                      >
                        {pq.isCorrect ? 'Correct' : earnedMarks > 0 ? 'Partial Credit' : 'Review'}
                      </span>
                    </div>
                    <p className="text-sm font-medium leading-6 text-ink-800">{pq.prompt}</p>
                  </div>
                  {result.showMarks && (
                    <span className="shrink-0 rounded-lg bg-ink-50 px-2 py-1 text-xs font-semibold text-ink-500">
                      {earnedMarks} / {pq.mark} mark{pq.mark === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                <p className={`mt-2 text-sm ${pq.isCorrect ? 'text-pulse-600' : earnedMarks > 0 ? 'text-amber-800' : 'text-critical-600'}`}>
                  Your answer: {submittedText}
                </p>
                {!pq.isCorrect && (
                  <p className="mt-1 text-sm text-ink-700 font-medium">Correct answer: {correctText}</p>
                )}

                {/* Specific review breakdowns for clinical question types */}
                {pq.type === 'sata' && pq.options && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide">SATA Evaluation:</p>
                    {pq.options.map((opt, optIdx) => {
                      const correctList = parseArrayAnswer(pq.correctAnswer);
                      const submittedList = parseArrayAnswer(pq.submittedAnswer);
                      const isCorrectChoice = correctList.includes(opt.id);
                      const isUserChoice = submittedList.includes(opt.id);

                      let badgeText = 'Correctly left unselected';
                      let rowStyle = 'border-ink-100 bg-white text-ink-600';
                      if (isCorrectChoice && isUserChoice) {
                        badgeText = 'Correctly selected (+1)';
                        rowStyle = 'border-pulse-300 bg-pulse-50 text-pulse-800 font-medium';
                      } else if (!isCorrectChoice && isUserChoice) {
                        badgeText = 'Incorrectly selected (-1)';
                        rowStyle = 'border-critical-300 bg-critical-50 text-critical-700 font-medium';
                      } else if (isCorrectChoice && !isUserChoice) {
                        badgeText = 'Missed correct answer';
                        rowStyle = 'border-amber-300 bg-amber-50 text-amber-800 font-medium';
                      }

                      return (
                        <div key={opt.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${rowStyle}`}>
                          <span><strong className="mr-2 text-xs">{String.fromCharCode(65 + optIdx)}.</strong>{opt.text}</span>
                          <span className="text-xs font-semibold shrink-0 ml-2">{badgeText}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {pq.type === 'matrix' && pq.options && (
                  <div className="mt-3 overflow-x-auto rounded-lg border border-ink-100">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-ink-50 text-ink-600 border-b border-ink-100">
                        <tr>
                          <th className="p-2.5 font-medium">Intervention / Finding</th>
                          <th className="p-2.5 font-medium">Your Selection</th>
                          <th className="p-2.5 font-medium">Correct Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-50">
                        {pq.options.map((row) => {
                          const correctMap = parseObjectAnswer(pq.correctAnswer);
                          const userMap = parseObjectAnswer(pq.submittedAnswer);
                          const correctCol = correctMap[row.id] ?? 'indicated';
                          const userCol = userMap[row.id];
                          const isRowMatch = userCol === correctCol;
                          const label = (c?: string) => c === 'indicated' ? 'Indicated' : c === 'contraindicated' ? 'Contraindicated' : c === 'not_related' ? 'Not Related' : 'Unanswered';
                          return (
                            <tr key={row.id} className={isRowMatch ? 'bg-pulse-50/30' : 'bg-critical-50/30'}>
                              <td className="p-2.5 font-medium text-ink-800">{row.text}</td>
                              <td className={`p-2.5 font-semibold ${isRowMatch ? 'text-pulse-700' : 'text-critical-600'}`}>{label(userCol)}</td>
                              <td className="p-2.5 font-semibold text-ink-700">{label(correctCol)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {pq.type === 'ordering' && pq.options && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg border border-ink-100 p-2.5 bg-ink-50/50">
                      <p className="font-semibold text-ink-600 mb-1.5 uppercase tracking-wide text-[10px]">Your Sequence:</p>
                      <ol className="space-y-1 list-decimal list-inside text-ink-700">
                        {parseArrayAnswer(pq.submittedAnswer).map((id) => (
                          <li key={id}>{pq.options.find(o => o.id === id)?.text ?? id}</li>
                        ))}
                      </ol>
                    </div>
                    <div className="rounded-lg border border-pulse-200 p-2.5 bg-pulse-50/40">
                      <p className="font-semibold text-pulse-800 mb-1.5 uppercase tracking-wide text-[10px]">Correct Clinical Sequence:</p>
                      <ol className="space-y-1 list-decimal list-inside text-pulse-900 font-medium">
                        {parseArrayAnswer(pq.correctAnswer).map((id) => (
                          <li key={id}>{pq.options.find(o => o.id === id)?.text ?? id}</li>
                        ))}
                      </ol>
                    </div>
                  </div>
                )}

                {pq.type === 'highlight' && pq.options && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide">Clinical Red Flag Cues:</p>
                    <div className="flex flex-wrap gap-2">
                      {pq.options.map((cue) => {
                        const correctList = parseArrayAnswer(pq.correctAnswer);
                        const userList = parseArrayAnswer(pq.submittedAnswer);
                        const isRedFlag = correctList.includes(cue.id);
                        const wasUserFlagged = userList.includes(cue.id);
                        let badgeStyle = 'bg-ink-100 text-ink-600';
                        let note = '';
                        if (isRedFlag && wasUserFlagged) {
                          badgeStyle = 'bg-pulse-100 text-pulse-800 font-semibold ring-1 ring-pulse-300';
                          note = ' (Correct flag)';
                        } else if (!isRedFlag && wasUserFlagged) {
                          badgeStyle = 'bg-critical-100 text-critical-700 font-semibold ring-1 ring-critical-300';
                          note = ' (False alarm)';
                        } else if (isRedFlag && !wasUserFlagged) {
                          badgeStyle = 'bg-amber-100 text-amber-800 font-semibold ring-1 ring-amber-300';
                          note = ' (Missed red flag)';
                        }
                        return (
                          <span key={cue.id} className={`rounded-full px-3 py-1 text-xs ${badgeStyle}`}>
                            {cue.text}{note}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(!pq.type || pq.type === 'mcq') && pq.options && pq.options.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {pq.options.map((opt) => {
                      const isCorrectOpt = opt.id === pq.correctAnswer;
                      const isSubmittedOpt = opt.id === pq.submittedAnswer;
                      return (
                        <li
                          key={opt.id}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                            isCorrectOpt
                              ? 'border-pulse-300 bg-pulse-50 font-medium text-pulse-800'
                              : isSubmittedOpt
                                ? 'border-critical-300 bg-critical-50 font-medium text-critical-700'
                                : 'border-ink-100 bg-white text-ink-600'
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
                  <div className="mt-3 rounded-lg border border-ink-100 bg-ink-50/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">Explanation</p>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(pq.explanation ?? '');
                          } catch {
                            const textarea = document.createElement('textarea');
                            textarea.value = pq.explanation ?? '';
                            textarea.style.position = 'fixed';
                            textarea.style.opacity = '0';
                            document.body.appendChild(textarea);
                            textarea.focus();
                            textarea.select();
                            document.execCommand('copy');
                            document.body.removeChild(textarea);
                          }
                          try {
                            const log = readJson<
                              Array<{ id: string; quizTitle: string; prompt: string; explanation: string; copiedAt: string }>
                            >(COPIED_EXPLANATIONS_KEY, []);
                            const next = [
                              {
                                id: makeId(),
                                quizTitle: quiz.title,
                                prompt: pq.prompt,
                                explanation: pq.explanation ?? '',
                                copiedAt: new Date().toISOString(),
                              },
                              ...log,
                            ].slice(0, 20);
                            writeJson(COPIED_EXPLANATIONS_KEY, next);
                          } catch {
                            // ignore
                          }
                          setCopiedExplanationId(pq.questionId);
                          window.setTimeout(() => setCopiedExplanationId((id) => id === pq.questionId ? null : id), 1800);
                        }}
                        className="rounded-md border border-ink-200 bg-white px-2 py-1 text-[11px] font-semibold text-ink-500 transition hover:border-pulse-300 hover:text-pulse-700 focus:outline-none focus:ring-2 focus:ring-pulse-300"
                      >
                        {copiedExplanationId === pq.questionId ? 'Copied' : 'Copy explanation'}
                      </button>
                    </div>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-600">
                      {pq.explanation}
                    </p>
                  </div>
                )}
                <IncorrectRationale text={pq.incorrectRationale} />
                {!pq.isCorrect && (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Link
                      href={`/search?q=${encodeURIComponent(pq.prompt.slice(0, 80))}`}
                      className="inline-flex items-center rounded-lg border border-pulse-200 bg-pulse-50 px-3 py-1.5 text-xs font-semibold text-pulse-700 transition hover:bg-pulse-100"
                    >
                      Learn this topic →
                    </Link>
                  </div>
                )}
                {!pq.isCorrect && (
                  <MissReasonJournal
                    questionId={pq.questionId}
                    quizId={quiz.id}
                    quizTitle={quiz.title}
                    prompt={pq.prompt}
                  />
                )}
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
              matchesReviewFilter(pq, resultFilter)
            ).length === 0 && (
              <p className="py-6 text-center text-sm text-ink-400">
                No questions match this review filter.
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
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={`${focusMode ? 'quiz-focus-mode' : ''} ${reduceStudyMotion ? 'cliniolab-reduce-motion' : ''} mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12`}>
      {reduceStudyMotion && <style>{`.cliniolab-reduce-motion *, .cliniolab-reduce-motion *::before, .cliniolab-reduce-motion *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }`}</style>}
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={() => setLargerQuestionText((value) => !value)} aria-pressed={largerQuestionText} className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-500 shadow-sm hover:border-pulse-300 hover:text-pulse-700">{largerQuestionText ? 'Standard text' : 'Larger text'}</button>
        <button type="button" onClick={() => setComfortableQuestionSpacing((value) => !value)} aria-pressed={comfortableQuestionSpacing} className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-500 shadow-sm hover:border-pulse-300 hover:text-pulse-700">{comfortableQuestionSpacing ? 'Standard spacing' : 'More spacing'}</button>
        <button type="button" onClick={() => setFocusMode((value) => !value)} className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-500 shadow-sm hover:border-pulse-300 hover:text-pulse-700">{focusMode ? 'Exit focus mode' : 'Focus mode'}</button>
      </div>
      {draftsEnabled && initialDraft && draftMatchesAttempt && !dismissDraftBanner && !result && (
        <div className="mb-4 rounded-xl border border-pulse-200 bg-pulse-50 px-4 py-3 text-sm text-ink-700 shadow-sm" role="status">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-ink-800">Unfinished attempt on this device</p>
              <p className="mt-1 text-xs text-ink-500">
                Your previous answers were restored from local draft storage. Continue or dismiss this notice.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDismissDraftBanner(true)}
              className="shrink-0 rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-semibold text-ink-600 hover:border-pulse-300 hover:text-pulse-700"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="sticky top-16 z-20 -mx-4 border-b border-ink-100 bg-paper/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
        <div className="flex items-start justify-between gap-3 text-sm text-ink-500">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink-700">Question {current + 1} <span className="font-normal text-ink-400">of {questions.length}</span></p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink-100" role="progressbar" aria-label="Question progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressPercent)}>
              <div className="h-full rounded-full bg-gradient-to-r from-pulse-400 to-pulse-600 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-ink-400">
              <span>{Math.round(progressPercent)}% complete</span>
              <span>{unansweredCount} unanswered</span>
            </div>
          </div>
          {hasTimer && (
            <div className={`flex shrink-0 items-center gap-3 rounded-2xl border px-3 py-2.5 shadow-sm ${timerUrgent ? 'border-critical-300 bg-critical-50 text-critical-700' : timerWarning ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-pulse-100 bg-white text-ink-700'}`} aria-live={timerUrgent ? 'assertive' : 'off'}>
              <div className="relative h-12 w-12 rounded-full p-[4px]" style={{ background: `conic-gradient(${timerUrgent ? '#dc2626' : timerWarning ? '#d97706' : '#0d9488'} ${timerPercent}%, #e5e7eb ${timerPercent}% 100%)` }} aria-hidden="true">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-[10px] font-bold text-ink-700">{Math.ceil(timerPercent)}%</div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-70">Time left</p>
                <p className="font-mono text-xl font-bold tabular-nums leading-tight">{String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:{String(remainingSeconds % 60).padStart(2, '0')}</p>
                <p className="mt-0.5 text-[10px] font-medium">{timerUrgent ? 'Finish and submit soon' : timerWarning ? 'Time is running low' : 'Keep a steady pace'}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {([
          { key: 'all', label: 'All' },
          { key: 'unanswered', label: 'Unanswered' },
          { key: 'answered', label: 'Answered' },
          { key: 'skipped', label: 'Skipped' },
          { key: 'marked', label: 'Marked' },
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
          className={`font-display ${largerQuestionText ? 'text-xl sm:text-2xl' : 'text-lg'} ${comfortableQuestionSpacing ? 'leading-8 tracking-[0.01em]' : 'leading-normal'} font-medium text-ink-800 ${isFirstAttempt ? 'select-none' : ''}`}
        >
          {question.prompt}
        </h2>
        {/* Feature #14 - Read-aloud button for accessibility. Pure client-side SpeechSynthesis. */}
        <div className="mt-1">
          <ReadAloudButton text={question.prompt} variant="ghost" />
        </div>
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

        <div className={`mt-6 space-y-3 ${isFirstAttempt ? 'select-none' : ''}`}>
          {/* 1. Multiple Choice (MCQ) */}
          {question.type === 'mcq' &&
            question.options?.map((opt, optionIndex) => {
              const eliminated = (eliminatedOptions[question.id] ?? []).includes(opt.id);
              return (
                <div key={opt.id} className={`flex items-stretch gap-2 ${eliminated ? 'opacity-70' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setAnswerAndUnskip(question.id, opt.id)}
                    aria-label={`Answer option ${optionIndex + 1}: ${opt.text}${eliminated ? ', marked for elimination' : ''}`}
                    aria-pressed={answers[question.id] === opt.id}
                    onCopy={isFirstAttempt ? blockCopy : undefined}
                    onContextMenu={isFirstAttempt ? blockCopy : undefined}
                    className={`flex min-h-12 min-w-0 flex-1 items-center rounded-lg border px-4 py-3 text-left text-sm leading-6 transition-colors focus:outline-none focus:ring-2 focus:ring-pulse-300 ${
                      answers[question.id] === opt.id
                        ? 'border-pulse-400 bg-pulse-50 text-pulse-700 font-medium'
                        : eliminated
                          ? 'border-ink-100 bg-ink-50 text-ink-400 line-through'
                          : 'border-ink-100 text-ink-700 hover:bg-ink-50'
                    }`}
                  >
                    <span className="mr-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs font-semibold">{String.fromCharCode(65 + optionIndex)}</span>
                    <span>{opt.text}</span>
                    {answers[question.id] === opt.id && <span className="ml-auto pl-2 text-xs font-semibold">Selected</span>}
                  </button>
                  <button type="button" onClick={() => toggleEliminatedOption(question.id, opt.id)} aria-pressed={eliminated} aria-label={`${eliminated ? 'Restore' : 'Eliminate'} option ${optionIndex + 1}`} title={eliminated ? 'Restore option' : 'Cross out option'} className={`min-h-12 w-11 shrink-0 rounded-lg border text-lg font-semibold transition-colors ${eliminated ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-ink-100 bg-white text-ink-400 hover:border-amber-300 hover:text-amber-700'}`}>{eliminated ? '↺' : '×'}</button>
                </div>
              );
            })}

          {/* 2. Select All That Apply (SATA) */}
          {question.type === 'sata' && (
            <div className="space-y-2">
              <div className="rounded-lg bg-pulse-50/70 border border-pulse-100 p-2.5 mb-2">
                <p className="text-xs font-semibold text-pulse-800">Select All That Apply (SATA)</p>
                <p className="text-[11px] text-ink-500">Choose every option that applies. Partial credit is awarded.</p>
              </div>
              {question.options?.map((opt, optionIndex) => {
                const eliminated = (eliminatedOptions[question.id] ?? []).includes(opt.id);
                const currentSelected = parseArrayAnswer(answers[question.id]);
                const isSelected = currentSelected.includes(opt.id);
                const toggleSata = () => {
                  const next = isSelected
                    ? currentSelected.filter((id) => id !== opt.id)
                    : [...currentSelected, opt.id];
                  setAnswerAndUnskip(question.id, JSON.stringify(next));
                };

                return (
                  <div key={opt.id} className={`flex items-stretch gap-2 ${eliminated ? 'opacity-70' : ''}`}>
                    <button
                      type="button"
                      onClick={toggleSata}
                      aria-label={`SATA Option ${optionIndex + 1}: ${opt.text}`}
                      aria-pressed={isSelected}
                      className={`flex min-h-12 min-w-0 flex-1 items-center rounded-lg border px-4 py-3 text-left text-sm leading-6 transition-colors focus:outline-none focus:ring-2 focus:ring-pulse-300 ${
                        isSelected
                          ? 'border-pulse-400 bg-pulse-50 text-pulse-800 font-medium'
                          : eliminated
                            ? 'border-ink-100 bg-ink-50 text-ink-400 line-through'
                            : 'border-ink-100 text-ink-700 hover:bg-ink-50'
                      }`}
                    >
                      <div className={`mr-3 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${isSelected ? 'border-pulse-600 bg-pulse-600 text-white' : 'border-ink-300 bg-white'}`}>
                        {isSelected && <span className="text-xs font-bold leading-none">✓</span>}
                      </div>
                      <span className="mr-2 text-xs font-bold text-ink-400">{String.fromCharCode(65 + optionIndex)}.</span>
                      <span>{opt.text}</span>
                      {isSelected && <span className="ml-auto pl-2 text-xs font-semibold text-pulse-700">Checked</span>}
                    </button>
                    <button type="button" onClick={() => toggleEliminatedOption(question.id, opt.id)} aria-pressed={eliminated} title={eliminated ? 'Restore option' : 'Cross out option'} className={`min-h-12 w-11 shrink-0 rounded-lg border text-lg font-semibold transition-colors ${eliminated ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-ink-100 bg-white text-ink-400 hover:border-amber-300 hover:text-amber-700'}`}>{eliminated ? '↺' : '×'}</button>
                  </div>
                );
              })}
            </div>
          )}

          {/* 3. Clinical Drag & Drop / Ordering */}
          {question.type === 'ordering' && (() => {
            const currentIds = parseArrayAnswer(answers[question.id]);
            const allOptions = question.options ?? [];
            const effectiveOrder = currentIds.length === allOptions.length
              ? currentIds
              : allOptions.map((o) => o.id);

            const moveItem = (fromIdx: number, toIdx: number) => {
              if (fromIdx < 0 || fromIdx >= effectiveOrder.length || toIdx < 0 || toIdx >= effectiveOrder.length) return;
              const next = [...effectiveOrder];
              const [moved] = next.splice(fromIdx, 1);
              next.splice(toIdx, 0, moved);
              setAnswerAndUnskip(question.id, JSON.stringify(next));
            };

            return (
              <div className="space-y-2">
                <div className="rounded-lg bg-amber-50/70 border border-amber-100 p-2.5 mb-2">
                  <p className="text-xs font-semibold text-amber-900">Clinical Ordering / Prioritization</p>
                  <p className="text-[11px] text-ink-600">Arrange the nursing interventions in the correct order using the move buttons.</p>
                </div>
                {effectiveOrder.map((stepId, index) => {
                  const opt = allOptions.find((o) => o.id === stepId);
                  if (!opt) return null;
                  return (
                    <div key={opt.id} className="flex items-center gap-2 rounded-lg border border-ink-100 bg-white p-3 shadow-xs">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-100 text-xs font-bold text-amber-800">
                        {index + 1}
                      </span>
                      <span className="flex-1 text-sm font-medium text-ink-800">{opt.text}</span>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => moveItem(index, index - 1)}
                          className="rounded border border-ink-200 px-2.5 py-1 text-xs font-bold hover:bg-ink-50 disabled:opacity-25"
                          title="Move step up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={index === effectiveOrder.length - 1}
                          onClick={() => moveItem(index, index + 1)}
                          className="rounded border border-ink-200 px-2.5 py-1 text-xs font-bold hover:bg-ink-50 disabled:opacity-25"
                          title="Move step down"
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* 4. Clinical Matrix / Grid */}
          {question.type === 'matrix' && (() => {
            const currentMatrix = parseObjectAnswer(answers[question.id]);
            const selectCol = (rowId: string, colKey: string) => {
              const next = { ...currentMatrix, [rowId]: colKey };
              setAnswerAndUnskip(question.id, JSON.stringify(next));
            };

            return (
              <div className="space-y-3">
                <div className="rounded-lg bg-sky-50/70 border border-sky-100 p-2.5">
                  <p className="text-xs font-semibold text-sky-900">Clinical Decision Matrix</p>
                  <p className="text-[11px] text-ink-600">For each clinical action or finding, indicate whether it is Indicated, Contraindicated, or Not Related.</p>
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
                          <tr key={row.id} className="hover:bg-ink-50/40">
                            <td className="p-3 font-medium text-ink-800">{row.text}</td>
                            {(['indicated', 'contraindicated', 'not_related'] as const).map((colKey) => (
                              <td key={colKey} className="p-3 text-center">
                                <label className="inline-flex cursor-pointer items-center justify-center p-1">
                                  <input
                                    type="radio"
                                    name={`matrix-${question.id}-${row.id}`}
                                    checked={selectedCol === colKey}
                                    onChange={() => selectCol(row.id, colKey)}
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
              </div>
            );
          })()}

          {/* 5. Highlighting Clinical Red Flags */}
          {question.type === 'highlight' && (() => {
            const currentHighlights = parseArrayAnswer(answers[question.id]);
            const toggleCue = (cueId: string) => {
              const next = currentHighlights.includes(cueId)
                ? currentHighlights.filter((id) => id !== cueId)
                : [...currentHighlights, cueId];
              setAnswerAndUnskip(question.id, JSON.stringify(next));
            };

            return (
              <div className="space-y-3">
                <div className="rounded-lg bg-rose-50/70 border border-rose-100 p-2.5">
                  <p className="text-xs font-semibold text-rose-900">Clinical Red Flag Cues</p>
                  <p className="text-[11px] text-ink-600">Click directly on abnormal clinical findings to highlight them as concerning red flags.</p>
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
              </div>
            );
          })()}

          {/* 6. True / False */}
          {question.type === 'true_false' &&
            ['True', 'False'].map((label) => (
              <button
                key={label}
                onClick={() => setAnswerAndUnskip(question.id, label)}
                aria-label={`Answer ${label}`}
                aria-pressed={answers[question.id] === label}
                className={`flex min-h-12 w-full items-center rounded-lg border px-4 py-3 text-left text-sm leading-6 transition-colors focus:outline-none focus:ring-2 focus:ring-pulse-300 ${
                  answers[question.id] === label
                    ? 'border-pulse-400 bg-pulse-50 text-pulse-700 font-medium'
                    : 'border-ink-100 text-ink-700 hover:bg-ink-50'
                }`}
              >
                {label}
              </button>
            ))}

          {/* 7. Fill in the blank */}
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

      <div className="mt-6">
        {/* Previous / Next / Submit: fixed positions, never reflow regardless
            of answer state or last-question status. Submit swaps in for
            Next on the final question but keeps the same slot and width
            class so it doesn't jump. */}
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="secondary"
            disabled={current === 0}
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          >
            Previous
          </Button>
          {current < questions.length - 1 ? (
            <Button onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}>
              Next
            </Button>
          ) : (
            <Button className="min-w-28" onClick={() => setShowSubmitConfirm(true)} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit'}
            </Button>
          )}
        </div>
        {/* Skip: always rendered in its own fixed slot below, so its
            presence/absence never shifts Previous/Next/Submit above.
            Disabled (not hidden) once the question is answered, since
            there's nothing left to skip. */}
        <div className="mt-2 flex justify-center">
          <Button variant="secondary" disabled={isAnswered(question.id)} onClick={skipQuestion}>
            Skip
          </Button>
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

      <div className="mb-3 flex justify-end print:hidden">
        <button
          type="button"
          onClick={() => setShowShortcuts(true)}
          className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-500 shadow-sm hover:border-pulse-300 hover:text-pulse-700"
          aria-label="Keyboard shortcuts"
        >
          ? Shortcuts
        </button>
      </div>

      <QuestionNavigator
        total={questions.length}
        current={current}
        states={navigatorStates}
        onJump={(i) => setCurrent(i)}
        summary={`${questions.length - unansweredCount} answered · ${unansweredCount} unanswered · ${markedForReview.size} marked for review`}
        actionLabel={submitting ? 'Submitting…' : `Submit ${quiz.mode === 'exam' ? 'exam' : 'quiz'}`}
        actionDisabled={submitting}
        onAction={() => setShowSubmitConfirm(true)}
        className="mt-6 rounded-xl border border-ink-100 bg-white p-4 sm:p-5"
      />

      <QuizStudyToolkit quizId={quiz.id} quizTitle={quiz.title} />

      <ShortcutsHelpPanel
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
        title="Quiz and exam shortcuts"
        rows={QUIZ_SHORTCUTS}
      />

      {copyBlockedNotice && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md bg-ink-900 px-4 py-2.5 text-sm text-white shadow-lg">
          Copying is disabled on your first attempt at this quiz.
        </div>
      )}
    </div>
  );
}
