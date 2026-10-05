// File: src/app/HomeClient.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LeaderboardList } from '@/components/quiz/LeaderboardList';
import { ResourceCard } from '@/components/resources/ResourceCard';
import { CategoryBlogSection } from '@/components/cms/CategoryBlogSection';
import { CompactTeaserBlogSection } from '@/components/cms/CompactTeaserBlogSection';
import { FeaturedBlogPostCard, CompactBlogPostCard } from '@/components/cms/BlogPostCard';
import { CategoryQuizSection } from '@/components/quiz/CategoryQuizSection';
import { CategoryFlashcardSection } from '@/components/flashcards/CategoryFlashcardSection';
import { FlashcardSetCard, FeaturedFlashcardSetCard, CompactFlashcardSetCard } from '@/components/flashcards/FlashcardSetCard';
import { DailyQuizBanner } from '@/components/layout/DailyQuizBanner';
import { GuestPracticeSection } from '@/components/guest/GuestPracticeSection';
import { BannerSlot } from '@/components/layout/BannerSlot';
import { ScholarOfTheDayCard } from '@/components/layout/ScholarOfTheDayCard';
import { AbbreviationsTeaser } from '@/components/layout/AbbreviationsTeaser';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth/AuthProvider';
import { publicFetchJson } from '@/lib/client/publicFetch';
import { SearchAutocomplete } from '@/components/search/SearchAutocomplete';
import {
  JOB_CATEGORY_SLUG,
  SCHOLARSHIP_CATEGORY_SLUG,
  CLINICAL_PEARLS_CATEGORY_SLUG,
  EXAM_PREP_GUIDES_CATEGORY_SLUG,
} from '@/lib/constants/blogCategories';
import type { BlogPost, Category, LeaderboardEntry, Resource, FlashcardSetWithStats, QuizWithStats } from '@/types';

interface BlogCategoryOption { id: string; name: string; slug: string; sortOrder: number }

interface HomepageData {
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

// Job/Scholarship get their own dedicated pages (/jobs, /scholarships)
// instead of a homepage section, and Clinical Pearls/Exam Prep Guides get
// their own distinct compact-card teaser section below instead of the
// generic big-image CategoryBlogSection  -  so all four are filtered out
// of the generic per-category loop.
const HOMEPAGE_EXCLUDED_SLUGS = new Set([
  JOB_CATEGORY_SLUG,
  SCHOLARSHIP_CATEGORY_SLUG,
  CLINICAL_PEARLS_CATEGORY_SLUG,
  EXAM_PREP_GUIDES_CATEGORY_SLUG,
]);

interface HomeClientProps {
  initialCategories: Category[];
}

export function HomeClient({ initialCategories }: HomeClientProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [blogCategories, setBlogCategories] = useState<BlogCategoryOption[]>([]);
  const [homepageData, setHomepageData] = useState<HomepageData | null>(null);
  const [homepageDataFailed, setHomepageDataFailed] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardEnabled, setLeaderboardEnabled] = useState(true);
  const [leaderboardLabel, setLeaderboardLabel] = useState('Top Quiz Takers');
  const [leaderboardCurrentUserRank, setLeaderboardCurrentUserRank] = useState<number | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourcesEnabled, setResourcesEnabled] = useState(true);
  const [jobPosts, setJobPosts] = useState<BlogPost[]>([]);
  const [scholarshipPosts, setScholarshipPosts] = useState<BlogPost[]>([]);
  const [flashcardSets, setFlashcardSets] = useState<FlashcardSetWithStats[]>([]);
  const [flashcardsEnabled, setFlashcardsEnabled] = useState(true);

  useEffect(() => {
    // Aggregate the homepage feeds into one public request. The previous
    // implementation made one API call per category for blogs, quizzes and
    // flashcards, which could create dozens of Worker/Vercel invocations on
    // a single homepage load.
    publicFetchJson<HomepageData>('/api/homepage-data', 60_000)
      .then((data: HomepageData) => {
        setHomepageData(data);
        setBlogCategories(data.blogCategories ?? []);
        setResourcesEnabled(data.resourcesEnabled);
        setResources(data.resources ?? []);
        setFlashcardsEnabled(data.flashcardsEnabled);
        setFlashcardSets(data.latestFlashcards ?? []);
        setJobPosts(data.jobPosts ?? []);
        setScholarshipPosts(data.scholarshipPosts ?? []);
      })
      .catch(() => setHomepageDataFailed(true));

    publicFetchJson<{ enabled: boolean; entries?: LeaderboardEntry[]; currentUserRank?: number | null }>('/api/leaderboard/general', 60_000)
      .then((data: { enabled: boolean; entries?: LeaderboardEntry[]; currentUserRank?: number | null } | null) => {
        if (!data) return;
        setLeaderboardEnabled(data.enabled);
        setLeaderboard(data.entries ?? []);
        setLeaderboardCurrentUserRank(data.currentUserRank ?? null);
      })
      .catch(() => {});

    // Public endpoint: do not call the admin flags API from the public homepage.
    // The old call returned 401 and still consumed a Worker/Vercel invocation.
    publicFetchJson<{ label?: string }>('/api/flags/leaderboard_general', 60_000)
      .then((data) => {
        if (data?.label) setLeaderboardLabel(data.label);
      })
      .catch(() => {});
  }, []);

  const homepageBlogCategories = blogCategories.filter((c) => !HOMEPAGE_EXCLUDED_SLUGS.has(c.slug));
  const clinicalPearlsCategory = blogCategories.find((c) => c.slug === CLINICAL_PEARLS_CATEGORY_SLUG);
  const examPrepCategory = blogCategories.find((c) => c.slug === EXAM_PREP_GUIDES_CATEGORY_SLUG);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink-800 py-14 text-center text-white sm:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h1 className="font-display text-3xl font-semibold leading-tight sm:text-5xl">
            Practice, Revise &amp; Master Your Clinical &amp; Nursing Exams
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-ink-100 sm:text-lg">
            Cliniolab brings together student-built quizzes, CBT-style exams, and clinical study
            notes in one place so you can revise a topic, test yourself on it, and track how
            you're improving, all before you ever get to the real exam.
          </p>

          <SearchAutocomplete
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search nursing resources, quizzes, articles…"
            className="mx-auto mt-8 max-w-2xl overflow-visible rounded-xl bg-white shadow-lg"
            inputClassName="rounded-l-xl"
          />

          <div className="mt-6 grid grid-cols-1 gap-3 sm:mt-8 sm:flex sm:justify-center sm:gap-4">
            <Link href="/categories"><Button size="lg">Browse categories</Button></Link>
            <Link href={user ? '/quizzes/new' : '/login?next=%2Fquizzes%2Fnew'}>
              <Button size="lg" variant="secondary">Create a quiz</Button>
            </Link>
          </div>

          <div className="mx-auto mt-6 grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['/quizzes', '📝', 'Quizzes'],
              ['/flashcards', '🧠', 'Flashcards'],
              ['/resources', '📚', 'Resources'],
              ['/blog', '📖', 'Articles'],
            ].map(([href, icon, label]) => (
              <Link key={href} href={href} className="rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-left transition-colors hover:bg-white/10">
                <span className="text-base">{icon}</span>
                <span className="ml-2 text-xs font-semibold text-white">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <BannerSlot placement="header" />

      {!homepageData && !homepageDataFailed && (
        <div className="mx-auto max-w-7xl px-6 py-10" aria-label="Loading homepage content" aria-busy="true">
          <div className="h-5 w-40 animate-pulse rounded bg-ink-100" />
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-32 animate-pulse rounded-xl bg-ink-50" />
            ))}
          </div>
        </div>
      )}

      {/* Articles are the first major learning section after the hero.
          Categories remain intact; only the homepage ordering changes. */}
      {/* Blog / education content, one section per fixed category (excluding Job/Scholarship) */}
      {homepageBlogCategories.length > 0 && (
        <div className="mx-auto max-w-7xl px-6 pt-12">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-ink-100" />
            <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-ink-400">
              Latest Post
            </h2>
            <div className="h-px flex-1 bg-ink-100" />
          </div>
        </div>
      )}
      {homepageBlogCategories.map((category) => (
        <CategoryBlogSection
          key={category.id}
          categoryId={category.id}
          categorySlug={category.slug}
          categoryName={category.name}
          initialPosts={homepageDataFailed ? undefined : homepageData?.blogsByCategory?.[category.id] ?? null}
        />
      ))}

      {/* Clinical Pearls / Exam Prep Guides  -  compact badge-style cards,
          visually distinct from the generic per-category blog sections
          above, since these are meant to read as quick-hit reference
          content rather than full articles. */}
      {clinicalPearlsCategory && (
        <CompactTeaserBlogSection
          categoryId={clinicalPearlsCategory.id}
          categorySlug={clinicalPearlsCategory.slug}
          categoryName={clinicalPearlsCategory.name}
          icon="💡"
          tagline="Quick clinical insights worth remembering"
          initialPosts={homepageDataFailed ? undefined : homepageData?.blogsByCategory?.[clinicalPearlsCategory.id] ?? null}
        />
      )}
      {examPrepCategory && (
        <CompactTeaserBlogSection
          categoryId={examPrepCategory.id}
          categorySlug={examPrepCategory.slug}
          categoryName={examPrepCategory.name}
          icon="📝"
          tagline="Focused guides to help you prep for exams"
          initialPosts={homepageDataFailed ? undefined : homepageData?.blogsByCategory?.[examPrepCategory.id] ?? null}
        />
      )}

      <DailyQuizBanner />

      <GuestPracticeSection />

      <div className="chart-strip mx-auto max-w-7xl text-ink-200" aria-hidden />

      {/* Flashcards - general "all flashcards" feed across every category,
          placed before Quiz/Exam/Study per product requirements. */}
      {flashcardsEnabled && flashcardSets.length > 0 && (
        <>
          <div className="mx-auto max-w-7xl px-6 pt-12">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-ink-100" />
              <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-ink-400">
                Flashcards
              </h2>
              <div className="h-px flex-1 bg-ink-100" />
            </div>
          </div>
          <section className="mx-auto max-w-7xl px-6 py-12">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold text-ink-800">Flashcards</h2>
              <Link href="/flashcards" className="text-sm font-medium text-pulse-600 hover:text-pulse-700">
                See more →
              </Link>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[3fr_2fr]">
              <FeaturedFlashcardSetCard set={flashcardSets[0]} />
              {flashcardSets.length > 1 && (
                <div className="divide-y divide-ink-100">
                  {flashcardSets.slice(1).map((set) => (
                    <CompactFlashcardSetCard key={set.id} set={set} />
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {/* Quizzes, one section per top-level quiz category */}
      {categories.length > 0 && (
        <div className="mx-auto max-w-7xl px-6 pt-12">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-ink-100" />
            <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-ink-400">
              Quiz / Exam / Study
            </h2>
            <div className="h-px flex-1 bg-ink-100" />
          </div>
        </div>
      )}
      {categories.map((category) => (
        <div key={category.id}>
          <CategoryFlashcardSection category={category} initialSets={homepageDataFailed ? undefined : homepageData?.flashcardsByCategory?.[category.id] ?? null} />
          <CategoryQuizSection category={category} initialQuizzes={homepageDataFailed ? undefined : homepageData?.quizzesByCategory?.[category.id] ?? null} />
        </div>
      ))}

      <div className="mx-auto max-w-7xl px-6">
        <div className="flex items-center justify-between py-4">
          <Link href="/quizzes" className="text-sm font-medium text-pulse-600 hover:text-pulse-700">
            Browse all quizzes →
          </Link>
        </div>
      </div>

      {/* General leaderboard - across all categories */}
      {leaderboardEnabled && (
        <section className="border-y border-ink-100 bg-ink-50/40">
          <div className="mx-auto max-w-3xl px-6 py-16">
            <h2 className="font-display text-2xl font-semibold text-ink-800">{leaderboardLabel}</h2>
            <p className="mt-1 text-sm text-ink-500">Top performers across every category.</p>
            <div className="mt-6">
              <LeaderboardList
                entries={leaderboard}
                title={leaderboardLabel}
                currentUserId={user?.id ?? null}
                currentUserRank={leaderboardCurrentUserRank}
              />
            </div>
          </div>
        </section>
      )}

      <ScholarOfTheDayCard />

      <div className="[content-visibility:auto] [contain-intrinsic-size:1200px]">
            {/* Resources */}
      {resourcesEnabled && (
        <>
          <div className="mx-auto max-w-7xl px-6 pt-12">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-ink-100" />
              <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-ink-400">
                Books &amp; Past Questions
              </h2>
              <div className="h-px flex-1 bg-ink-100" />
            </div>
          </div>
          <section className="mx-auto max-w-7xl px-6 py-16">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold text-ink-800">Books &amp; Past Questions</h2>
              <Link href="/resources" className="text-sm font-medium text-pulse-600 hover:text-pulse-700">
                See more →
              </Link>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
              {resources.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
              ))}
              {resources.length === 0 && (
                <p className="col-span-full text-sm text-ink-400">No resources yet.</p>
              )}
            </div>
          </section>
        </>
      )}

      {/* Jobs teaser */}
      <div className="mx-auto max-w-7xl px-6 pt-12">
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-ink-100" />
          <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-ink-400">
            Jobs
          </h2>
          <div className="h-px flex-1 bg-ink-100" />
        </div>
      </div>
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold text-ink-800">Jobs</h2>
          <Link href="/jobs" className="text-sm font-medium text-pulse-600 hover:text-pulse-700">
            See more →
          </Link>
        </div>
        <p className="mt-2 text-sm text-ink-500">
          Clinical and nursing job openings curated for students and professionals.
        </p>
        {jobPosts.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[3fr_2fr]">
            <FeaturedBlogPostCard post={jobPosts[0]} />
            {jobPosts.length > 1 && (
              <div className="divide-y divide-ink-100">
                {jobPosts.slice(1).map((post) => (
                  <CompactBlogPostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="mt-6 text-sm text-ink-400">No job listings yet. Check back soon.</p>
        )}
      </section>

      {/* Scholarships teaser */}
      <div className="mx-auto max-w-7xl px-6 pt-12">
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-ink-100" />
          <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-ink-400">
            Scholarships
          </h2>
          <div className="h-px flex-1 bg-ink-100" />
        </div>
      </div>
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold text-ink-800">Scholarships</h2>
          <Link href="/scholarships" className="text-sm font-medium text-pulse-600 hover:text-pulse-700">
            See more →
          </Link>
        </div>
        <p className="mt-2 text-sm text-ink-500">
          Scholarship opportunities for nursing and clinical students.
        </p>
        {scholarshipPosts.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[3fr_2fr]">
            <FeaturedBlogPostCard post={scholarshipPosts[0]} />
            {scholarshipPosts.length > 1 && (
              <div className="divide-y divide-ink-100">
                {scholarshipPosts.slice(1).map((post) => (
                  <CompactBlogPostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="mt-6 text-sm text-ink-400">No scholarships yet. Check back soon.</p>
        )}
      </section>

      </div>

      <AbbreviationsTeaser />
    </div>
  );
}
