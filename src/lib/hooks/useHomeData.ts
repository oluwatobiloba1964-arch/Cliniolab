// FILE: src/lib/hooks/useHomeData.ts
'use client';

import { useEffect, useState } from 'react';
import { fetchJsonNoStore, publicFetchJsonSessionCached } from '@/lib/client/publicFetch';
import type {
  BlogPost,
  FlashcardSetWithStats,
  LeaderboardEntry,
  QuizWithStats,
  Resource,
} from '@/types';

export interface BlogCategoryOption {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
}

export interface HomeData {
  blogCategories: BlogCategoryOption[];
  resourcesEnabled: boolean;
  resources: Resource[];
  flashcardsEnabled: boolean;
  latestFlashcards: FlashcardSetWithStats[];
  jobPosts: BlogPost[];
  scholarshipPosts: BlogPost[];
  blogsByCategory: Record<string, BlogPost[]>;
  quizzesByCategory: Record<string, QuizWithStats[]>;
  flashcardsByCategory: Record<string, FlashcardSetWithStats[]>;
}

export interface HomeDataResult {
  data: HomeData | null;
  failed: boolean;
  leaderboard: LeaderboardEntry[];
  leaderboardEnabled: boolean;
  leaderboardLabel: string;
  currentUserRank: number | null;
}

/**
 * All three homepage-only client fetches, kept together so HomeClient is
 * no longer responsible for wiring up URLs and intermediate state. Each
 * fetch fails independently — a slow leaderboard never blocks the rest
 * of the homepage.
 */
export function useHomeData(): HomeDataResult {
  const [data, setData] = useState<HomeData | null>(null);
  const [failed, setFailed] = useState(false);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardEnabled, setLeaderboardEnabled] = useState(true);
  const [leaderboardLabel, setLeaderboardLabel] = useState('Top Quiz Takers');
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);

  useEffect(() => {
    publicFetchJsonSessionCached<HomeData>('/api/homepage-data', 5 * 60_000)
      .then(setData)
      .catch(() => setFailed(true));

    fetchJsonNoStore<{
      enabled: boolean;
      entries?: LeaderboardEntry[];
      currentUserRank?: number | null;
    }>('/api/leaderboard/general')
      .then((d) => {
        if (!d) return;
        setLeaderboardEnabled(d.enabled);
        setLeaderboard(d.entries ?? []);
        setCurrentUserRank(d.currentUserRank ?? null);
      })
      .catch(() => {
        // ignore — leaderboard is a soft failure
      });

    publicFetchJsonSessionCached<{ label?: string }>('/api/flags/leaderboard_general', 15 * 60_000)
      .then((d) => {
        if (d?.label) setLeaderboardLabel(d.label);
      })
      .catch(() => {
        // ignore
      });
  }, []);

  return { data, failed, leaderboard, leaderboardEnabled, leaderboardLabel, currentUserRank };
}
