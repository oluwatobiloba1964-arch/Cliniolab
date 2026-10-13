// src/components/study/CopiedExplanationsLog.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { COPIED_EXPLANATIONS_KEY, formatRelativeTime, readJson } from '@/lib/services/localExtrasService';

interface CopiedEntry {
  id: string;
  quizTitle: string;
  prompt: string;
  explanation: string;
  copiedAt: string;
}

export function CopiedExplanationsLog() {
  const [entries, setEntries] = useState<CopiedEntry[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setEntries(readJson<CopiedEntry[]>(COPIED_EXPLANATIONS_KEY, []));
  }, []);

  async function copyAgain(entry: CopiedEntry) {
    try {
      await navigator.clipboard.writeText(entry.explanation);
      setCopied(entry.id);
      window.setTimeout(() => setCopied((c) => (c === entry.id ? null : c)), 1500);
    } catch {
      // ignore
    }
  }

  if (entries.length === 0) return null;

  return (
    <Card className="p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pulse-600">
          On this device
        </p>
        <h2 className="mt-1 font-display text-xl font-semibold text-ink-900">
          Recently copied explanations
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          The last 20 explanations you copied from a result screen.
        </p>
      </div>

      <ul className="mt-4 space-y-3">
        {entries.map((e) => (
          <li key={e.id} className="rounded-lg border border-ink-100 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-pulse-600">
              {e.quizTitle}
            </p>
            <p className="mt-1 line-clamp-2 text-sm font-semibold text-ink-800">{e.prompt}</p>
            <p className="mt-1 whitespace-pre-line text-sm text-ink-600">{e.explanation}</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-xs text-ink-400">{formatRelativeTime(e.copiedAt)}</span>
              <button
                type="button"
                onClick={() => copyAgain(e)}
                className="rounded-md border border-ink-200 px-2.5 py-1 text-xs font-semibold text-ink-600 hover:border-pulse-300 hover:text-pulse-700"
              >
                {copied === e.id ? 'Copied' : 'Copy again'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
