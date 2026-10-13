// src/lib/hooks/useLocalResumeItems.ts
'use client';

import { useEffect, useState } from 'react';
import type { QuizWithStats } from '@/types';

const DRAFT_PREFIXES = ['cliniolab:draft:attempt:', 'cliniolab:draft:study:'];
const MAX_ITEMS = 3;

/**
 * Unfinished quiz sessions, recovered from the browser-only draft
 * namespace. Purely local — no persistence or network request. The pool
 * of quizzes to match ids against is passed in (already loaded by the
 * parent from /api/homepage-data), so this hook adds zero fetches.
 */
export function useLocalResumeItems(
  quizzesByCategory: Record<string, QuizWithStats[]> | undefined
): QuizWithStats[] {
  const [items, setItems] = useState<QuizWithStats[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const pool = Object.values(quizzesByCategory ?? {}).flat();
      const found: QuizWithStats[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (!key) continue;
        const prefix = DRAFT_PREFIXES.find((candidate) => key.startsWith(candidate));
        if (!prefix) continue;
        const id = key.slice(prefix.length);
        if (!id || found.some((q) => q.id === id)) continue;
        const quiz = pool.find((q) => q.id === id);
        if (quiz) found.push(quiz);
      }
      setItems(found.slice(0, MAX_ITEMS));
    } catch {
      // ignore — browser storage may be disabled
    }
  }, [quizzesByCategory]);

  return items;
}
