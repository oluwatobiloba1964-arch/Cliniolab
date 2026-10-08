// src/app/HomeClient.tsx
'use client';
// File: src/app/HomeClient.tsx

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
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
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
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
    try {
      const saved = JSON.parse(window.localStorage.getItem('cliniolab_recent_searches') || '[]');
      if (Array.isArray(saved)) setRecentSearches(saved.filter((x): x is string => typeof x === 'string').slice(0, 5));
    } catch {}

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

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (trimmed) {
      const next = [trimmed, ...recentSearches.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 5);
      setRecentSearches(next);
      try { window.localStorage.setItem('cliniolab_recent_searches', JSON.stringify(next)); } catch {}
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    }
  }

  const allArticles = Object.values<BlogPost[]>(homepageData?.blogsByCategory ?? {})
    .flat()
    .filter((post) => post.status === 'published');
  const latestArticle = allArticles
    .slice()
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })[0] ?? null;

  const featuredQuiz = categories
    .map((category) => homepageData?.quizzesByCategory?.[category.id]?.[0] ?? null)
    .find(Boolean) ?? null;
  const featuredFlashcard = flashcardSets[0] ?? null;

  // Frontend-only recommendation pool. It deliberately reuses the single
  // homepage payload already loaded above, so this adds no API/database work.
  // The homepage practice strip is intentionally limited to these three
  // learning categories. It reuses the quizzes already loaded by
  // /api/homepage-data, so changing the selection/order adds no request, D1
  // read, or Worker/Vercel invocation.
  const recommendedCategoryMatches = categories.filter((category) => {
    const value = `${category.name} ${category.slug}`.toLowerCase().replace(/_/g, '-');
    return (
      value.includes('nursing') ||
      value.includes('clinical-practice') ||
      value.includes('clinical practice') ||
      value.includes('clinical-specialist') ||
      value.includes('clinical specialist') ||
      value.includes('clinical-special')
    );
  });

  // Show the newest quiz first, regardless of whether it is a Quiz, Study, or
  // Exam mode. The three categories can each contribute their latest quizzes,
  // while duplicates are removed if a quiz is ever associated with more than
  // one matched category.
  const recommendedQuizPool = recommendedCategoryMatches
    .flatMap((category) => homepageData?.quizzesByCategory?.[category.id] ?? [])
    .filter((quiz, index, list) => list.findIndex((item) => item.id === quiz.id) === index)
    .sort((a, b) => {
      const aDate = new Date(a.createdAt).getTime();
      const bDate = new Date(b.createdAt).getTime();
      return bDate - aDate;
    })
    .slice(0, 6);
  const recommendedBlogCategories = blogCategories.filter((category) => {
    const value = `${category.name} ${category.slug}`.toLowerCase();
    return value.includes('nursing') || value.includes('clinical-practice') || value.includes('clinical practice') || value.includes('clinical-specialist') || value.includes('clinical specialist') || value.includes('clinical special');
  });
  const recommendedBlogPool = recommendedBlogCategories
    .flatMap((category) => homepageData?.blogsByCategory?.[category.id] ?? [])
    .filter((post, index, list) => post.status === 'published' && list.findIndex((item) => item.id === post.id) === index)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  // Recover unfinished quiz sessions from the existing browser-only draft
  // namespace. No new persistence or network request is introduced.
  const [resumeItems, setResumeItems] = useState<QuizWithStats[]>([]);
  useEffect(() => {
    try {
      const found: QuizWithStats[] = [];
      const prefixes = ['cliniolab:draft:attempt:', 'cliniolab:draft:study:'];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (!key) continue;
        const prefix = prefixes.find((candidate) => key.startsWith(candidate));
        if (!prefix) continue;
        const id = key.slice(prefix.length);
        if (!id || found.some((q) => q.id === id)) continue;
        const quiz = Object.values(homepageData?.quizzesByCategory ?? {}).flat().find((q) => q.id === id);
        if (quiz) found.push(quiz);
      }
      setResumeItems(found.slice(0, 3));
    } catch {}
  }, [homepageData]);

  return (
    <div className="bg-white">
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

          <form onSubmit={handleSearchSubmit} className="mx-auto mt-8 flex max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-lg sm:flex-row">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowRecentSearches(true)}
              onBlur={() => window.setTimeout(() => setShowRecentSearches(false), 120)}
              placeholder="Search nursing resources, quizzes, articles…"
              className="min-w-0 flex-1 px-4 py-3.5 text-sm text-ink-800 focus:outline-none"
            />
            <button
              type="submit"
              className="min-h-12 bg-pulse-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-pulse-700 sm:min-h-0"
            >
              Search
            </button>
          </form>
          {showRecentSearches && recentSearches.length > 0 && (
            <div className="mx-auto mt-2 max-w-2xl rounded-xl border border-ink-100 bg-white p-2 text-left shadow-lg" role="listbox" aria-label="Recent searches">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-ink-400">Recent searches</p>
              {recentSearches.map((term) => (
                <button key={term} type="button" className="block w-full rounded-lg px-2 py-2 text-left text-sm text-ink-600 hover:bg-ink-50" onMouseDown={() => { setSearchQuery(term); router.push(`/search?q=${encodeURIComponent(term)}`); }}>
                  ↗ {term}
                </button>
              ))}
            </div>
          )}

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

      {/* First learning touchpoint: the latest article. */}
      {latestArticle && (
        <section className="mx-auto max-w-7xl px-6 py-10 sm:py-14">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pulse-600">Latest article</p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-ink-900 sm:text-3xl">Start with something worth learning</h2>
            </div>
            <Link href="/blog" className="hidden text-sm font-semibold text-pulse-600 hover:text-pulse-700 sm:block">View all articles →</Link>
          </div>
          <FeaturedBlogPostCard post={latestArticle} />
          <Link href="/blog" className="mt-4 block text-sm font-semibold text-pulse-600 sm:hidden">View all articles →</Link>
        </section>
      )}

      {/* Daily Quiz stays immediately after the first article. */}
      <DailyQuizBanner />

      {/* Quick study actions */}
      <section className="mx-auto max-w-7xl px-6 py-10 sm:py-14">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">Choose your next step</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-ink-900 sm:text-3xl">How do you want to study today?</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { href: '/quizzes', icon: '📝', title: 'Practise', text: 'Test what you know with focused quizzes and CBT-style questions.', action: 'Take a quiz' },
            { href: '/flashcards', icon: '🧠', title: 'Review', text: 'Strengthen recall with quick, focused flashcard sessions.', action: 'Review cards' },
            { href: '/resources', icon: '📚', title: 'Learn', text: 'Build your understanding with clinical notes and study resources.', action: 'Explore resources' },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="group rounded-2xl border border-ink-100 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-pulse-200 hover:shadow-lg sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-pulse-50 text-xl">{item.icon}</span>
                <span className="text-sm font-semibold text-pulse-600 opacity-0 transition group-hover:opacity-100">→</span>
              </div>
              <h3 className="mt-5 font-display text-xl font-semibold text-ink-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-500">{item.text}</p>
              <p className="mt-4 text-sm font-semibold text-pulse-600">{item.action} →</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Browser-only study controls: these are navigation shortcuts and do not create database state. */}
      <section className="mx-auto max-w-7xl px-6 pb-10 sm:pb-14">
        <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
          <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pulse-600">Quick practice</p>
                <h2 className="mt-1 font-display text-xl font-semibold text-ink-900">Choose your study window</h2>
                <p className="mt-1 text-sm text-ink-500">Pick a target duration, then choose any quiz that fits your session.</p>
              </div>
              <span className="hidden rounded-full bg-pulse-50 px-2.5 py-1 text-[10px] font-semibold text-pulse-700 sm:block">No tracking</span>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[5, 10, 20].map((minutes) => (
                <Link key={minutes} href={`/quizzes?studyTime=${minutes}`} className="rounded-xl border border-ink-100 px-3 py-3 text-center transition hover:-translate-y-0.5 hover:border-pulse-200 hover:shadow-sm">
                  <span className="block font-display text-lg font-semibold text-ink-900">{minutes}</span>
                  <span className="text-[11px] font-semibold text-ink-400">minutes</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-ink-100 bg-ink-50/50 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">Study tools</p>
            <h2 className="mt-1 font-display text-xl font-semibold text-ink-900">Everything in one tap</h2>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[['📝','Quizzes','/quizzes'],['🧠','Flashcards','/flashcards'],['📚','Resources','/resources'],['📖','Articles','/blog']].map(([icon,label,href]) => (
                <Link key={href} href={href} className="rounded-xl border border-ink-100 bg-white px-3 py-3 text-sm font-semibold text-ink-700 transition hover:border-pulse-200 hover:text-pulse-700">{icon} <span className="ml-1">{label}</span></Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Subject explorer - derived from the existing category list. */}
      {categories.length > 0 && (
        <section className="border-y border-ink-100 bg-ink-50/50">
          <div className="mx-auto max-w-7xl px-6 py-12 sm:py-16">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">Explore by subject</p>
                <h2 className="mt-1 font-display text-2xl font-semibold text-ink-900 sm:text-3xl">Find your next topic</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500">Jump straight into a subject and practise the areas you need most.</p>
              </div>
              <Link href="/categories" className="text-sm font-semibold text-pulse-600 hover:text-pulse-700">View all subjects →</Link>
            </div>
            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {categories.slice(0, 8).map((category, index) => (
                <Link key={category.id} href={`/categories/group/${category.slug}`} className="group rounded-2xl border border-ink-100 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-pulse-200 hover:shadow-md">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-pulse-600">0{index + 1}</span>
                  <h3 className="mt-3 line-clamp-2 font-display text-base font-semibold text-ink-800 group-hover:text-pulse-700">{category.name}</h3>
                  <p className="mt-3 text-xs font-semibold text-ink-400 group-hover:text-pulse-600">Explore →</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {resumeItems.length > 0 && (
        <section className="mx-auto max-w-7xl px-6 pb-10 sm:pb-14">
          <div className="rounded-2xl border border-pulse-100 bg-pulse-50/40 p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pulse-600">Continue studying</p>
                <h2 className="mt-1 font-display text-2xl font-semibold text-ink-900">Pick up where you left off</h2>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold text-ink-500 shadow-sm">Saved on this device</span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {resumeItems.map((quiz) => (
                <Link key={quiz.id} href={`/quizzes/${quiz.id}`} className="group rounded-xl border border-white bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-pulse-200 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="line-clamp-2 font-display font-semibold text-ink-800 group-hover:text-pulse-700">{quiz.title}</h3>
                    <span className="shrink-0 text-pulse-600">→</span>
                  </div>
                  <p className="mt-2 text-xs text-ink-400">{quiz.questionCount} questions · {quiz.mode === 'exam' ? 'Exam' : quiz.mode === 'study' ? 'Study' : 'Quiz'} mode</p>
                  <p className="mt-3 text-xs font-semibold text-pulse-600">Continue session</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Learning path */}
      <section className="mx-auto max-w-7xl px-6 py-12 sm:py-16">
        <div className="rounded-3xl bg-ink-900 p-6 text-white sm:p-8 lg:p-10">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pulse-300">The Cliniolab method</p>
            <h2 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">Turn study time into progress.</h2>
            <p className="mt-3 text-sm leading-6 text-ink-300">Move naturally from understanding a topic to testing it, reviewing gaps and returning until the knowledge sticks.</p>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-4">
            {[
              ['01', 'Learn', 'Understand the concept'],
              ['02', 'Practise', 'Apply it with questions'],
              ['03', 'Review', 'Spot gaps and mistakes'],
              ['04', 'Master', 'Return until confident'],
            ].map(([number, title, text], index) => (
              <div key={title} className="relative rounded-2xl border border-white/10 bg-white/[0.05] p-4 transition hover:bg-white/[0.08]">
                {index < 3 && <span className="absolute -right-2 top-1/2 hidden h-px w-4 bg-white/20 sm:block" aria-hidden="true" />}
                <span className="font-mono text-xs text-pulse-300">{number}</span>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1 text-xs leading-5 text-ink-300">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Clinical Pearls / Exam Prep Guides */}
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

      <GuestPracticeSection />

      <div className="chart-strip mx-auto max-w-7xl text-ink-200" aria-hidden />

      {/* Flashcards */}
      {flashcardsEnabled && flashcardSets.length > 0 && (
        <section className="mx-auto max-w-7xl px-6 py-12 sm:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">Review fast</p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-ink-900 sm:text-3xl">Featured flashcards</h2>
              <p className="mt-2 text-sm text-ink-500">Short sessions designed for active recall.</p>
            </div>
            <Link href="/flashcards" className="text-sm font-semibold text-pulse-600 hover:text-pulse-700">See all flashcards →</Link>
          </div>
          <div className="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
            {featuredFlashcard && <FeaturedFlashcardSetCard set={featuredFlashcard} />}
            {flashcardSets.length > 1 && (
              <div className="divide-y divide-ink-100 rounded-2xl border border-ink-100 bg-white px-4 shadow-sm">
                {flashcardSets.slice(1, 4).map((set) => (
                  <CompactFlashcardSetCard key={set.id} set={set} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Quiz discovery */}
      {categories.length > 0 && (
        <section className="bg-ink-50/50 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">Practice</p>
                <h2 className="mt-1 font-display text-2xl font-semibold text-ink-900 sm:text-3xl">Quiz &amp; exam practice</h2>
                <p className="mt-2 max-w-2xl text-sm text-ink-500">Recommended from Nursing, Clinical Practice and Clinical Specialist, with the newest relevant content surfaced first.</p>
              </div>
              <Link href="/quizzes" className="text-sm font-semibold text-pulse-600 hover:text-pulse-700">Browse all quizzes →</Link>
            </div>

            {recommendedQuizPool.length > 0 ? (
              <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {recommendedQuizPool.map((quiz, index) => (
                  <Link key={quiz.id} href={`/quizzes/${quiz.id}`} className="group rounded-2xl border border-ink-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-pulse-200 hover:shadow-lg">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-pulse-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-pulse-700">{quiz.mode === 'exam' ? 'Exam / CBT' : 'Recommended'}</span>
                      <span className="text-xs font-semibold text-ink-400">{quiz.questionCount} Qs</span>
                    </div>
                    <h3 className="mt-4 line-clamp-2 font-display text-lg font-semibold text-ink-900 group-hover:text-pulse-700">{quiz.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-500">{quiz.description || 'A focused practice session selected from the clinical learning categories.'}</p>
                    <div className="mt-4 flex items-center justify-between text-xs">
                      <span className="text-ink-400">{quiz.categoryName || 'Clinical practice'} · {quiz.difficulty}</span>
                      <span className="font-semibold text-pulse-600">Start →</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : featuredQuiz ? (
              <div className="mt-6 rounded-2xl border border-pulse-100 bg-white p-6 shadow-sm">
                <span className="rounded-full bg-pulse-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-pulse-700">Recommended practice</span>
                <h3 className="mt-3 font-display text-xl font-semibold text-ink-900">{featuredQuiz.title}</h3>
                <p className="mt-1 text-sm text-ink-500">{featuredQuiz.questionCount} questions · {featuredQuiz.difficulty} level</p>
                <Link className="mt-4 inline-flex" href={`/quizzes/${featuredQuiz.id}`}><Button>Start practice →</Button></Link>
              </div>
            ) : null}

            {recommendedBlogPool.length > 0 && (
              <div className="mt-8 border-t border-ink-100 pt-7">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">New clinical content</p>
                    <h3 className="mt-1 font-display text-xl font-semibold text-ink-900">Latest from your practice categories</h3>
                  </div>
                  <Link href="/blog" className="text-sm font-semibold text-pulse-600 hover:text-pulse-700">All articles →</Link>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {recommendedBlogPool.map((post) => <CompactBlogPostCard key={post.id} post={post} />)}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Per-category blog sections. The featured latest article above gives the
          homepage an immediate editorial entry point; these sections preserve the full catalogue. */}
      {homepageBlogCategories.length > 0 && (
        <div className="mx-auto max-w-7xl px-6 pt-12">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-ink-100" />
            <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-ink-400">More articles</h2>
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

      {/* Quizzes, one section per top-level quiz category */}
      {categories.map((category) => (
        <div key={category.id}>
          <CategoryFlashcardSection category={category} initialSets={homepageDataFailed ? undefined : homepageData?.flashcardsByCategory?.[category.id] ?? null} />
          <CategoryQuizSection category={category} initialQuizzes={homepageDataFailed ? undefined : homepageData?.quizzesByCategory?.[category.id] ?? null} />
        </div>
      ))}

      {/* General leaderboard */}
      {leaderboardEnabled && (
        <section className="border-y border-ink-100 bg-ink-50/40">
          <div className="mx-auto max-w-3xl px-6 py-14 sm:py-16">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">Community</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-ink-900">{leaderboardLabel}</h2>
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
          <section className="mx-auto max-w-7xl px-6 py-12 sm:py-16">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">Study library</p>
                <h2 className="mt-1 font-display text-2xl font-semibold text-ink-900 sm:text-3xl">Books &amp; past questions</h2>
                <p className="mt-2 text-sm text-ink-500">Extra material for deeper preparation.</p>
              </div>
              <Link href="/resources" className="text-sm font-semibold text-pulse-600 hover:text-pulse-700">See all resources →</Link>
            </div>
            <div className="mt-7 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
              {resources.map((resource) => <ResourceCard key={resource.id} resource={resource} />)}
              {resources.length === 0 && <p className="col-span-full text-sm text-ink-400">No resources yet.</p>}
            </div>
          </section>
        )}

        {/* Jobs */}
        <section className="mx-auto max-w-7xl px-6 py-12 sm:py-16">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">Career</p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-ink-900">Jobs</h2>
              <p className="mt-2 text-sm text-ink-500">Clinical and nursing opportunities curated for students and professionals.</p>
            </div>
            <Link href="/jobs" className="text-sm font-semibold text-pulse-600 hover:text-pulse-700">See more →</Link>
          </div>
          {jobPosts.length > 0 ? (
            <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[3fr_2fr]"><FeaturedBlogPostCard post={jobPosts[0]} />{jobPosts.length > 1 && <div className="divide-y divide-ink-100">{jobPosts.slice(1).map((post) => <CompactBlogPostCard key={post.id} post={post} />)}</div>}</div>
          ) : <p className="mt-6 text-sm text-ink-400">No job listings yet. Check back soon.</p>}
        </section>

        {/* Scholarships */}
        <section className="mx-auto max-w-7xl px-6 py-12 sm:py-16">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">Opportunities</p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-ink-900">Scholarships</h2>
              <p className="mt-2 text-sm text-ink-500">Funding opportunities for nursing and clinical students.</p>
            </div>
            <Link href="/scholarships" className="text-sm font-semibold text-pulse-600 hover:text-pulse-700">See more →</Link>
          </div>
          {scholarshipPosts.length > 0 ? (
            <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[3fr_2fr]"><FeaturedBlogPostCard post={scholarshipPosts[0]} />{scholarshipPosts.length > 1 && <div className="divide-y divide-ink-100">{scholarshipPosts.slice(1).map((post) => <CompactBlogPostCard key={post.id} post={post} />)}</div>}</div>
          ) : <p className="mt-6 text-sm text-ink-400">No scholarships yet. Check back soon.</p>}
        </section>
      </div>

      <AbbreviationsTeaser />
    </div>
  );
}
