// File: src/components/layout/SmartRevisionBadge.tsx
// Navigation-bar badge that surfaces the count of currently-due missed
// questions in the SRS deck. Pure client-side: no fetch, no API call,
// no database read. Renders nothing on a fresh device.

'use client';

import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { getDueItems } from '@/lib/services/missedQuestionSrsService';

export function SmartRevisionBadge() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    function refresh() {
      if (cancelled) return;
      const items = getDueItems();
      setCount(items.length);
    }
    refresh();
    // Refresh every 60s while the navbar is mounted, so a card that
    // becomes due while the learner is browsing is reflected.
    const timer = setInterval(refresh, 60_000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  if (count === null || count === 0) return null;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-flag-100 px-2 py-0.5 text-[10px] font-semibold text-flag-700"
      aria-label={`${count} missed questions due for revision`}
      title={`${count} missed-question review${count === 1 ? '' : 's'} due now`}
    >
      <Zap className="h-3 w-3" aria-hidden="true" />
      {count}
    </span>
  );
}
