'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FlashcardStudyHub } from '@/components/flashcards/FlashcardStudyHub';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { usePublicConfig } from '@/lib/hooks/usePublicConfig';
import { OfflineSaveButton } from '@/lib/offline/OfflineSaveButton';
import type { Flashcard, FlashcardSet } from '@/types';

export function GuestFlashcardClient({ setId }: { setId: string }) {
  const router = useRouter();
  const { flags } = usePublicConfig();
  const [set, setSet] = useState<FlashcardSet | null>(null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!flags.guestPractice) {
      setLoading(false);
      return;
    }
    fetch(`/api/guest/flashcards/${setId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Not available');
        setSet(data.set);
        setCards(data.cards ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Not available'))
      .finally(() => setLoading(false));
  }, [setId, flags.guestPractice]);

  if (loading) return null;

  if (!flags.guestPractice || error || !set) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Not available</h1>
        <p className="mt-2 text-ink-500">{error ?? 'This set is no longer available for guests.'}</p>
        <Link href="/guest" className="mt-4 inline-block text-pulse-600 underline">Back to Guest Practice</Link>
      </div>
    );
  }

  if (started) {
    return (
      <FlashcardStudyHub
        title={set.title}
        cards={cards.map((c) => ({ id: c.id, front: c.front, back: c.back, explanation: c.explanation }))}
        shuffle={set.shuffleCards}
        onDone={() => router.push('/guest')}
        onComplete={() => fetch(`/api/guest/flashcards/${setId}/complete`, { method: 'POST' }).catch(() => {})}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Card className="p-8">
        <span className="rounded bg-pulse-50 px-2 py-0.5 text-xs font-semibold text-pulse-600">
          Guest Practice · Flashcards
        </span>
        <h1 className="mt-3 font-display text-3xl font-semibold text-ink-800">{set.title}</h1>
        {set.description && <p className="mt-2 text-ink-500">{set.description}</p>}
        <p className="mt-4 text-sm text-ink-500">{cards.length} cards · No account needed</p>
        <p className="mt-1 text-xs text-ink-400">Your progress will not be saved. Create a free account to keep it.</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={() => setStarted(true)}>
            Start
          </Button>
          <OfflineSaveButton
            kind="flashcards"
            sourceId={set.id}
            title={set.title}
            pricing="free"
            loadPayload={async () => ({ set, cards })}
          />
        </div>
      </Card>
    </div>
  );
}
