'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { QuizRunner } from '@/components/quiz/QuizRunner';
import { StudyModeRunner } from '@/components/quiz/StudyModeRunner';
import { Button } from '@/components/ui/Button';
import { Card, DifficultyBadge } from '@/components/ui/Card';
import { QuizLeaderboardSection } from '@/components/quiz/QuizLeaderboardSection';
import { CreatorProfileCard } from '@/components/creator/CreatorProfileCard';
import type { Quiz, QuizQuestion } from '@/types';

const MODE_LABELS: Record<Quiz['mode'], string> = {
  study: 'Study Mode',
  quiz: 'Quiz Mode',
  exam: 'Exam / CBT Mode',
  combined: 'Combined Mode',
};

export function SharedQuizClient() {
  const params = useParams<{ slug: string }>();
  const { user, loading } = useAuth();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Omit<QuizQuestion, 'correctAnswer'>[]>([]);
  const [studyQuestions, setStudyQuestions] = useState<QuizQuestion[]>([]);
  const [started, setStarted] = useState(false);
  const [combinedChoice, setCombinedChoice] = useState<'study' | 'quiz'>('quiz');
  const [attemptKey, setAttemptKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [hasAttempted, setHasAttempted] = useState(false);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  async function handleStart(overridePassword?: string) {
    setFetching(true);
    setError(null);
    setAttemptKey((k) => k + 1);
    try {
      const password = overridePassword ?? passwordInput;
      const qs = password ? `?password=${encodeURIComponent(password)}` : '';
      const res = await fetch(`/api/quizzes/shared/${params.slug}${qs}`);
      const data = await res.json();
      if (!res.ok) {
        if (data.passwordRequired) {
          setPasswordRequired(true);
          setError(password ? 'Incorrect password. Try again.' : null);
          return;
        }
        setError(data.error ?? 'This link is invalid or has expired.');
        return;
      }
      setPasswordRequired(false);

      // First resolve a combined link's access/password, then let the learner
      // choose a path before loading answer-bearing study data.
      if (data.quiz.mode === 'combined' && !quiz) {
        setQuiz(data.quiz);
        setQuestions(data.questions);
        setHasAttempted(!!data.hasAttempted);
        return;
      }

      if (data.quiz.mode === 'study' || (data.quiz.mode === 'combined' && combinedChoice === 'study')) {
        const studyQs = new URLSearchParams({ slug: params.slug, ...(password ? { password } : {}) }).toString();
        const studyRes = await fetch(`/api/quizzes/${data.quiz.id}/study?${studyQs}`);
        const studyData = await studyRes.json();
        if (!studyRes.ok) {
          setError(studyData.error ?? 'This link is invalid or has expired.');
          return;
        }
        setQuiz({ ...studyData.quiz, mode: 'study' });
        setStudyQuestions(studyData.questions);
      } else {
        setQuiz(data.quiz.mode === 'combined' ? { ...data.quiz, mode: 'exam' } : data.quiz);
        setQuestions(data.questions);
      }
      setHasAttempted(!!data.hasAttempted);
      setStarted(true);
    } finally {
      setFetching(false);
    }
  }

  if (loading) return null;

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Login required</h1>
        <p className="mt-2 text-ink-500">You need an account to attempt this quiz.</p>
        <Button className="mt-6" onClick={() => (window.location.href = '/login')}>
          Log in
        </Button>
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
          onDone={() => setStarted(false)}
          onComplete={() => {
            if (user) fetch(`/api/quizzes/${quiz.id}/study`, { method: 'POST' }).catch(() => {});
          }}
        />
      );
    }
    return (
      <div>
        <QuizRunner
          key={attemptKey}
          quiz={quiz}
          questions={questions}
          submitEndpoint={`/api/quizzes/${quiz.id}/attempt`}
          isFirstAttempt={!hasAttempted}
          onSubmitted={() => setHasAttempted(true)}
        />
        {hasAttempted && <QuizLeaderboardSection quizId={quiz.id} currentUserId={user?.id ?? null} />}
        <div className="mt-6">
          <CreatorProfileCard creatorId={quiz.creatorId} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Card className="p-8">
        {quiz && <DifficultyBadge difficulty={quiz.difficulty} />}
        <h1 className="mt-2 font-display text-2xl font-semibold text-ink-800">
          {quiz?.title ?? 'Private Quiz'}
        </h1>
        {quiz && (
          <span className="mt-1 inline-block font-mono text-xs uppercase tracking-wide text-pulse-600">
            {MODE_LABELS[quiz.mode]}
          </span>
        )}
        {quiz?.description && <p className="mt-2 text-ink-500">{quiz.description}</p>}
        {passwordRequired && (
          <div className="mt-4">
            <label htmlFor="quiz-access-password" className="text-sm font-medium text-ink-700">
              This quiz is password-protected
            </label>
            <input
              id="quiz-access-password"
              type="password"
              autoFocus
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleStart();
              }}
              placeholder="Enter password"
              className="mt-2 w-full rounded-md border border-ink-200 px-3 py-2 text-sm text-ink-800 focus:border-pulse-400 focus:outline-none"
            />
          </div>
        )}
        {error && <p className="mt-4 text-sm text-critical-500">{error}</p>}
        {quiz?.mode === 'combined' && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setCombinedChoice('study')} className={`rounded-xl border p-4 text-left ${combinedChoice === 'study' ? 'border-pulse-500 bg-pulse-50 ring-2 ring-pulse-100' : 'border-ink-100 hover:border-pulse-300'}`}><span className="block font-semibold text-ink-800">Practice with Study Mode</span><span className="mt-1 block text-sm text-ink-500">Review answers and explanations at your own pace.</span></button>
            <button type="button" onClick={() => setCombinedChoice('quiz')} className={`rounded-xl border p-4 text-left ${combinedChoice === 'quiz' ? 'border-pulse-500 bg-pulse-50 ring-2 ring-pulse-100' : 'border-ink-100 hover:border-pulse-300'}`}><span className="block font-semibold text-ink-800">Take Timed Quiz</span><span className="mt-1 block text-sm text-ink-500">Complete the quiz within the creator-set time.</span></button>
          </div>
        )}
        <Button className="mt-6" onClick={() => handleStart()} disabled={fetching || (passwordRequired && !passwordInput)}>
          {fetching ? 'Loading…' : passwordRequired ? 'Unlock and start' : quiz?.mode === 'combined' ? (combinedChoice === 'study' ? 'Start Study Practice' : 'Start Timed Quiz') : 'Start'}
        </Button>
      </Card>
    </div>
  );
}
