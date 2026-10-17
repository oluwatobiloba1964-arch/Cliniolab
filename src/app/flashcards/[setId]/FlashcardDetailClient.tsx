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
  cachedAt?: number;
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
    const cached = loadDraft<CachedFlashcardPayload>('cards-cache', setId);
    const safeInstantCache = !!cached
      && Array.isArray(cached.cards)
      && cached.set?.id === setId
      && cached.set?.pricing === 'free'
      && cached.set?.visibility === 'public'
      && typeof cached.cachedAt === 'number'
      && Date.now() - cached.cachedAt >= 0
      && Date.now() - cached.cachedAt <= 5 * 60 * 1000;

    // Public, free sets can render from the local cache immediately while the
    // existing lightweight preview request validates freshness. Paid/private
    // sets never reveal cached cards before the existing access check passes.
    if (safeInstantCache && cached) {
      setSet(cached.set);
      setCards(cached.cards);
      setError(null);
      setRequiresPurchase(false);
      setFetching(false);
      if (loadDraft(FLASHCARD_DRAFT_NAMESPACE, setId)) setStarted(true);
    } else {
      setFetching(true);
    }

    async function load() {
      try {
        // A fresh local copy of a public, free set is enough to start.
        // Paid/private sets always continue through the existing access gate.
        if (safeInstantCache) return;
        const previewRes = await fetch(`/api/flashcards/${setId}?preview=1`);
        const previewData = await previewRes.json();
        if (cancelled) return;

        if (previewRes.status === 402) {
          setSet(previewData.set ?? cached?.set ?? null);
          setCards([]);
          setStarted(false);
          setRequiresPurchase(true);
          return;
        }
        if (!previewRes.ok) {
          // Keep an already-rendered public/free copy for transient server
          // errors, but never keep it when the server says the set is gone.
          if (safeInstantCache && previewRes.status >= 500) {
            setError('Showing a saved copy. Reconnect to check for updates.');
            return;
          }
          setCards([]);
          setSet(null);
          setStarted(false);
          setError(previewData.error ?? 'Failed to load flashcard set');
          return;
        }

        if (cached && cached.updatedAt === previewData.set.updatedAt) {
          setSet(cached.set);
          setCards(cached.cards);
          setRequiresPurchase(false);
          setError(null);
          saveDraft<CachedFlashcardPayload>('cards-cache', setId, {
            updatedAt: cached.updatedAt,
            cachedAt: Date.now(),
            set: cached.set,
            cards: cached.cards,
          });
          if (loadDraft(FLASHCARD_DRAFT_NAMESPACE, setId)) setStarted(true);
          return;
        }

        setFetching(true);
        const res = await fetch(`/api/flashcards/${setId}`);
        const data = await res.json();
        if (cancelled) return;

        if (res.status === 402) {
          setSet(data.set ?? previewData.set ?? null);
          setCards([]);
          setStarted(false);
          setRequiresPurchase(true);
          return;
        }
        if (!res.ok) {
          setError(data.error ?? 'Failed to load flashcard set');
          return;
        }
        setSet(data.set);
        setCards(data.cards ?? []);
        setRequiresPurchase(false);
        setError(null);
        saveDraft<CachedFlashcardPayload>('cards-cache', setId, {
          updatedAt: data.set.updatedAt,
          cachedAt: Date.now(),
          set: data.set,
          cards: data.cards ?? [],
        });
        if (loadDraft(FLASHCARD_DRAFT_NAMESPACE, setId)) setStarted(true);
      } catch {
        if (!cancelled) {
          if (safeInstantCache) setError('Showing a saved copy. Reconnect to check for updates.');
          else setError('Network error while loading flashcard set');
        }
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

  if (loading) return null;

  if (fetching && !set) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16" aria-live="polite">
        <div className="animate-pulse rounded-2xl border border-ink-100 bg-white p-8 shadow-sm">
          <div className="h-4 w-24 rounded bg-ink-100" />
          <div className="mt-4 h-8 w-3/4 rounded bg-ink-100" />
          <div className="mt-3 h-4 w-full rounded bg-ink-50" />
          <div className="mt-8 h-11 w-48 rounded-xl bg-ink-100" />
        </div>
        <p className="mt-3 text-center text-xs text-ink-400">Loading flashcards…</p>
      </div>
    );
  }

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
