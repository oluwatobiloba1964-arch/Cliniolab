'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import type { BookmarkKind } from '@/types';

const BOOKMARK_CACHE_TTL_MS = 2 * 60 * 1000;
const bookmarkLookups = new Map<string, Promise<Set<string>>>();

function bookmarkCacheKey(userId: string, kind: BookmarkKind) {
  return `cliniolab:bookmarks:v1:${userId}:${kind}`;
}

async function loadBookmarkIds(userId: string, kind: BookmarkKind): Promise<Set<string>> {
  const key = bookmarkCacheKey(userId, kind);
  try {
    const raw = window.localStorage.getItem(key);
    const cached = raw ? JSON.parse(raw) as { savedAt?: number; ids?: string[] } : null;
    const age = typeof cached?.savedAt === 'number' ? Date.now() - cached.savedAt : Number.POSITIVE_INFINITY;
    if (age >= 0 && age < BOOKMARK_CACHE_TTL_MS && Array.isArray(cached?.ids)) return new Set(cached.ids);
  } catch { /* Storage is optional. */ }

  const active = bookmarkLookups.get(key);
  if (active) return active;

  const request: Promise<Set<string>> = fetch(`/api/bookmarks?kind=${kind}`, { credentials: 'same-origin' })
    .then(async (res): Promise<Set<string>> => {
      if (!res.ok) throw new Error('Could not load bookmarks');
      const data = await res.json();
      const ids = Array.isArray(data.bookmarks)
        ? data.bookmarks.map((item: { targetId?: unknown }) => item.targetId).filter((id: unknown): id is string => typeof id === 'string')
        : [];
      try { window.localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), ids })); } catch { /* Cache is optional. */ }
      return new Set<string>(ids);
    })
    .finally(() => bookmarkLookups.delete(key)) as Promise<Set<string>>;
  bookmarkLookups.set(key, request);
  return request;
}

function invalidateBookmarkCache(userId: string, kind: BookmarkKind) {
  try {
    window.localStorage.removeItem(bookmarkCacheKey(userId, kind));
    window.localStorage.removeItem(`cliniolab:bookmark-resolved:v1:${userId}`);
  } catch { /* Cache is optional. */ }
}

interface BookmarkButtonProps {
  kind: BookmarkKind;
  targetId: string;
  /** Pass true if the caller already knows the bookmarked state (e.g. from a bulk list fetch), to skip this component's own lookup call. */
  initialBookmarked?: boolean;
  className?: string;
}

export function BookmarkButton({ kind, targetId, initialBookmarked, className = '' }: BookmarkButtonProps) {
  const { user } = useAuth();
  const [bookmarked, setBookmarked] = useState(initialBookmarked ?? false);
  const [loading, setLoading] = useState(false);

  // Only look up state ourselves if the caller didn't already provide it
  // (e.g. a lone bookmark button on a detail page, vs. a grid of cards
  // that already fetched bookmark state in bulk for efficiency).
  useEffect(() => {
    if (initialBookmarked !== undefined || !user) return;
    let cancelled = false;
    loadBookmarkIds(user.id, kind)
      .then((ids) => { if (!cancelled) setBookmarked(ids.has(targetId)); })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, kind, targetId]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault(); // cards are often wrapped in a Link — don't navigate when tapping the bookmark icon
    e.stopPropagation();
    if (!user || loading) return;
    setLoading(true);
    const previous = bookmarked;
    setBookmarked(!previous); // optimistic
    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, targetId }),
      });
      if (!res.ok) setBookmarked(previous);
      else invalidateBookmarkCache(user.id, kind);
    } catch {
      setBookmarked(previous);
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      aria-label={bookmarked ? 'Remove bookmark' : 'Save for later'}
      title={bookmarked ? 'Remove bookmark' : 'Save for later'}
      className={`text-lg leading-none transition-colors disabled:opacity-50 ${
        bookmarked ? 'text-pulse-600' : 'text-ink-300 hover:text-pulse-500'
      } ${className}`}
    >
      {bookmarked ? '🔖' : '📑'}
    </button>
  );
}
