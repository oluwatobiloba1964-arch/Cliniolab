// src/components/quiz/AddToQueueButton.tsx
'use client';

import { useEffect, useState } from 'react';
import { QUIZ_QUEUE_KEY, readJson, writeJson } from '@/lib/services/localExtrasService';

interface QueueEntry {
  id: string;
  title: string;
  addedAt: string;
}

export function AddToQueueButton({ quizId, title }: { quizId: string; title: string }) {
  const [queued, setQueued] = useState(false);

  useEffect(() => {
    const list = readJson<QueueEntry[]>(QUIZ_QUEUE_KEY, []);
    setQueued(list.some((i) => i.id === quizId));
  }, [quizId]);

  function toggle() {
    const list = readJson<QueueEntry[]>(QUIZ_QUEUE_KEY, []);
    if (queued) {
      const next = list.filter((i) => i.id !== quizId);
      writeJson(QUIZ_QUEUE_KEY, next);
      setQueued(false);
    } else {
      const next: QueueEntry[] = [
        ...list.filter((i) => i.id !== quizId),
        { id: quizId, title, addedAt: new Date().toISOString() },
      ];
      writeJson(QUIZ_QUEUE_KEY, next);
      setQueued(true);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
        queued
          ? 'border-pulse-400 bg-pulse-50 text-pulse-700'
          : 'border-ink-200 text-ink-600 hover:border-pulse-300 hover:text-pulse-700'
      }`}
    >
      {queued ? 'Queued for tonight' : 'Add to tonight'}
    </button>
  );
}
