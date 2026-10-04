'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { publicFetchJson } from '@/lib/client/publicFetch';
import { BlogPostCard } from '@/components/cms/BlogPostCard';
import type { BlogPost } from '@/types';

interface CompactTeaserBlogSectionProps {
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  /** Small emoji/icon shown in the badge, e.g. "💡" for Clinical Pearls, "📝" for Exam Prep Guides. */
  icon: string;
  /** Short one-line description shown under the section heading. */
  tagline: string;
  limit?: number;
  initialPosts?: BlogPost[] | null;
}

/**
 * Section wrapper for Clinical Pearls / Exam Prep Guides  -  same
 * image-forward BlogPostCard used everywhere else on the site, just
 * under a compact icon+tagline header instead of a plain heading, so
 * these sections read as part of the same magazine rather than a
 * separate, image-less reference-card style.
 */
export function CompactTeaserBlogSection({
  categoryId,
  categorySlug,
  categoryName,
  icon,
  tagline,
  limit = 6,
  initialPosts,
}: CompactTeaserBlogSectionProps) {
  const [posts, setPosts] = useState<BlogPost[]>(initialPosts ?? []);

  useEffect(() => {
    if (initialPosts !== undefined) {
      if (initialPosts !== null) setPosts(initialPosts);
      return;
    }
    publicFetchJson<{ posts?: BlogPost[] }>(`/api/blog?categoryId=${encodeURIComponent(categoryId)}&limit=${limit}`, 30_000)
      .then((data) => setPosts(data.posts ?? []))
      .catch(() => setPosts([]));
  }, [categoryId, limit, initialPosts]);

  if (posts.length === 0) return null; // don't show empty sections

  return (
    <section className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex items-center justify-between">
        <Link href={`/blog/category/${categorySlug}`} className="group flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pulse-50 text-lg">
            {icon}
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold text-ink-800 group-hover:text-pulse-600">
              {categoryName}
            </h2>
            <p className="text-xs text-ink-400">{tagline}</p>
          </div>
        </Link>
        <Link
          href={`/blog/category/${categorySlug}`}
          className="shrink-0 text-sm font-medium text-pulse-600 hover:text-pulse-700"
        >
          See more →
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <BlogPostCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}
