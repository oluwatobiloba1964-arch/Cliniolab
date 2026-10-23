'use client';

// src/app/quizzes/[quizId]/edit/page.tsx

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { QuizForm } from '@/components/quiz/QuizForm';
import type { Quiz, QuizInput, QuizQuestion } from '@/types';

export default function EditQuizPage() {
  const router = useRouter();
  const params = useParams<{ quizId: string }>();
  const { user, loading } = useAuth();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingQuiz, setLoadingQuiz] = useState(true);

  useEffect(() => {
    if (!params?.quizId) return;
    fetch(`/api/quizzes/${params.quizId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setLoadError(data.error ?? 'Failed to load quiz');
          return;
        }
        setQuiz(data.quiz);
        setQuestions(data.questions ?? []);
      })
      .catch(() => setLoadError('Network error while loading quiz'))
      .finally(() => setLoadingQuiz(false));
  }, [params?.quizId]);

  if (loading || loadingQuiz) return null;

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Login required</h1>
        <p className="mt-2 text-ink-500">You need an account to edit a quiz.</p>
        <Button
          className="mt-6"
          onClick={() => router.push(`/login?next=${encodeURIComponent(`/quizzes/${params.quizId}/edit`)}`)}
        >
          Log in
        </Button>
      </div>
    );
  }

  if (loadError || !quiz) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Can&apos;t edit this quiz</h1>
        <p className="mt-2 text-ink-500">{loadError ?? 'Quiz not found.'}</p>
        <Button className="mt-6" onClick={() => router.push('/dashboard')}>Back to dashboard</Button>
      </div>
    );
  }

  async function handleUpdate(input: QuizInput) {
    const res = await fetch(`/api/quizzes/${params.quizId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to update quiz' };
    router.push(`/quizzes/${params.quizId}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink-800">Edit quiz</h1>
          <p className="mt-2 text-ink-500">
            Works the same for study, quiz, exam, and combined mode — switch modes below if needed.
          </p>
        </div>
        <Button variant="secondary" onClick={() => router.push(`/quizzes/${params.quizId}/add-questions`)}>
          Upload more questions
        </Button>
      </div>
      <div className="mt-8">
        <QuizForm
          initialQuiz={quiz}
          initialQuestions={questions}
          submitLabel="Save changes"
          submittingLabel="Saving…"
          onSubmit={handleUpdate}
        />
      </div>
    </div>
  );
}
