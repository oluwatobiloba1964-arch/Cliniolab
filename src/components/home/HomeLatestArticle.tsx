// src/components/home/HomeLatestArticle.tsx
'use client';

import Link from 'next/link';
import { FeaturedBlogPostCard } from '@/components/cms/BlogPostCard';
import { JOB_CATEGORY_SLUG, SCHOLARSHIP_CATEGORY_SLUG } from '@/lib/constants/blogCategories';
import type { HomeData, BlogCategoryOption } from '@/lib/hooks/useHomeData';

/**
 * The single most recent published article across all categories except
 * Jobs and Scholarships (those get their own dedicated pages/sections).
 * This restores the "Start with something worth learning" homepage
 * touchpoint that sat right before the quick-study-actions block.
 */
export function HomeLatestArticle({
  blogCategories,
  data,
}: {
  blogCategories: BlogCategoryOption[];
  data: HomeData | null;
}) {
  const allArticles = Object.entries(data?.blogsByCategory ?? {})
    .filter(([categoryId]) => {
      const category = blogCategories.find((c) => c.id === categoryId);
      return !category || (category.slug !== JOB_CATEGORY_SLUG && category.slug !== SCHOLARSHIP_CATEGORY_SLUG);
    })
    .flatMap(([, posts]) => posts)
    .filter((post) => post.status === 'published');

  const latestArticle =
    allArticles
      .slice()
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })[0] ?? null;

  if (!latestArticle) return null;

  return (
    <section className="mx-auto max-w-7xl px-6 py-10 sm:py-14">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pulse-600">
            Latest article
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-ink-900 sm:text-3xl">
            Start with something worth learning
          </h2>
        </div>
        <Link
          href="/blog"
          className="hidden text-sm font-semibold text-pulse-600 hover:text-pulse-700 sm:block"
        >
          View all articles →
        </Link>
      </div>
      <FeaturedBlogPostCard post={latestArticle} />
      <Link
        href="/blog"
        className="mt-4 block text-sm font-semibold text-pulse-600 sm:hidden"
      >
        View all articles →
      </Link>
    </section>
  );
}
