// src/app/HomeClient.tsx
'use client';

import { useAuth } from '@/lib/auth/AuthProvider';
import { useHomeData } from '@/lib/hooks/useHomeData';
import { useLocalResumeItems } from '@/lib/hooks/useLocalResumeItems';
import { useLocalRecentlyViewed } from '@/lib/hooks/useLocalRecentlyViewed';

import { BannerSlot } from '@/components/layout/BannerSlot';
import { DailyQuizBanner } from '@/components/layout/DailyQuizBanner';
import { ScholarOfTheDayCard } from '@/components/layout/ScholarOfTheDayCard';
import { AbbreviationsTeaser } from '@/components/layout/AbbreviationsTeaser';
import { GuestPracticeSection } from '@/components/guest/GuestPracticeSection';
import { LocalClinicalPractice } from '@/components/study/LocalClinicalPractice';
import { CompactTeaserBlogSection } from '@/components/cms/CompactTeaserBlogSection';

import {
  HomeHero,
  HomeLatestArticle,
  HomeQuickActions,
  HomeStudyStrip,
  HomeSubjectExplorer,
  HomeLearningPath,
  HomeResumeSection,
  HomeRecentlyViewed,
  HomeCategoryFeeds,
  HomeResourcesSection,
  HomeJobsScholarshipsSection,
  HomeLeaderboardSection,
} from '@/components/home';

import {
  CLINICAL_PEARLS_CATEGORY_SLUG,
  EXAM_PREP_GUIDES_CATEGORY_SLUG,
} from '@/lib/constants/blogCategories';

import type { Category } from '@/types';

interface HomeClientProps {
  initialCategories: Category[];
}

export function HomeClient({ initialCategories }: HomeClientProps) {
  const { user } = useAuth();
  const home = useHomeData();

  const resumeItems = useLocalResumeItems(home.data?.quizzesByCategory);
  const recentlyViewed = useLocalRecentlyViewed();

  const blogCategories = home.data?.blogCategories ?? [];
  const clinicalPearls = blogCategories.find(
    (c) => c.slug === CLINICAL_PEARLS_CATEGORY_SLUG
  );
  const examPrep = blogCategories.find(
    (c) => c.slug === EXAM_PREP_GUIDES_CATEGORY_SLUG
  );

  return (
    <div className="bg-white">
      <HomeHero />
      <BannerSlot placement="header" />

      <HomeLatestArticle blogCategories={blogCategories} data={home.data} />
      <DailyQuizBanner />

      <HomeQuickActions signedIn={!!user} />
      <HomeStudyStrip />
      <HomeSubjectExplorer categories={initialCategories} />

      <HomeResumeSection items={resumeItems} />
      <HomeRecentlyViewed items={recentlyViewed} />

      <HomeLearningPath />

      {clinicalPearls && (
        <CompactTeaserBlogSection
          categoryId={clinicalPearls.id}
          categorySlug={clinicalPearls.slug}
          categoryName={clinicalPearls.name}
          icon="💡"
          tagline="Quick clinical insights worth remembering"
          initialPosts={
            home.failed ? undefined : home.data?.blogsByCategory?.[clinicalPearls.id] ?? null
          }
        />
      )}
      {examPrep && (
        <CompactTeaserBlogSection
          categoryId={examPrep.id}
          categorySlug={examPrep.slug}
          categoryName={examPrep.name}
          icon="📝"
          tagline="Focused guides to help you prep for exams"
          initialPosts={
            home.failed ? undefined : home.data?.blogsByCategory?.[examPrep.id] ?? null
          }
        />
      )}

      <GuestPracticeSection />

      <div className="mx-auto max-w-7xl px-6 py-10 sm:py-14">
        <LocalClinicalPractice />
      </div>

      <HomeCategoryFeeds
        categories={initialCategories}
        blogCategories={blogCategories}
        data={home.data}
        failed={home.failed}
      />

      <HomeLeaderboardSection
        enabled={home.leaderboardEnabled}
        label={home.leaderboardLabel}
        entries={home.leaderboard}
        currentUserId={user?.id ?? null}
        currentUserRank={home.currentUserRank}
      />

      <ScholarOfTheDayCard />

      <div className="[content-visibility:auto] [contain-intrinsic-size:1200px]">
        <HomeResourcesSection data={home.data} />
        <HomeJobsScholarshipsSection data={home.data} />
      </div>

      <AbbreviationsTeaser />
    </div>
  );
}
