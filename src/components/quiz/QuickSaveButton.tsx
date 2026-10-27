// src/components/quiz/QuickSaveButton.tsx
'use client';

/**
 * Feature #18 - Quick-save reading list (anonymous bookmarks).
 *
 * Lets a logged-out visitor save any quiz, blog post, or resource to
 * a localStorage-backed reading list. The saved items appear on the
 * dashboard once they sign in, with a one-tap "sync to my account"
 * prompt. Pure client-side; no DB, no API call until sync.
 *
 * Use anywhere a logged-out user might want to come back to a piece of
 * content. The button's label changes based on whether the item is
 * already saved.
 */
import { useEffect, useState } from 'react';
import { FEATURE_KEYS, readLocal, writeLocal } from '@/lib/services/localFeatureService';

export type QuickSaveKind = 'quiz' | 'blog' | 'resource';

export interface QuickSaveItem {
  kind: QuickSaveKind;
  id: string;
  title: string;
  href: string;
  savedAt: string;
}

interface QuickSaveButtonProps {
  kind: QuickSaveKind;
  id: string;
  title: string;
  href: string;
  /** Variant for inline use. */
  variant?: 'default' | 'ghost';
  className?: string;
}

function isSame(a: QuickSaveItem, b: Pick<QuickSaveItem, 'kind' | 'id'>): boolean {
  return a.kind === b.kind && a.id === b.id;
}

export function QuickSaveButton({
  kind,
  id,
  title,
  href,
  variant = 'ghost',
  className = '',
}: QuickSaveButtonProps) {
  const [saved, setSaved] = useState(false);
  const [list, setList] = useState<QuickSaveItem[]>([]);

  useEffect(() => {
    const items = readLocal<QuickSaveItem[]>(FEATURE_KEYS.quickSaveBookmarks, []);
    setList(items);
    setSaved(items.some((i) => isSame(i, { kind, id })));
  }, [kind, id]);

  function toggle() {
    let next: QuickSaveItem[];
    if (saved) {
      next = list.filter((i) => !isSame(i, { kind, id }));
    } else {
      next = [
        { kind, id, title, href, savedAt: new Date().toISOString() },
        ...list.filter((i) => !isSame(i, { kind, id })),
      ].slice(0, 100);
    }
    setList(next);
    setSaved(!saved);
    writeLocal(FEATURE_KEYS.quickSaveBookmarks, next);
  }

  const base =
    variant === 'ghost'
      ? 'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-ink-500 hover:bg-ink-100 hover:text-ink-700'
      : 'inline-flex items-center gap-1.5 rounded-md border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-600 hover:border-pulse-300 hover:text-pulse-700';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from reading list' : 'Save to reading list'}
      className={`${base} ${className}`}
    >
      <span aria-hidden="true" className="text-sm">
        {saved ? '★' : '☆'}
      </span>
      {saved ? 'Saved' : 'Save for later'}
    </button>
  );
}

/**
 * Hook returning the list of quick-saved items, plus a function to
 * clear them after a successful sync to the user's account.
 *
 * Pure client-side; useful for the dashboard to render the saved list
 * with a "Sync now" button when the user signs in.
 */
export function useQuickSavedItems() {
  const [items, setItems] = useState<QuickSaveItem[]>([]);

  useEffect(() => {
    setItems(readLocal<QuickSaveItem[]>(FEATURE_KEYS.quickSaveBookmarks, []));
  }, []);

  function clearAll() {
    setItems([]);
    writeLocal(FEATURE_KEYS.quickSaveBookmarks, []);
  }

  function remove(kind: QuickSaveKind, id: string) {
    const next = items.filter((i) => !isSame(i, { kind, id }));
    setItems(next);
    writeLocal(FEATURE_KEYS.quickSaveBookmarks, next);
  }

  return { items, clearAll, remove };
}
