// src/components/blog/ReadingTimePill.tsx
'use client';

import { useMemo } from 'react';

export function ReadingTimePill({ content }: { content: string }) {
  const minutes = useMemo(() => {
    const text = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const words = text ? text.split(' ').length : 0;
    return Math.max(1, Math.ceil(words / 200));
  }, [content]);

  return (
    <span className="rounded bg-ink-50 px-2 py-0.5 text-xs font-semibold text-ink-500">
      {minutes} min read
    </span>
  );
}
