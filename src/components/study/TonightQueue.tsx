// src/components/study/TonightQueue.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { QUIZ_QUEUE_KEY, readJson, writeJson } from '@/lib/services/localExtrasService';

interface QueueEntry {
  id: string;
  title: string;
  addedAt: string;
}

export function TonightQueue() {
  const [items, setItems] = useState<QueueEntry[]>([]);

  useEffect(() => {
    setItems(readJson<QueueEntry[]>(QUIZ_QUEUE_KEY, []));
  }, []);

  function persist(next: QueueEntry[]) {
    setItems(next);
    writeJson(QUIZ_QUEUE_KEY, next);
  }

  function remove(id: string) {
    persist(items.filter((i) => i.id !== id));
  }

  function clear() {
    persist([]);
  }

  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-pulse-200 bg-pulse-50/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pulse-700">
            Later tonight
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold text-ink-900">
            Queued for this device
          </h2>
        </div>
        <button
          type="button"
          onClick={clear}
          className="text-xs font-semibold text-ink-500 hover:text-red-600"
        >
          Clear all
        </button>
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-white bg-white px-3 py-2"
          >
            <Link href={`/quizzes/${item.id}`} className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink-800">{item.title}</p>
            </Link>
            <button
              type="button"
              onClick={() => remove(item.id)}
              className="text-xs font-semibold text-ink-400 hover:text-red-600"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
