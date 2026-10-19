'use client';

// FILE: src/components/creator/CreatorProfileCard.tsx

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { resolveImageUrl } from '@/lib/storage/imageUrl';

interface CreatorSummary {
  id: string;
  displayName: string | null;
  bio: string | null;
  avatarPath: string | null;
  createdAt: string;
}

/**
 * "By this creator" card shown on the quiz, study mode, flashcard and
 * shared-link landing pages. Mirrors the header of the full
 * public profile (/creator/[userId]): avatar, name, creator-since date,
 * full bio, stats, and share/copy actions. Self-fetches via
 * /api/creators/[userId] so the parent doesn't need to pass profile data.
 */
export function CreatorProfileCard({ creatorId }: { creatorId: string }) {
  const [data, setData] = useState<{
    profile: CreatorSummary;
    stats: { quizCount: number; flashcardSetCount?: number; totalAttempts: number };
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/creators/${creatorId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [creatorId]);

  if (!data) return null;
  const { profile, stats } = data;
  const name = profile.displayName ?? 'Cliniolab creator';
  const memberSince = new Date(profile.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
  });

  function profileUrl() {
    return typeof window !== 'undefined' ? `${window.location.origin}/creator/${profile.id}` : '';
  }

  async function handleShare() {
    const url = profileUrl();
    const text = `Check out ${name}'s quizzes on Cliniolab`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: name, text, url });
        return;
      } catch {
        // user cancelled the share sheet; fall through to clipboard copy
      }
    }
    await copy(url);
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable; silently no-op
    }
  }

  return (
    <Card className="p-6 sm:p-8">
      <p className="text-xs uppercase tracking-wide text-ink-400">Quiz by</p>

      <div className="mt-3 flex flex-col items-center text-center sm:flex-row sm:items-start sm:gap-6 sm:text-left">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-ink-100 sm:h-24 sm:w-24">
          {profile.avatarPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resolveImageUrl(profile.avatarPath)} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-ink-400">
              {name[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <div className="mt-4 sm:mt-0">
          <h3 className="font-display text-2xl font-semibold text-ink-800">{name}</h3>
          <p className="mt-1 text-xs text-ink-400">Creator since {memberSince}</p>
          {profile.bio && <p className="mt-3 text-sm text-ink-600">{profile.bio}</p>}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-ink-100 pt-5 text-sm sm:justify-start">
        <div>
          <span className="font-display text-lg font-semibold text-ink-800">{stats.quizCount}</span>
          <span className="ml-1 text-ink-500">{stats.quizCount === 1 ? 'quiz' : 'quizzes'}</span>
        </div>
        {(stats.flashcardSetCount ?? 0) > 0 && (
          <div>
            <span className="font-display text-lg font-semibold text-ink-800">{stats.flashcardSetCount}</span>
            <span className="ml-1 text-ink-500">
              {stats.flashcardSetCount === 1 ? 'flashcard set' : 'flashcard sets'}
            </span>
          </div>
        )}
        <div>
          <span className="font-display text-lg font-semibold text-ink-800">{stats.totalAttempts}</span>
          <span className="ml-1 text-ink-500">students reached</span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-3 sm:justify-start">
        <Button onClick={handleShare}>Share {name}</Button>
        <Button variant="secondary" onClick={() => copy(profileUrl())}>
          {copied ? 'Copied!' : 'Copy Link'}
        </Button>
        <Link
          href={`/creator/${profile.id}`}
          className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium text-pulse-600 hover:underline"
        >
          View profile →
        </Link>
      </div>
    </Card>
  );
}
