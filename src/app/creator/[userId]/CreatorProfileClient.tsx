'use client';

import { PageTools } from '@/components/layout/PageTools';
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { QuizCard } from '@/components/quiz/QuizCard';
import type { QuizWithStats } from '@/types';

interface CreatorProfile {
  id: string;
  displayName: string | null;
  bio: string | null;
  avatarPath: string | null;
  createdAt: string;
}

export function CreatorProfileClient({
  profile,
  quizzes,
  stats,
}: {
  profile: CreatorProfile;
  quizzes: QuizWithStats[];
  stats: { quizCount: number; totalAttempts: number };
}) {
  const [copied, setCopied] = useState(false);
  const name = profile.displayName ?? 'Cliniolab creator';
  const memberSince = new Date(profile.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
  });

  async function handleShare() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const text = `Check out ${name}'s quizzes on Cliniolab`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: name, text, url });
        return;
      } catch {
        // user cancelled the share sheet; fall through to clipboard copy
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable; silently no-op rather than throwing in the UI
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(typeof window !== 'undefined' ? window.location.href : '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable; silently no-op
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <PageTools reading />
      <Card className="p-6 sm:p-8">
        <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:gap-6 sm:text-left">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-ink-100 sm:h-24 sm:w-24">
            {profile.avatarPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarPath} alt={name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-ink-400">
                {name[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div className="mt-4 sm:mt-0">
            <h1 className="font-display text-2xl font-semibold text-ink-800">{name}</h1>
            <p className="mt-1 text-xs text-ink-400">Creator since {memberSince}</p>
            {profile.bio && <p className="mt-3 text-sm text-ink-600">{profile.bio}</p>}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-6 border-t border-ink-100 pt-5 text-sm sm:justify-start">
          <div>
            <span className="font-display text-lg font-semibold text-ink-800">{stats.quizCount}</span>
            <span className="ml-1 text-ink-500">{stats.quizCount === 1 ? 'quiz' : 'quizzes'}</span>
          </div>
          <div>
            <span className="font-display text-lg font-semibold text-ink-800">{stats.totalAttempts}</span>
            <span className="ml-1 text-ink-500">students reached</span>
          </div>
        </div>

        <div className="mt-5 flex justify-center gap-3 sm:justify-start">
          <Button onClick={handleShare} className="flex items-center gap-2">
            Share {name}
          </Button>
          <Button variant="secondary" onClick={handleCopyLink}>
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>
        </div>
      </Card>

      <h2 className="mt-10 font-display text-xl font-semibold text-ink-800">
        {quizzes.length > 0 ? `Quizzes by ${name}` : 'No public quizzes yet'}
      </h2>

      {quizzes.length > 0 ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {quizzes.map((quiz) => (
            <QuizCard key={quiz.id} quiz={quiz} />
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-ink-500">
          {name} hasn&apos;t published any public quizzes yet — check back later.
        </p>
      )}
    </div>
  );
}
