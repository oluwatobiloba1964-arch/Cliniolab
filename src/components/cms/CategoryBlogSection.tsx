'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { publicFetchJson } from '@/lib/client/publicFetch';
import { FeaturedBlogPostCard, CompactBlogPostCard } from '@/components/cms/BlogPostCard';
import type { BlogPost } from '@/types';

interface CategoryBlogSectionProps {
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  initialPosts?: BlogPost[] | null;
}

export function CategoryBlogSection({ categoryId, categorySlug, categoryName, initialPosts }: CategoryBlogSectionProps) {
  const [posts, setPosts] = useState<BlogPost[]>(initialPosts ?? []);

  useEffect(() => {
    if (initialPosts !== undefined) {
      if (initialPosts !== null) setPosts(initialPosts);
      return;
    }
    publicFetchJson<{ posts?: BlogPost[] }>(`/api/blog?categoryId=${encodeURIComponent(categoryId)}&limit=7`, 30_000)
      .then((data) => setPosts(data.posts ?? []))
      .catch(() => setPosts([]));
  }, [categoryId, initialPosts]);

  if (posts.length === 0) return null; // don't show empty category sections

  const [featured, ...rest] = posts;

  return (
    <section className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex items-center justify-between">
        <Link href={`/blog/category/${categorySlug}`} className="group">
          <h2 className="font-display text-2xl font-semibold text-ink-800 group-hover:text-pulse-600">
            {categoryName}
          </h2>
        </Link>
        <Link
          href={`/blog/category/${categorySlug}`}
          className="text-sm font-medium text-pulse-600 hover:text-pulse-700"
        >
          See more →
        </Link>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[3fr_2fr]">
        <FeaturedBlogPostCard post={featured} />
        {rest.length > 0 && (
          <div className="divide-y divide-ink-100">
            {rest.map((post) => (
              <CompactBlogPostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
