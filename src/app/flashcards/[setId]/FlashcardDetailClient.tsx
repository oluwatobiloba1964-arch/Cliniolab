'use client';
// File: src/app/flashcards/[setId]/FlashcardDetailClient.tsx

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { FLASHCARD_DRAFT_NAMESPACE } from '@/components/flashcards/FlashcardRunner';
import { FlashcardStudyHub } from '@/components/flashcards/FlashcardStudyHub';
import { OfflineSaveButton } from '@/lib/offline/OfflineSaveButton';
import { loadDraft, saveDraft } from '@/lib/localDraft';
import { ShareButton } from '@/components/quiz/ShareButton';
import { BookmarkButton } from '@/components/ui/BookmarkButton';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CreatorProfileCard } from '@/components/creator/CreatorProfileCard';
import type { Flashcard, FlashcardSet } from '@/types';

// Caches the full { set, cards } payload so a later visit to the same set
// can skip re-fetching every card from the server. Keyed by set.updatedAt:
// a cheap ?preview=1 call (no cards) checks whether the set has changed
// since caching before deciding whether the cache is still good.
interface CachedFlashcardPayload {
  updatedAt: string;
  set: FlashcardSet;
  cards: Flashcard[];
}

function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString('en-NG')}`;
}

export function FlashcardDetailClient({ setId }: { setId: string }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [set, setSet] = useState<FlashcardSet | null>(null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [requiresPurchase, setRequiresPurchase] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setFetching(true);
      try {
        // Lightweight freshness check first - no cards, just the set row
        // (including updatedAt) and the purchase/visibility gating that
        // has to run fresh every visit regardless of any cache.
        const previewRes = await fetch(`/api/flashcards/${setId}?preview=1`);
        const previewData = await previewRes.json();
        if (cancelled) return;

        if (previewRes.status === 402) {
          setSet(previewData.set ?? null);
          setRequiresPurchase(true);
          return;
        }
        if (!previewRes.ok) {
          setError(previewData.error ?? 'Failed to load flashcard set');
          return;
        }

        // Cache hit: the set hasn't changed since we last fetched its
        // cards, so reuse them instead of re-fetching. Safe on every
        // retry/reopen of this set, including after finishing a study
        // session, since nothing about the cards themselves changes
        // between attempts - only quiz_attempts-style history would, and
        // flashcards don't grade/gate on that the way quizzes do.
        const cached = loadDraft<CachedFlashcardPayload>('cards-cache', setId);
        if (cached && cached.updatedAt === previewData.set.updatedAt) {
          setSet(cached.set);
          setCards(cached.cards);
          if (loadDraft(FLASHCARD_DRAFT_NAMESPACE, setId)) setStarted(true);
          return;
        }

        const res = await fetch(`/api/flashcards/${setId}`);
        const data = await res.json();
        if (cancelled) return;

        if (res.status === 402) {
          setSet(data.set ?? null);
          setRequiresPurchase(true);
          return;
        }
        if (!res.ok) {
          setError(data.error ?? 'Failed to load flashcard set');
          return;
        }
        setSet(data.set);
        setCards(data.cards ?? []);
        saveDraft<CachedFlashcardPayload>('cards-cache', setId, {
          updatedAt: data.set.updatedAt,
          set: data.set,
          cards: data.cards ?? [],
        });
        // Resume straight into the runner if a saved session exists for
        // this set (e.g. tab was closed mid-study).
        if (loadDraft(FLASHCARD_DRAFT_NAMESPACE, setId)) setStarted(true);
      } catch {
        if (!cancelled) setError('Network error while loading flashcard set');
      } finally {
        if (!cancelled) setFetching(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId, user]);

  const isOwner = !!user && !!set && (set.creatorId === user.id || user.role === 'admin' || user.role === 'moderator');

  async function handlePurchase() {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/flashcards/${setId}`)}`);
      return;
    }
    setPurchasing(true);
    setError(null);
    try {
      const res = await fetch(`/api/flashcards/${setId}/purchase`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to start checkout');
        return;
      }
      window.location.href = data.checkoutLink;
    } catch {
      setError('Network error while starting checkout');
    } finally {
      setPurchasing(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this flashcard set permanently? This cannot be undone.')) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/flashcards/${setId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        setDeleteError(data.error ?? 'Failed to delete');
        return;
      }
      router.push('/dashboard');
    } catch {
      setDeleteError('Network error while deleting');
    } finally {
      setDeleting(false);
    }
  }

  if (loading || fetching) return null;

  if (error && !set) {
    return (
      <div className="ui-error-state mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Can&apos;t load this set</h1>
        <p className="mt-2 text-ink-500">{error}</p>
      </div>
    );
  }

  if (!set) return null;

  if (started && cards.length > 0) {
    return (
      <FlashcardStudyHub
        title={set.title}
        cards={cards.map((c) => ({ id: c.id, front: c.front, back: c.back, explanation: c.explanation }))}
        draftId={setId}
        shuffle={set.shuffleCards}
        onDone={() => setStarted(false)}
        onComplete={() => {
          if (user) fetch(`/api/flashcards/${setId}/attempts`, { method: 'POST' }).catch(() => {});
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Card className="ui-polish-card p-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="rounded bg-pulse-50 px-2 py-0.5 text-xs font-semibold text-pulse-600">Flashcard</span>
            <h1 className="mt-2 font-display text-3xl font-semibold text-ink-800">{set.title}</h1>
            {!requiresPurchase && (
              <div className="mt-2">
                <OfflineSaveButton
                  kind="flashcards"
                  sourceId={set.id}
                  title={set.title}
                  pricing={set.pricing}
                  loadPayload={async () => ({ set, cards })}
                />
              </div>
            )}
          </div>
          <BookmarkButton kind="flashcard" targetId={set.id} />
        </div>
        {set.description && <p className="mt-3 text-ink-500">{set.description}</p>}

        <div className="mt-6 flex flex-wrap items-center gap-4 font-mono text-xs text-ink-400">
          <span>{requiresPurchase ? '—' : cards.length} cards</span>
          <span>{set.pricing === 'paid' && set.priceKobo ? formatNaira(set.priceKobo) : 'Free'}</span>
        </div>

        {error && <p className="mt-4 text-sm text-critical-500">{error}</p>}

        {requiresPurchase ? (
          <div className="mt-8">
            <p className="text-sm text-ink-500">
              This is a paid flashcard set. Purchase it to unlock the cards.
            </p>
            <Button className="mt-4" onClick={handlePurchase} disabled={purchasing}>
              {purchasing ? 'Starting checkout…' : `Buy for ${set.priceKobo ? formatNaira(set.priceKobo) : ''}`}
            </Button>
          </div>
        ) : (
          <div className="mt-8 flex flex-wrap gap-2">
            <Button onClick={() => setStarted(true)} disabled={cards.length === 0}>
              Study with flashcards
            </Button>
            {isOwner && (
              <>
                <Button variant="secondary" onClick={() => router.push(`/flashcards/${setId}/edit`)}>
                  Edit
                </Button>
                <Button variant="danger" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Deleting…' : 'Delete'}
                </Button>
              </>
            )}
          </div>
        )}
        {deleteError && <p className="mt-2 text-sm text-critical-500">{deleteError}</p>}

        {set.visibility === 'public' && !requiresPurchase && (
          <div className="mt-6">
            <ShareButton
              url={typeof window !== 'undefined' ? window.location.href : ''}
              title={set.title}
              stats={{
                pricing: set.pricing,
                priceKobo: set.priceKobo,
                questionCount: cards.length,
              }}
            />
          </div>
        )}
      </Card>

      {set.visibility === 'public' && (
        <div className="mt-6">
          <CreatorProfileCard creatorId={set.creatorId} />
        </div>
      )}
    </div>
  );
}
