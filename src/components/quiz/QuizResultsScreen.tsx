// File: src/components/quiz/QuizResultsScreen.tsx
/*
 * Extracted from QuizRunner.tsx: the post-submit results/review screen.
 * Pure presentational component - all state (result, filters, flags, xp
 * award, etc.) and handlers live in QuizRunner and are passed down as
 * props. No behavior change from the inline block it replaces.
 */
'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IncorrectRationale } from '@/components/quiz/IncorrectRationale';
import { parseArrayAnswer, parseObjectAnswer, formatAnswerDisplay } from '@/lib/quizAnswers';
import { COPIED_EXPLANATIONS_KEY, makeId, readJson, writeJson } from '@/lib/services/localExtrasService';
import type { QuizXpAward } from '@/lib/services/gamificationService';
import { AnimatedScoreReveal } from '@/components/quiz/AnimatedScoreReveal';
import type { AttemptResult, Quiz } from '@/types';

type ResultFilter = 'all' | 'correct' | 'incorrect' | 'marked' | 'skipped';

interface QuizResultsScreenProps {
  quiz: Quiz;
  result: AttemptResult;
  guest: boolean;
  draftsEnabled: boolean;
  attemptDurationSeconds: number | null;
  xpAward: QuizXpAward | null;
  resultFilter: ResultFilter;
  setResultFilter: (filter: ResultFilter) => void;
  setFlashcardMode: (mode: 'all' | 'missed' | null) => void;
  markedForReview: Set<string>;
  skipped: Set<string>;
  matchesReviewFilter: (
    pq: { questionId: string; isCorrect: boolean },
    filter: ResultFilter
  ) => boolean;
  copiedExplanationId: string | null;
  setCopiedExplanationId: (id: string | null) => void;
  quizAllowFlagging: boolean;
  flaggedQuestionIds: Set<string>;
  flaggingQuestionId: string | null;
  flagError: string | null;
  handleFlagQuestion: (questionId: string) => void;
  leaveResults: () => void;
}

export function QuizResultsScreen({
  quiz,
  result,
  guest,
  draftsEnabled,
  attemptDurationSeconds,
  xpAward,
  resultFilter,
  setResultFilter,
  setFlashcardMode,
  markedForReview,
  skipped,
  matchesReviewFilter,
  copiedExplanationId,
  setCopiedExplanationId,
  quizAllowFlagging,
  flaggedQuestionIds,
  flaggingQuestionId,
  flagError,
  handleFlagQuestion,
  leaveResults,
}: QuizResultsScreenProps) {
  const router = useRouter();

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
        {xpAward && (
          <div
            className={`mb-5 rounded-xl border p-4 ${
              xpAward.leveledUp ? 'border-pulse-300 bg-pulse-50' : 'border-pulse-100 bg-pulse-50/60'
            }`}
            aria-live="polite"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-pulse-600">
                  {xpAward.leveledUp ? 'Level up!' : 'XP earned'}
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold text-ink-900">
                  +{xpAward.xpEarned} XP
                </p>
                <p className="mt-0.5 text-xs text-ink-500">
                  Level {xpAward.level.level}, {xpAward.level.name}
                  {!xpAward.level.isMaxLevel && ` · ${xpAward.level.xpForNextLevel - xpAward.level.xpIntoLevel} XP to level ${xpAward.level.level + 1}`}
                </p>
              </div>
              {xpAward.leveledUp && (
                <span className="rounded-full bg-pulse-500 px-3 py-1 text-xs font-semibold text-white">
                  Level {xpAward.level.level} unlocked
                </span>
              )}
            </div>
            {xpAward.newBadges.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">New badge{xpAward.newBadges.length === 1 ? '' : 's'}</span>
                {xpAward.newBadges.map((badge) => (
                  <span key={badge.id} className="inline-flex items-center gap-1.5 rounded-full border border-pulse-200 bg-white px-3 py-1 text-xs font-semibold text-pulse-700">
                    {badge.title}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-2.5 text-[11px] text-ink-400">
              XP, levels and badges live on this device and never sync or affect your account.
            </p>
          </div>
        )}
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
                <details className="mt-3 group rounded-lg border border-ink-100 bg-white/60 p-2.5">
                  <summary className="cursor-pointer select-none list-none flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">
                    Answer options
                    <span className="text-ink-300 transition-transform group-open:rotate-180" aria-hidden="true">▾</span>
                  </summary>
                  <ul className="mt-2 space-y-1.5">
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
                </details>
              )}
              {pq.explanation && (
                <details className="mt-2 group rounded-lg border border-ink-100 bg-ink-50/60 p-2.5">
                  <summary className="cursor-pointer select-none list-none flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">
                    Explanation
                    <span className="text-ink-300 transition-transform group-open:rotate-180" aria-hidden="true">▾</span>
                  </summary>
                  <div className="mt-1.5 flex items-center justify-end">
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
                        window.setTimeout(() => setCopiedExplanationId(null), 1800);
                      }}
                      className="rounded-md border border-ink-200 bg-white px-2 py-1 text-[11px] font-semibold text-ink-500 transition hover:border-pulse-300 hover:text-pulse-700 focus:outline-none focus:ring-2 focus:ring-pulse-300"
                    >
                      {copiedExplanationId === pq.questionId ? 'Copied' : 'Copy explanation'}
                    </button>
                  </div>
                  <p className="mt-1.5 whitespace-pre-line text-sm leading-snug text-ink-600">
                    {pq.explanation}
                  </p>
                </details>
              )}
              <IncorrectRationale text={pq.incorrectRationale} />
              {!pq.isCorrect && (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/search?q=${encodeURIComponent(pq.prompt.slice(0, 80))}`}
                    className="inline-flex items-center rounded-lg border border-pulse-200 bg-pulse-50 px-3 py-1.5 text-xs font-semibold text-pulse-700 transition hover:bg-pulse-100"
                  >
                    Learn this topic →
                  </Link>
                </div>
              )}
              {quizAllowFlagging && !guest && (
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
