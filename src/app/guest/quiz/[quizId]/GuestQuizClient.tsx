// src/app/guest/quiz/[quizId]/GuestQuizClient.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QuizRunner } from '@/components/quiz/QuizRunner';
import { StudyModeRunner } from '@/components/quiz/StudyModeRunner';
import { Button } from '@/components/ui/Button';
import { Card, DifficultyBadge } from '@/components/ui/Card';
import { CreatorProfileCard } from '@/components/creator/CreatorProfileCard';
import { useAuth } from '@/lib/auth/AuthProvider';
import { usePublicConfig } from '@/lib/hooks/usePublicConfig';
import { OfflineSaveButton } from '@/lib/offline/OfflineSaveButton';
import type { Quiz, QuizQuestion } from '@/types';

const MODE_LABELS: Record<Quiz['mode'], string> = {
  study: 'Study Mode',
  quiz: 'Quiz Mode',
  exam: 'Exam / CBT Mode',
};

export function GuestQuizClient({ quizId }: { quizId: string }) {
  const router = useRouter();
  const { flags } = usePublicConfig();
  const { user, loading: authLoading } = useAuth();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!flags.guestPractice) {
      setLoading(false);
      return;
    }
    fetch(`/api/guest/quizzes/${quizId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Not available');
        setQuiz(data.quiz);
        setQuestions(data.questions ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Not available'))
      .finally(() => setLoading(false));
  }, [quizId, flags.guestPractice]);

  if (loading || authLoading) return null;

  if (!flags.guestPractice || error || !quiz) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Not available</h1>
        <p className="mt-2 text-ink-500">{error ?? 'This item is no longer available for guests.'}</p>
        <Link href="/guest" className="mt-4 inline-block text-pulse-600 underline">Back to Guest Practice</Link>
      </div>
    );
  }

  if (started) {
    if (quiz.mode === 'study') {
      return (
        <StudyModeRunner
          quiz={quiz}
          questions={questions}
          onDone={() => router.push('/guest')}
          onComplete={() => fetch(`/api/guest/quizzes/${quizId}/study`, { method: 'POST' }).catch(() => {})}
        />
      );
    }
    return (
      <QuizRunner
        quiz={quiz}
        questions={questions}
        submitEndpoint={`/api/guest/quizzes/${quizId}/grade`}
        isFirstAttempt
        guest
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Card className="p-8">
        <div className="flex items-center justify-between">
          <span className="rounded bg-pulse-50 px-2 py-0.5 text-xs font-semibold text-pulse-600">
            Guest Practice · {MODE_LABELS[quiz.mode]}
          </span>
          <DifficultyBadge difficulty={quiz.difficulty} />
        </div>
        <h1 className="mt-3 font-display text-3xl font-semibold text-ink-800">{quiz.title}</h1>
        {quiz.description && <p className="mt-2 text-ink-500">{quiz.description}</p>}
        <p className="mt-4 text-sm text-ink-500">{questions.length} questions · No account needed</p>
        {user ? (
          <p className="mt-1 text-xs text-ink-500">
            You&apos;re logged in. Your first saved attempt is recorded and, where available, counts for
            the leaderboard and certificate. If you practice without saving first, you will see the
            answers, so a later attempt on this quiz will not be saved or ranked.
          </p>
        ) : (
          <p className="mt-1 text-xs text-ink-500">
            Practicing as a guest: your result will not be saved. To get history, the leaderboard and
            a certificate (where available), log in and take it first. Once you finish it as a guest,
            later attempts on this device are practice only and are not saved or ranked.
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {user ? (
            <>
              <Button size="lg" onClick={() => router.push(`/quizzes/${quizId}`)}>
                Start (first attempt is saved)
              </Button>
              <Button size="lg" variant="secondary" onClick={() => setStarted(true)}>
                Practice without saving
              </Button>
            </>
          ) : (
            <>
              <Button size="lg" onClick={() => setStarted(true)}>
                Start as guest
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => router.push(`/login?next=${encodeURIComponent(`/quizzes/${quizId}`)}`)}
              >
                Log in to save result
              </Button>
              <Link
                href={`/register?next=${encodeURIComponent(`/quizzes/${quizId}`)}`}
                className="text-sm text-pulse-600 underline"
              >
                Create free account
              </Link>
            </>
          )}
          {quiz.mode === 'study' && (
            <OfflineSaveButton
              kind="quiz"
              sourceId={quiz.id}
              title={quiz.title}
              pricing="free"
              loadPayload={async () => ({ quiz, questions })}
            />
          )}
        </div>
      </Card>
      {quiz.creatorId && (
        <div className="mt-6">
          <CreatorProfileCard creatorId={quiz.creatorId} />
        </div>
      )}
    </div>
  );
}
