// File: src/app/quizzes/[quizId]/QuizDetailClient.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { QuizRunner } from '@/components/quiz/QuizRunner';
import { StudyModeRunner } from '@/components/quiz/StudyModeRunner';
import { CommentThread } from '@/components/quiz/CommentThread';
import { ShareButton } from '@/components/quiz/ShareButton';
import { QuizLeaderboardSection } from '@/components/quiz/QuizLeaderboardSection';
import { CreatorProfileCard } from '@/components/creator/CreatorProfileCard';
import { RelatedStudyMaterials } from '@/components/quiz/RelatedStudyMaterials';
import { OfflineSaveButton } from '@/lib/offline/OfflineSaveButton';
import { Button } from '@/components/ui/Button';
import { Card, DifficultyBadge } from '@/components/ui/Card';
import { clearDraft } from '@/lib/localDraft';
import type { Quiz, QuizQuestion, QuizWithStats } from '@/types';

const MODE_LABELS: Record<Quiz['mode'], string> = {
  study: 'Study Mode',
  quiz: 'Quiz Mode',
  exam: 'Exam / CBT Mode',
};

const RETAKE_LABELS: Record<Quiz['retakePolicy'], (limit: number | null) => string> = {
  unlimited: () => 'Unlimited attempts',
  single: () => '1 attempt',
  daily_limit: (limit) => `${limit ?? 1} attempt${limit === 1 ? '' : 's'} per day`,
  cooldown: (limit) => `${limit ?? 1} attempt${limit === 1 ? '' : 's'} (cooldown applies)`,
};

function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString('en-NG')}`;
}

function formatTime(seconds: number | null): string | null {
  if (!seconds) return null;
  const totalMinutes = Math.round(seconds / 60);
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hrs > 0) return `${hrs}h${mins > 0 ? ` ${mins}m` : ''}`;
  return `${mins} min`;
}

export function QuizDetailClient({
  quizId,
  previewStats,
}: {
  quizId: string;
  previewStats?: QuizWithStats | null;
}) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Omit<QuizQuestion, 'correctAnswer'>[]>([]);
  const [studyQuestions, setStudyQuestions] = useState<QuizQuestion[]>([]);
  const [started, setStarted] = useState(false);
  const [attemptKey, setAttemptKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [requiresPurchase, setRequiresPurchase] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [hasAttempted, setHasAttempted] = useState(false);

  // Lightweight preview load so the owner sees a Delete option before
  // committing to "Start" (which pulls full question sets). ?preview=1
  // tells the server to skip fetching questions and attempt history for
  // this call, since this fires on every page view, not just attempts.
  useEffect(() => {
    if (!user) return;
    fetch(`/api/quizzes/${quizId}?preview=1`)
      .then((res) => res.json())
      .then((data) => {
        if (data.quiz) setQuiz((prev) => prev ?? data.quiz);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId, user]);

  const isOwner = !!user && !!quiz && (quiz.creatorId === user.id || user.role === 'admin' || user.role === 'moderator');

  // Auto-start when arriving via the "Retake missed only" or "Retake all"
  // buttons on the result screen - those are explicit, deliberate re-entry
  // choices the user just made, not a first-time landing, so neither
  // should require a second manual "Start" click. "Retake all" is
  // signalled by a bare ?retake=1 (no missedOnly narrowing); "Retake
  // missed only" keeps its existing ?retakeMissed=1 signal.
  useEffect(() => {
    if (!user || started) return;
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('retakeMissed') === '1' || params.get('retake') === '1') {
      void handleStart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, started]);

  async function handleDelete() {
    if (!confirm('Delete this quiz permanently? This cannot be undone.')) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/quizzes/${quizId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(data.error ?? `Failed to delete quiz (${res.status})`);
        return;
      }
      router.push('/quizzes');
    } catch {
      setDeleteError('Network error while deleting. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleStart() {
    setFetching(true);
    setError(null);
    setRequiresPurchase(false);
    setAttemptKey((k) => k + 1);

    // "Start" doubles as "Restart" once an attempt has already been taken
    // this visit (e.g. unlimited-retake quizzes where the user lands back
    // here after finishing and clicks Start again). Without this, the new
    // QuizRunner/StudyModeRunner mount would pick up the previous
    // attempt's cached draft/result from localStorage and show stale
    // answers or jump straight back to the old score screen instead of a
    // clean attempt. Anti-cheat exams never write these in the first
    // place (see QuizRunner), so this is a harmless no-op for them.
    if (started) {
      clearDraft('attempt', quizId);
      clearDraft('attempt-result', quizId);
      clearDraft('study', quizId);
    }

    try {
      // "Retake missed only" / "Retake all" arrive back here as query
      // params after the user clicks one on the result screen (see
      // QuizRunner). "Retake missed only" narrows the fetched question set
      // to whatever they missed on their most recently *recorded* attempt
      // - derived from quiz_attempts on the server, no separate storage.
      // "Retake all" (?retake=1) carries no such narrowing, it's just the
      // auto-start signal for a full fresh attempt. Both are consumed
      // once, then stripped from the URL so a plain refresh afterwards
      // behaves like an ordinary page load.
      const params = new URLSearchParams(window.location.search);
      const missedOnly = params.get('retakeMissed') === '1';
      const isRetakeAll = params.get('retake') === '1';
      if (missedOnly || isRetakeAll) {
        params.delete('retakeMissed');
        params.delete('retake');
        const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
        window.history.replaceState({}, '', newUrl);
      }

      // Peek at the quiz's mode first via the normal endpoint (which
      // never leaks correctAnswer), then only hit the study-only endpoint
      // if the quiz is actually in Study Mode.
      const res = await fetch(`/api/quizzes/${quizId}${missedOnly ? '?missedOnly=1' : ''}`);
      const data = await res.json();
      if (!res.ok) {
        if (data.requiresPurchase) {
          setQuiz(data.quiz ?? null);
          setRequiresPurchase(true);
        } else {
          setError(data.error ?? 'Failed to load quiz');
        }
        return;
      }

      if (data.quiz.mode === 'study') {
        const studyRes = await fetch(`/api/quizzes/${quizId}/study`);
        const studyData = await studyRes.json();
        if (!studyRes.ok) {
          if (studyData.requiresPurchase) {
            setQuiz(studyData.quiz ?? null);
            setRequiresPurchase(true);
          } else {
            setError(studyData.error ?? 'Failed to load quiz');
          }
          return;
        }
        setQuiz(studyData.quiz);
        setStudyQuestions(studyData.questions);
      } else {
        setQuiz(data.quiz);
        setQuestions(data.questions);
      }
      setHasAttempted(!!data.hasAttempted);
      setStarted(true);
    } finally {
      setFetching(false);
    }
  }

  async function handlePurchase() {
    setPurchasing(true);
    setError(null);
    try {
      const res = await fetch(`/api/quizzes/${quizId}/purchase`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to start checkout');
        return;
      }
      window.location.href = data.authorizationUrl;
    } finally {
      setPurchasing(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16" aria-label="Loading quiz" aria-busy="true">
        <Card className="ui-polish-card animate-pulse p-8">
          <div className="h-4 w-24 rounded bg-ink-100" />
          <div className="mt-4 h-8 w-3/4 rounded bg-ink-100" />
          <div className="mt-3 h-4 w-full rounded bg-ink-50" />
          <div className="mt-6 h-24 rounded bg-ink-50" />
          <div className="mt-6 h-10 w-28 rounded bg-ink-100" />
        </Card>
      </div>
    );
  }

  if (!user) {
    // Logged-out visitors still see the shareable preview (title, price,
    // time, question count, attempts) - same info a shared link unfurls
    // to - they just can't start the quiz without logging in.
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <Card className="ui-polish-card p-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              {previewStats && <DifficultyBadge difficulty={previewStats.difficulty} />}
              <h1 className="mt-2 font-display text-2xl font-semibold text-ink-800">
                {previewStats?.title ?? 'Quiz'}
              </h1>
              {previewStats && (
                <span className="mt-1 inline-block font-mono text-xs uppercase tracking-wide text-pulse-600">
                  {MODE_LABELS[previewStats.mode]}
                </span>
              )}
            </div>
          </div>
          {previewStats?.description && <p className="mt-2 text-ink-500">{previewStats.description}</p>}

          {previewStats && (
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border border-ink-100 bg-ink-50/50 p-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-400">Creator</dt>
                <dd className="text-ink-700">{previewStats.creatorName ?? 'Anonymous'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-400">Price</dt>
                <dd className="text-ink-700">
                  {previewStats.pricing === 'paid' && previewStats.priceKobo
                    ? formatNaira(previewStats.priceKobo)
                    : 'Free'}
                </dd>
              </div>
              {formatTime(previewStats.timeLimitSeconds) && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-ink-400">Estimated time</dt>
                  <dd className="text-ink-700">{formatTime(previewStats.timeLimitSeconds)}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-400">Questions</dt>
                <dd className="text-ink-700">{previewStats.questionCount}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-400">Trials allowed</dt>
                <dd className="text-ink-700">
                  {RETAKE_LABELS[previewStats.retakePolicy]?.(previewStats.retakeLimit) ?? ' - '}
                </dd>
              </div>
            </dl>
          )}

          <p className="mt-6 text-ink-500">You need an account to attempt this quiz.</p>
          <Button
            className="mt-3"
            onClick={() =>
              (window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`)
            }
          >
            Log in
          </Button>
        </Card>

        <QuizLeaderboardSection quizId={quizId} currentUserId={null} />
        {previewStats?.creatorId && (
          <div className="mt-6">
            <CreatorProfileCard creatorId={previewStats.creatorId} />
          </div>
        )}
      </div>
    );
  }

  if (started && quiz) {
    if (quiz.mode === 'study') {
      return (
        <StudyModeRunner
          key={attemptKey}
          quiz={quiz}
          questions={studyQuestions}
          onComplete={() => {
            if (user) fetch(`/api/quizzes/${quizId}/study`, { method: 'POST' }).catch(() => {});
          }}
        />
      );
    }
    return (
      <QuizRunner
        key={attemptKey}
        quiz={quiz}
        questions={questions}
        submitEndpoint={`/api/quizzes/${quizId}/attempt`}
        isFirstAttempt={!hasAttempted}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Card className="ui-polish-card p-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            {quiz && <DifficultyBadge difficulty={quiz.difficulty} />}
            <h1 className="mt-2 font-display text-2xl font-semibold text-ink-800">
              {quiz?.title ?? 'Quiz'}
            </h1>
            {quiz && (
              <span className="mt-1 inline-block font-mono text-xs uppercase tracking-wide text-pulse-600">
                {MODE_LABELS[quiz.mode]}
              </span>
            )}
            {quiz && quiz.mode === 'study' && quiz.pricing !== 'paid' && (
              <div className="mt-2">
                <OfflineSaveButton
                  kind="quiz"
                  sourceId={quiz.id}
                  title={quiz.title}
                  pricing={quiz.pricing}
                  loadPayload={async () => ({ quiz, questions: studyQuestions })}
                />
              </div>
            )}
          </div>
          {previewStats && previewStats.visibility === 'public' && typeof window !== 'undefined' && (
            <ShareButton
              url={window.location.href}
              title={previewStats.title}
              stats={{
                creatorName: previewStats.creatorName,
                creatorContact: previewStats.creatorContact,
                mode: previewStats.mode,
                pricing: previewStats.pricing,
                priceKobo: previewStats.priceKobo,
                timeLimitSeconds: previewStats.timeLimitSeconds,
                questionCount: previewStats.questionCount,
                retakePolicy: previewStats.retakePolicy,
                retakeLimit: previewStats.retakeLimit,
                difficulty: previewStats.difficulty,
                categoryName: previewStats.categoryName,
                subcategoryName: previewStats.subcategoryName,
                attemptCount: previewStats.attemptCount,
                averageScorePercent: previewStats.averageScorePercent,
              }}
            />
          )}
        </div>
        {quiz?.description && <p className="mt-2 text-ink-500">{quiz.description}</p>}
        {quiz && (
          <p className="mt-3 text-sm text-ink-500">
            {quiz.mode === 'exam'
              ? 'Timed CBT-style practice. Check the time limit before you begin.'
              : quiz.mode === 'study'
                ? 'Study at your own pace, reveal explanations, and review difficult questions.'
                : 'Practice questions with immediate feedback and a full review after submission.'}
          </p>
        )}

        {previewStats && (
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border border-ink-100 bg-ink-50/50 p-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-400">Creator</dt>
              <dd className="text-ink-700">{previewStats.creatorName ?? 'Anonymous'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-400">Price</dt>
              <dd className="text-ink-700">
                {previewStats.pricing === 'paid' && previewStats.priceKobo
                  ? formatNaira(previewStats.priceKobo)
                  : 'Free'}
              </dd>
            </div>
            {formatTime(previewStats.timeLimitSeconds) && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-400">Estimated time</dt>
                <dd className="text-ink-700">{formatTime(previewStats.timeLimitSeconds)}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-400">Questions</dt>
              <dd className="text-ink-700">{previewStats.questionCount}</dd>
            </div>
            {(previewStats.categoryName || previewStats.subcategoryName) && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-400">Topic</dt>
                <dd className="text-ink-700">
                  {previewStats.categoryName}{previewStats.subcategoryName ? ` · ${previewStats.subcategoryName}` : ''}
                </dd>
              </div>
            )}
            {previewStats.mode === 'study' ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-400">Study attempts</dt>
                <dd className="text-ink-700">{previewStats.studyAttemptCount ?? 0}</dd>
              </div>
            ) : (
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-400">Trials allowed</dt>
                <dd className="text-ink-700">
                  {RETAKE_LABELS[previewStats.retakePolicy]?.(previewStats.retakeLimit) ?? ' - '}
                </dd>
              </div>
            )}
          </dl>
        )}

        {error && <p className="mt-4 text-sm text-critical-500">{error}</p>}
        {deleteError && <p className="mt-4 text-sm text-critical-500">{deleteError}</p>}

        {isOwner && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push(`/quizzes/${quizId}/edit`)}
            >
              Edit
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </div>
        )}

        {requiresPurchase && quiz ? (
          <div className="mt-6 rounded-md border border-flag-200 bg-flag-50 p-4">
            <p className="text-sm font-medium text-ink-800">
              This is a paid quiz{quiz.priceKobo ? `  -  ${formatNaira(quiz.priceKobo)}` : ''}.
            </p>
            <Button className="mt-3" onClick={handlePurchase} disabled={purchasing}>
              {purchasing ? 'Redirecting to payment…' : 'Purchase to unlock'}
            </Button>
          </div>
        ) : (
          <Button className="mt-6" onClick={handleStart} disabled={fetching}>
            {fetching ? 'Loading…' : 'Start'}
          </Button>
        )}
      </Card>

      <CommentThread endpoint={`/api/quizzes/${quizId}/comments`} />
      <QuizLeaderboardSection quizId={quizId} currentUserId={user?.id ?? null} />
      {previewStats?.creatorId && (
        <div className="mt-6">
          <CreatorProfileCard creatorId={previewStats.creatorId} />
        </div>
      )}
      <RelatedStudyMaterials endpoint={`/api/quizzes/${quizId}/related`} />
    </div>
  );
}
