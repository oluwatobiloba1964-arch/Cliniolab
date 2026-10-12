// File: src/components/layout/LocalActivityTracker.tsx
'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { RECENTLY_VIEWED_KEY } from '@/lib/services/localStudyService';

type ViewedItem = { href: string; title: string; viewedAt: string };

/** Records navigation locally only. It does not fetch or send analytics. */
export function LocalActivityTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin') || pathname.startsWith('/api')) return;
    try {
      const existing = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || '[]') as ViewedItem[];
      const title = document.title.replace(/\s*[|·-]\s*Cliniolab.*$/i, '').trim() || 'Cliniolab page';
      const next = [{ href: pathname, title, viewedAt: new Date().toISOString() }, ...existing.filter((item) => item?.href !== pathname)].slice(0, 12);
      localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
    } catch { /* Storage can be disabled or full. */ }
  }, [pathname]);
  return null;
}
