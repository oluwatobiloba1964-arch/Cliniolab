// src/app/api/homepage-data/route.ts
import { NextResponse } from 'next/server';
import {
  blogCategoryService,
  categoryService,
  cmsService,
  featureFlagService,
  flashcardService,
  quizService,
  resourceService,
} from '@/lib/db';
import { JOB_CATEGORY_SLUG, SCHOLARSHIP_CATEGORY_SLUG } from '@/lib/constants/blogCategories';
import type { BlogPost, FlashcardSetWithStats, QuizWithStats } from '@/types';

/**
 * Aggregates everything HomeClient used to fetch as one call per homepage
 * section AND one call per quiz category (blog/quiz/flashcard teasers).
 * That fan-out could add up to dozens of Worker/Vercel invocations per
 * homepage load; this route does it all in one invocation, concurrently.
 * Fully public and safe to edge-cache — nothing here is user-specific.
 */
export async function GET(request: Request) {
  // This endpoint is entirely public and contains no user-specific data.
  // Cloudflare's edge cache is the most important protection against repeated
  // homepage loads turning into repeated D1 reads. The browser cache alone
  // only protects a single visitor; the edge cache protects every visitor.
  const cacheStorage = (globalThis as typeof globalThis & {
    caches?: { default?: Cache };
  }).caches;
  const edgeCache = cacheStorage?.default;
  const cacheKey = new Request(new URL(request.url).toString(), { method: 'GET' });

  if (edgeCache) {
    const cached = await edgeCache.match(cacheKey);
    if (cached) return cached;
  }

  const [blogCategories, quizCategories, resourcesEnabled, flashcardsEnabled] = await Promise.all([
    blogCategoryService.listBlogCategories(),
    categoryService.listCategories(),
    featureFlagService.isFeatureEnabled('resources'),
    featureFlagService.isFeatureEnabled('flashcards'),
  ]);

  const jobCategory = blogCategories.find((c) => c.slug === JOB_CATEGORY_SLUG);
  const scholarshipCategory = blogCategories.find((c) => c.slug === SCHOLARSHIP_CATEGORY_SLUG);

  const [resources, latestFlashcards, jobPosts, scholarshipPosts] = await Promise.all([
    resourcesEnabled ? resourceService.listResources(8) : Promise.resolve([]),
    flashcardsEnabled ? flashcardService.listLatestPublicFlashcardSets(6) : Promise.resolve([]),
    jobCategory ? cmsService.getPostsByCategoryId(jobCategory.id, 7) : Promise.resolve([]),
    scholarshipCategory ? cmsService.getPostsByCategoryId(scholarshipCategory.id, 7) : Promise.resolve([]),
  ]);

  const blogsByCategory: Record<string, BlogPost[]> = {};
  const quizzesByCategory: Record<string, QuizWithStats[]> = {};
  const flashcardsByCategory: Record<string, FlashcardSetWithStats[]> = {};

  const [bulkBlogs, bulkQuizzes, bulkFlashcards] = await Promise.all([
    cmsService.getPostsByCategoryIds(blogCategories.map((c) => c.id), 7),
    quizService.listQuizzesByCategories(quizCategories.map((c) => c.id), 7, { includeCommentCount: false }),
    flashcardsEnabled
      ? flashcardService.listFlashcardSetsByCategories(quizCategories.map((c) => c.id), 1)
      : Promise.resolve({} as Record<string, FlashcardSetWithStats[]>),
  ]);

  Object.assign(blogsByCategory, bulkBlogs);
  Object.assign(quizzesByCategory, bulkQuizzes);
  Object.assign(flashcardsByCategory, bulkFlashcards);

  const response = NextResponse.json(
    {
      blogCategories,
      resourcesEnabled,
      resources,
      flashcardsEnabled,
      latestFlashcards,
      jobPosts: jobPosts.slice(0, 7),
      scholarshipPosts: scholarshipPosts.slice(0, 7),
      blogsByCategory,
      quizzesByCategory,
      flashcardsByCategory,
    },
    {
      headers: {
        // Keep the browser cache short, but keep the shared Cloudflare edge
        // copy for 1 hour. This dramatically reduces D1 reads for public
        // homepage traffic while keeping content reasonably fresh. Stale data can
        // continue to be served for up to 24 hours while a fresh copy is rebuilt.
        'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
      },
    }
  );

  if (edgeCache) {
    // Do not await the cache write: the user does not need to wait for the
    // edge copy to be stored before receiving the homepage data.
    void edgeCache.put(cacheKey, response.clone());
  }

  return response;
}
