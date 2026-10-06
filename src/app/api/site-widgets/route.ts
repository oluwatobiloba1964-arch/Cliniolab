// File: src/app/api/site-widgets/route.ts
import { NextResponse } from 'next/server';
import {
  abbreviationService,
  bannerService,
  dailyQuizService,
  featureFlagService,
  scholarService,
  siteSettingsService,
} from '@/lib/db';

/**
 * One public request that replaces the separate homepage/layout calls for
 * feature flags, banners, the daily quiz, the homepage video, scholar of the
 * day, and the random abbreviations teaser. Everything here is public, so the
 * whole response is edge-cached.
 */
export async function GET() {
  const flags = await featureFlagService.getFeatureFlagMap();
  const on = (key: string) => (flags as Record<string, boolean>)[key] !== false;

  const [headerBanners, footerBanners, dailyQuiz, homepageVideo, scholar, abbreviations] = await Promise.all([
    on('banners_header') ? bannerService.listActiveBanners('header') : Promise.resolve([]),
    on('banners_footer') ? bannerService.listActiveBanners('footer') : Promise.resolve([]),
    on('daily_quiz') ? dailyQuizService.getTodaysDailyQuiz() : Promise.resolve(null),
    on('homepage_video') ? siteSettingsService.getHomepageVideo() : Promise.resolve(null),
    on('scholar_of_the_day') ? scholarService.getActiveScholar() : Promise.resolve(null),
    on('medical_abbreviations') ? abbreviationService.listRandomAbbreviations(5, 'all') : Promise.resolve([]),
  ]);

  return NextResponse.json(
    {
      flags,
      banners: {
        header: { enabled: on('banners_header'), banners: headerBanners },
        footer: { enabled: on('banners_footer'), banners: footerBanners },
      },
      dailyQuiz: { enabled: on('daily_quiz'), quiz: dailyQuiz },
      homepageVideo: { enabled: on('homepage_video'), video: homepageVideo },
      scholar: { enabled: on('scholar_of_the_day'), scholar },
      abbreviations: { enabled: on('medical_abbreviations'), items: abbreviations },
    },
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' } }
  );
}
