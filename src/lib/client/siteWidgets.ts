// File: src/lib/client/siteWidgets.ts
import { publicFetchJson } from '@/lib/client/publicFetch';
import type { Banner, HomepageVideoSetting, MedicalAbbreviation, QuizWithStats, ScholarOfTheDay } from '@/types';

export interface SiteWidgets {
  flags: Record<string, boolean>;
  banners: {
    header: { enabled: boolean; banners: Banner[] };
    footer: { enabled: boolean; banners: Banner[] };
  };
  dailyQuiz: { enabled: boolean; quiz: QuizWithStats | null };
  homepageVideo: { enabled: boolean; video: HomepageVideoSetting | null };
  scholar: { enabled: boolean; scholar: ScholarOfTheDay | null };
  abbreviations: { enabled: boolean; items: MedicalAbbreviation[] };
}

/**
 * Shared, deduplicated loader for the layout/homepage widgets. Every component
 * that needs these calls this, so each page makes one request instead of many.
 */
export function getSiteWidgets(): Promise<SiteWidgets> {
  return publicFetchJson<SiteWidgets>('/api/site-widgets', 60_000);
}
