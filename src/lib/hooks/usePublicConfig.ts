'use client';

import { useEffect, useState } from 'react';
import type { PublicConfig } from '@/app/api/public-config/route';

/**
 * Client read of /api/public-config with a shared in-memory promise so many
 * components on one page cause a single request. Defaults to "everything on"
 * until the response arrives, so features never flicker off.
 */

export const DEFAULT_PUBLIC_CONFIG: PublicConfig = {
  flags: {
    guestPractice: true,
    darkMode: true,
    offlineMode: true,
    authorBox: true,
    flashcardLearn: true,
    flashcardMatch: true,
    flashcardTest: true,
    smartRevisionQueue: true,
    articleStudyMode: true,
    topicKnowledgeMaps: true,
  },
  theme: { defaultTheme: 'system' },
  offline: { maxItems: 20, allowPaid: true, refreshDays: 7 },
  guest: {
    homepageCount: 15,
    autoplay: true,
    intervalSeconds: 5,
    creatorAccess: 'all',
    sectionTitle: 'Guest Practice',
    sectionSubtitle: 'Try quizzes, study mode and flashcards right now. No account needed.',
    includeInSitemap: true,
  },
  authorBox: {
    showAuthorBox: true,
    showReviewer: true,
    reviewerLabel: 'Medically reviewed by',
    editorialPolicyUrl: '/editorial-policy',
    medicalReviewPolicyUrl: '/medical-review-policy',
  },
};

let cached: PublicConfig | null = null;
let inflight: Promise<PublicConfig> | null = null;

export function loadPublicConfig(): Promise<PublicConfig> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = fetch('/api/public-config')
      .then((res) => (res.ok ? (res.json() as Promise<PublicConfig>) : DEFAULT_PUBLIC_CONFIG))
      .catch(() => DEFAULT_PUBLIC_CONFIG)
      .then((cfg) => {
        cached = cfg;
        return cfg;
      });
  }
  return inflight;
}

export function usePublicConfig(): PublicConfig {
  const [config, setConfig] = useState<PublicConfig>(cached ?? DEFAULT_PUBLIC_CONFIG);
  useEffect(() => {
    let cancelled = false;
    loadPublicConfig().then((cfg) => {
      if (!cancelled) setConfig(cfg);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return config;
}
