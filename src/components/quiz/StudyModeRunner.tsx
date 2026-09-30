'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { QuestionNavigator } from '@/components/quiz/QuestionNavigator';
import { FlashcardRunner } from '@/components/flashcards/FlashcardRunner';
import { IncorrectRationale } from '@/components/quiz/IncorrectRationale';
import { clearDraft, loadDraft, saveDraft } from '@/lib/localDraft';
import { resolveEffectiveCorrectAnswer } from '@/lib/quizAnswers';
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
 * This is a device-local convenience cache only — never the source of
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
  // Self-rated confidence, captured just before the answer is revealed.
  const [confidence, setConfidence] = useState<Record<string, 'sure' | 'guessing'>>(
    initialDraft?.confidence ?? {}
  );
  const [resultFilter, setResultFilter] = useState<ResultFilter>(initialDraft?.resultFilter ?? 'all');
  // Whether the "Finish studying" summary screen is showing. Distinct from
  // navigating past the last question — the summary is a deliberate final
  // step, shown in place instead of redirecting straight back to the quiz
  // page, so a study session ends with the same kind of results/missed-
  // answers breakdown Quiz/Exam mode already gives.
  const [showSummary, setShowSummary] = useState(false);
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>('all');
  const [flashcardMode, setFlashcardMode] = useState<'all' | 'missed' | null>(null);

  const question = questions[current];
  const answeredIds = useMemo(() => new Set(Object.keys(answers)), [answers]);
  const isLast = current === questions.length - 1;
  const isCorrect = selectedAnswer !== null &&
    selectedAnswer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
  const correctAnswerDisplay =
    question.type === 'mcq'
      ? question.options?.find((o) => o.id === question.correctAnswer)?.text ?? question.correctAnswer
      : question.correctAnswer;

  const navigatorStates = useMemo(
    () => questions.map((q) => ({ answered: answeredIds.has(q.id) })),
    [questions, answeredIds]
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
    };
    saveDraft(DRAFT_NAMESPACE, quiz.id, draft);
  }, [quiz.id, questions, current, answers, skipped, confidence, resultFilter]);

  // Fires once per finished study session, when the summary screen first
  // shows - mirrors FlashcardRunner's "finished" effect. Reaching the
  // summary is the study-mode equivalent of a completed run-through;
  // resuming/reopening the summary later (e.g. after a refresh) doesn't
  // re-fire since showSummary only flips false -> true once per session.
  useEffect(() => {
    if (showSummary) onComplete?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSummary]);

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
        return summaryFilter === 'correct' ? isRight : !isRight;
      });

    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <Card className="p-8 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-pulse-600">Study Session Results</p>
          <p className="mt-4 font-display text-5xl font-semibold text-ink-800">
            {Math.round(percentage)}%
          </p>
          <p className="mt-2 text-ink-500">
            {correctCount} / {answeredCount} answered correctly
            {answeredCount < questions.length &&
              ` · ${questions.length - answeredCount} question${questions.length - answeredCount === 1 ? '' : 's'} unanswered`}
          </p>
          <p className="mt-3 text-xs text-ink-400">
            Study Mode isn&apos;t scored or saved to your dashboard — this is just a recap of this session.
          </p>

          <div className="mt-6 flex justify-center gap-2">
            {(['all', 'correct', 'incorrect'] as const).map((f) => {
              const count =
                f === 'all'
                  ? questions.length
                  : questions.filter((q) => {
                      const isRight =
                        answeredIds.has(q.id) && answers[q.id] !== undefined &&
                        answers[q.id].trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
                      return f === 'correct' ? isRight : !isRight;
                    }).length;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setSummaryFilter(f)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    summaryFilter === f
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
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="flex items-center justify-between text-sm text-ink-400">
        <span>Question {current + 1} of {questions.length}</span>
        <span className="font-mono text-xs uppercase tracking-widest text-pulse-600">Study Mode</span>
      </div>
      <div className="mt-2 h-1 w-full rounded-full bg-ink-100">
        <div
          className="h-1 rounded-full bg-pulse-500 transition-all"
          style={{ width: `${((current + 1) / questions.length) * 100}%` }}
        />
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

      <Card className="mt-8 p-6">
        <h2 className="font-display text-lg font-medium text-ink-800">{question.prompt}</h2>

        {!revealed && (
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
        )}

        <div className="mt-6 space-y-2">
          {question.type === 'mcq' &&
            question.options?.map((opt) => {
              const isSelected = selectedAnswer === opt.id;
              const isThisCorrect = opt.id === question.correctAnswer;
              let stateClass = 'border-ink-100 text-ink-700 hover:bg-ink-50';
              if (revealed && isThisCorrect) stateClass = 'border-pulse-400 bg-pulse-50 text-pulse-700';
              else if (revealed && isSelected && !isThisCorrect) stateClass = 'border-critical-400 bg-critical-50 text-critical-600';
              return (
                <button
                  key={opt.id}
                  onClick={() => selectAnswer(opt.id)}
                  disabled={revealed}
                  className={`w-full rounded-md border px-4 py-3 text-left text-sm transition-colors disabled:cursor-default ${stateClass}`}
                >
                  {opt.text}
                </button>
              );
            })}

          {question.type === 'true_false' &&
            ['True', 'False'].map((label) => {
              const isSelected = selectedAnswer === label;
              const isThisCorrect = label === question.correctAnswer;
              let stateClass = 'border-ink-100 text-ink-700 hover:bg-ink-50';
              if (revealed && isThisCorrect) stateClass = 'border-pulse-400 bg-pulse-50 text-pulse-700';
              else if (revealed && isSelected && !isThisCorrect) stateClass = 'border-critical-400 bg-critical-50 text-critical-600';
              return (
                <button
                  key={label}
                  onClick={() => selectAnswer(label)}
                  disabled={revealed}
                  className={`w-full rounded-md border px-4 py-3 text-left text-sm transition-colors disabled:cursor-default ${stateClass}`}
                >
                  {label}
                </button>
              );
            })}

          {question.type === 'fill_blank' && !revealed && (
            <FillBlankInput onSubmit={selectAnswer} />
          )}
          {question.type === 'fill_blank' && revealed && (
            <div className={`rounded-md border px-4 py-3 text-sm ${isCorrect ? 'border-pulse-400 bg-pulse-50 text-pulse-700' : 'border-critical-400 bg-critical-50 text-critical-600'}`}>
              Your answer: {selectedAnswer}
            </div>
          )}
        </div>

        {revealed && (
          <div className={`mt-4 rounded-md border p-4 ${isCorrect ? 'border-pulse-200 bg-pulse-50' : 'border-critical-200 bg-critical-50'}`}>
            <p className="text-sm font-medium text-ink-700">
              {isCorrect ? 'Correct!' : `Correct answer: ${correctAnswerDisplay}`}
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
          Showing all questions below — highlighted numbers match the &ldquo;
          {resultFilter}&rdquo; filter ({filteredIndices.length}).
        </p>
      )}
      <QuestionNavigator
        total={questions.length}
        current={current}
        states={navigatorStates}
        onJump={goToQuestion}
        className="mt-2"
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
