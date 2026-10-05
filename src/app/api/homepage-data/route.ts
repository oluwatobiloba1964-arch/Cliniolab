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
export async function GET() {
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
    quizService.listQuizzesByCategories(quizCategories.map((c) => c.id), 7),
    flashcardsEnabled
      ? flashcardService.listFlashcardSetsByCategories(quizCategories.map((c) => c.id), 1)
      : Promise.resolve({} as Record<string, FlashcardSetWithStats[]>),
  ]);

  Object.assign(blogsByCategory, bulkBlogs);
  Object.assign(quizzesByCategory, bulkQuizzes);
  Object.assign(flashcardsByCategory, bulkFlashcards);

  return NextResponse.json(
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
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' } }
  );
}
