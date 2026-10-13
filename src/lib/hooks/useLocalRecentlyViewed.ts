// src/lib/hooks/useLocalRecentlyViewed.ts
'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'cliniolab_recently_viewed_v1';

export interface RecentlyViewedItem {
  href: string;
  title: string;
  viewedAt: string;
}

/**
 * Recently viewed pages, kept in localStorage. Written by
 * LocalActivityTracker; read here to render the homepage "Saved in this
 * browser" strip. Pure local — no network access.
 */
export function useLocalRecentlyViewed(limit = 4): RecentlyViewedItem[] {
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);

  useEffect(() => {
    try {
      const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(raw)) {
        const filtered = raw.filter(
          (item): item is RecentlyViewedItem =>
            item && typeof item.href === 'string' && item.href !== '/'
        );
        setItems(filtered.slice(0, limit));
      }
    } catch {
      // ignore
    }
  }, [limit]);

  return items;
}
