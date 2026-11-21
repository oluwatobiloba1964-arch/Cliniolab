'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { QuizForm } from '@/components/quiz/QuizForm';
import { invalidateDashboardCache } from '@/lib/client/dashboardCache';
import type { QuizInput } from '@/types';

export default function NewQuizPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Login required</h1>
        <p className="mt-2 text-ink-500">You need an account to create a quiz.</p>
        <Button className="mt-6" onClick={() => router.push('/login?next=/quizzes/new')}>Log in</Button>
      </div>
    );
  }

  async function handleCreate(input: QuizInput) {
    const res = await fetch('/api/quizzes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to create quiz' };
    // So the new quiz shows up on the dashboard right away instead of
    // waiting out the dashboard's local cache (up to 5 minutes stale).
    invalidateDashboardCache(user?.id);
    router.push(`/quizzes/${data.quiz.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-3xl font-semibold text-ink-800">Create a quiz</h1>
        <Link
          href="/quizzes/bulk-upload"
          className="inline-flex shrink-0 items-center justify-center rounded-full border border-pulse-600 px-4 py-2 text-sm font-medium text-pulse-600 hover:bg-pulse-600 hover:text-white"
        >
          Upload Bulk Questions
        </Link>
      </div>
      <div className="mt-8">
        <QuizForm
          submitLabel="Publish quiz"
          submittingLabel="Publishing…"
          onSubmit={handleCreate}
        />
      </div>
    </div>
  );
}
