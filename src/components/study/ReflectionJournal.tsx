// src/components/study/ReflectionJournal.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { formatRelativeTime, makeId, readToolkit, writeToolkitPatch } from '@/lib/services/localExtrasService';

interface ReflectionEntry {
  id: string;
  text: string;
  context: string;
  createdAt: string;
}

export function ReflectionJournal() {
  const [entries, setEntries] = useState<ReflectionEntry[]>([]);
  const [draft, setDraft] = useState('');
  const [context, setContext] = useState('');

  useEffect(() => {
    const toolkit = readToolkit<{ reflectionLog?: ReflectionEntry[] }>();
    setEntries(toolkit.reflectionLog ?? []);
  }, []);

  function persist(next: ReflectionEntry[]) {
    setEntries(next);
    writeToolkitPatch({ reflectionLog: next });
  }

  function save() {
    const text = draft.trim();
    if (!text) return;
    const entry: ReflectionEntry = {
      id: makeId(),
      text,
      context: context.trim(),
      createdAt: new Date().toISOString(),
    };
    persist([entry, ...entries].slice(0, 100));
    setDraft('');
    setContext('');
  }

  function remove(id: string) {
    persist(entries.filter((e) => e.id !== id));
  }

  return (
    <Card className="p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pulse-600">
          On this device
        </p>
        <h2 className="mt-1 font-display text-xl font-semibold text-ink-900">
          Reflection journal
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          Write a quick note after a session. It stays in this browser.
        </p>
      </div>

      <div className="mt-4 space-y-2">
        <input
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="What was this about? e.g. Pharmacology quiz"
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="What did you learn? What was hard?"
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={save}
          disabled={!draft.trim()}
          className="rounded-lg bg-pulse-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Save reflection
        </button>
      </div>

      <ul className="mt-4 space-y-2">
        {entries.map((e) => (
          <li key={e.id} className="rounded-lg border border-ink-100 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                {e.context && (
                  <p className="text-xs font-semibold uppercase tracking-wide text-pulse-600">
                    {e.context}
                  </p>
                )}
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink-700">{e.text}</p>
                <p className="mt-1 text-xs text-ink-400">{formatRelativeTime(e.createdAt)}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(e.id)}
                className="text-xs font-semibold text-ink-400 hover:text-red-600"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
        {entries.length === 0 && (
          <li className="rounded-lg border border-dashed border-ink-200 p-4 text-sm text-ink-500">
            Nothing written yet.
          </li>
        )}
      </ul>
    </Card>
  );
}
