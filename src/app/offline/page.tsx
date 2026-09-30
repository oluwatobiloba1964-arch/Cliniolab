// src/app/offline/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { QuizRunner } from '@/components/quiz/QuizRunner';
import { FlashcardStudyHub } from '@/components/flashcards/FlashcardStudyHub';
import { usePublicConfig } from '@/lib/hooks/usePublicConfig';
import { listOfflineItems, removeOfflineItem, type OfflineItem } from '@/lib/offline/offlineStore';
import { gradeOfflineAttempt } from '@/lib/offline/gradeOffline';
import type { Quiz, QuizQuestion, Flashcard, FlashcardSet } from '@/types';

interface OfflineQuizPayload {
  quiz: Quiz;
  questions: QuizQuestion[];
}
interface OfflineFlashcardPayload {
  set: FlashcardSet;
  cards: Flashcard[];
}

/**
 * Items saved for offline use. Playing one here grades locally on the
 * device — nothing is uploaded, matching how the item was downloaded.
 */
export default function OfflinePage() {
  const { flags } = usePublicConfig();
  const [items, setItems] = useState<OfflineItem[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    listOfflineItems().then(setItems);
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  async function remove(id: string) {
    await removeOfflineItem(id);
    setItems((prev) => (prev ?? []).filter((i) => i.id !== id));
    if (openId === id) setOpenId(null);
  }

  if (!flags.offlineMode) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Offline downloads are unavailable</h1>
      </div>
    );
  }

  const open = items?.find((i) => i.id === openId);
  if (open) {
    if (open.kind === 'quiz') {
      const payload = open.payload as OfflineQuizPayload;
      return (
        <div>
          <div className="mx-auto max-w-2xl px-6 pt-6">
            <Button variant="secondary" size="sm" onClick={() => setOpenId(null)}>← Back to offline items</Button>
          </div>
          <QuizRunner
            quiz={payload.quiz}
            questions={payload.questions}
            submitEndpoint=""
            isFirstAttempt
            guest
            gradeLocally={(submission) => gradeOfflineAttempt(payload.quiz, payload.questions, submission)}
          />
        </div>
      );
    }
    const payload = open.payload as OfflineFlashcardPayload;
    return (
      <div>
        <div className="mx-auto max-w-2xl px-6 pt-6">
          <Button variant="secondary" size="sm" onClick={() => setOpenId(null)}>← Back to offline items</Button>
        </div>
        <FlashcardStudyHub
          title={payload.set.title}
          cards={payload.cards.map((c) => ({ id: c.id, front: c.front, back: c.back, explanation: c.explanation }))}
          shuffle={payload.set.shuffleCards}
          onDone={() => setOpenId(null)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      <h1 className="font-display text-3xl font-semibold text-ink-800">Offline items</h1>
      <p className="mt-2 text-ink-500">
        {online ? 'You are online.' : 'You are offline. Saved items below still work.'} Results here are graded on
        your device only and are not saved to your account.
      </p>

      {items === null ? null : items.length === 0 ? (
        <p className="mt-12 text-center text-ink-400">
          Nothing saved yet. Open a free quiz, study set or flashcard set and tap &quot;Save for offline&quot;.
        </p>
      ) : (
        <div className="mt-8 space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-400">
                  {item.kind === 'quiz' ? 'Quiz' : 'Flashcards'}
                </p>
                <p className="font-display text-lg font-medium text-ink-800">{item.title}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setOpenId(item.id)}>Open</Button>
                <Button size="sm" variant="danger" onClick={() => remove(item.id)}>Remove</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
