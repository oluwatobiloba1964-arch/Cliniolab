import { NextResponse } from 'next/server';
import { featureFlagService, platformSettingsService } from '@/lib/db';
import type { AuthorBoxSetting, GuestPracticeSetting, OfflineSetting, ThemeSetting } from '@/types';

export interface PublicConfig {
  flags: {
    guestPractice: boolean;
    darkMode: boolean;
    offlineMode: boolean;
    authorBox: boolean;
    flashcardLearn: boolean;
    flashcardMatch: boolean;
    flashcardTest: boolean;
    smartRevisionQueue: boolean;
    articleStudyMode: boolean;
    topicKnowledgeMaps: boolean;
  };
  theme: ThemeSetting;
  offline: OfflineSetting;
  guest: GuestPracticeSetting;
  authorBox: AuthorBoxSetting;
}

const FALLBACK: PublicConfig = {
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
  theme: platformSettingsService.DEFAULT_THEME,
  offline: platformSettingsService.DEFAULT_OFFLINE,
  guest: platformSettingsService.DEFAULT_GUEST_PRACTICE,
  authorBox: platformSettingsService.DEFAULT_AUTHOR_BOX,
};

/**
 * Small public read of the feature flags and admin settings the browser
 * needs (theme default, guest carousel, offline limits, flashcard modes).
 * Cached briefly at the edge so it does not add a database hit per page.
 */
export async function GET() {
  try {
    const [flags, theme, offline, guest, authorBox] = await Promise.all([
      featureFlagService.getFeatureFlagMap(),
      platformSettingsService.getThemeSetting(),
      platformSettingsService.getOfflineSetting(),
      platformSettingsService.getGuestPracticeSetting(),
      platformSettingsService.getAuthorBoxSetting(),
    ]);
    const on = (key: keyof typeof flags) => flags[key] !== false; // missing row = on
    const body: PublicConfig = {
      flags: {
        guestPractice: on('guest_practice'),
        darkMode: on('dark_mode'),
        offlineMode: on('offline_mode'),
        authorBox: on('author_box'),
        flashcardLearn: on('flashcard_learn_mode'),
        flashcardMatch: on('flashcard_match_mode'),
        flashcardTest: on('flashcard_test_mode'),
        smartRevisionQueue: on('smart_revision_queue'),
        articleStudyMode: on('article_study_mode'),
        topicKnowledgeMaps: on('topic_knowledge_maps'),
      },
      theme,
      offline,
      guest,
      authorBox,
    };
    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch {
    return NextResponse.json(FALLBACK);
  }
}
