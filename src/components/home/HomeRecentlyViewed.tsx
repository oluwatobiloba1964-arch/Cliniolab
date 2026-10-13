// src/components/home/HomeRecentlyViewed.tsx
'use client';

import Link from 'next/link';
import type { RecentlyViewedItem } from '@/lib/hooks/useLocalRecentlyViewed';

export function HomeRecentlyViewed({ items }: { items: RecentlyViewedItem[] }) {
  if (items.length === 0) return null;

  return (
    <section
      className="mx-auto max-w-7xl px-6 pb-10 sm:pb-14"
      aria-labelledby="recently-viewed-heading"
    >
      <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pulse-600">
              Saved in this browser
            </p>
            <h2
              id="recently-viewed-heading"
              className="mt-1 font-display text-xl font-semibold text-ink-900 sm:text-2xl"
            >
              Recently viewed
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Return to learning materials you opened recently on this device.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-pulse-600 hover:text-pulse-700"
          >
            Open study space →
          </Link>
        </div>
        <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group min-w-0 rounded-xl border border-ink-100 bg-ink-50/40 p-4 transition hover:-translate-y-0.5 hover:border-pulse-200 hover:bg-white hover:shadow-sm"
            >
              <p className="line-clamp-2 break-words font-semibold text-ink-800 group-hover:text-pulse-700">
                {item.title}
              </p>
              <p className="mt-2 min-w-0 truncate text-xs text-ink-400">{item.href}</p>
              <p className="mt-3 text-xs font-semibold text-pulse-600">Continue →</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
