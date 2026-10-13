// src/lib/hooks/useRecentSearches.ts
'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'cliniolab_recent_searches';
const MAX_RECENT = 5;

/**
 * Recent search terms, stored in localStorage. Kept as a hook so
 * HomeClient no longer needs to reach into localStorage directly, and
 * any future search box on another page can share the same list.
 */
export function useRecentSearches() {
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(saved)) {
        setRecent(saved.filter((x): x is string => typeof x === 'string').slice(0, MAX_RECENT));
      }
    } catch {
      // ignore — recent searches are a best-effort convenience only
    }
  }, []);

  const push = useCallback((term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecent((prev) => {
      const next = [
        trimmed,
        ...prev.filter((t) => t.toLowerCase() !== trimmed.toLowerCase()),
      ].slice(0, MAX_RECENT);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore — in-memory state still works for this session
      }
      return next;
    });
  }, []);

  return { recent, push };
}
