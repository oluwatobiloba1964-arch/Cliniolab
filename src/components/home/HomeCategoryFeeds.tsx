// src/components/home/HomeCategoryFeeds.tsx
'use client';

import { CategoryBlogSection } from '@/components/cms/CategoryBlogSection';
import { CategoryQuizSection } from '@/components/quiz/CategoryQuizSection';
import { CategoryFlashcardSection } from '@/components/flashcards/CategoryFlashcardSection';
import {
  JOB_CATEGORY_SLUG,
  SCHOLARSHIP_CATEGORY_SLUG,
  CLINICAL_PEARLS_CATEGORY_SLUG,
  EXAM_PREP_GUIDES_CATEGORY_SLUG,
} from '@/lib/constants/blogCategories';
import type { HomeData, BlogCategoryOption } from '@/lib/hooks/useHomeData';
import type { Category } from '@/types';

// Job/Scholarship get their own dedicated pages instead of a homepage
// section, and Clinical Pearls/Exam Prep Guides already get their own
// compact-card teaser section higher up on the page (see HomeClient) —
// so all four are excluded here to avoid showing the same category twice.
const HOMEPAGE_EXCLUDED_SLUGS = new Set([
  JOB_CATEGORY_SLUG,
  SCHOLARSHIP_CATEGORY_SLUG,
  CLINICAL_PEARLS_CATEGORY_SLUG,
  EXAM_PREP_GUIDES_CATEGORY_SLUG,
]);

interface HomeCategoryFeedsProps {
  categories: Category[];
  blogCategories: BlogCategoryOption[];
  data: HomeData | null;
  failed: boolean;
}

/**
 * The long per-category map (blog sections + flashcard/quiz blocks) that
 * was previously inline in HomeClient. Isolating it keeps HomeClient a
 * short orchestrator and makes the "which categories show where" rule a
 * single, reviewable unit.
 */
export function HomeCategoryFeeds({
  categories,
  blogCategories,
  data,
  failed,
}: HomeCategoryFeedsProps) {
  const visibleBlogCategories = blogCategories.filter(
    (c) => !HOMEPAGE_EXCLUDED_SLUGS.has(c.slug)
  );

  return (
    <>
      {visibleBlogCategories.length > 0 && (
        <div className="mx-auto max-w-7xl px-6 pt-12">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-ink-100" />
            <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-ink-400">
              More articles
            </h2>
            <div className="h-px flex-1 bg-ink-100" />
          </div>
        </div>
      )}

      {visibleBlogCategories.map((category) => (
        <CategoryBlogSection
          key={category.id}
          categoryId={category.id}
          categorySlug={category.slug}
          categoryName={category.name}
          initialPosts={failed ? undefined : data?.blogsByCategory?.[category.id] ?? null}
        />
      ))}

      {categories.map((category) => (
        <div key={category.id}>
          <CategoryFlashcardSection
            category={category}
            initialSets={failed ? undefined : data?.flashcardsByCategory?.[category.id] ?? null}
          />
          <CategoryQuizSection
            category={category}
            initialQuizzes={failed ? undefined : data?.quizzesByCategory?.[category.id] ?? null}
          />
        </div>
      ))}
    </>
  );
}
