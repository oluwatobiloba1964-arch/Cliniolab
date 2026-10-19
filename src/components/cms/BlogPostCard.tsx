'use client';

// FILE: src/components/cms/BlogPostCard.tsx

import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { useBlogSubcategoryName } from '@/lib/hooks/useBlogSubcategoryName';
import { useBlogCategorySlug } from '@/lib/hooks/useBlogCategorySlug';
import { ReadingTimePill } from '@/components/blog/ReadingTimePill';
import { resolveImageUrl } from '@/lib/storage/imageUrl';
import type { BlogPost } from '@/types';

const FALLBACK_COVERS: Record<'job' | 'scholarship' | 'default', string> = {
  job: '/job-fallback.svg',
  scholarship: '/scholarship-fallback.svg',
  default: '/blog-fallback.svg',
};

function resolveCoverImage(post: BlogPost, categorySlug: string | null): string {
  if (post.featuredImageUrl) return resolveImageUrl(post.featuredImageUrl);
  if (categorySlug === 'job') return FALLBACK_COVERS.job;
  if (categorySlug === 'scholarship') return FALLBACK_COVERS.scholarship;
  return FALLBACK_COVERS.default;
}

/** Strips HTML/markdown-ish characters and truncates for a listing-card preview. */
function fallbackExcerpt(content: string, length = 140): string {
  const stripped = content.replace(/<[^>]*>/g, ' ').replace(/[#*_>[\]()!-]/g, '').replace(/\s+/g, ' ').trim();
  return stripped.length > length ? `${stripped.slice(0, length).trimEnd()}…` : stripped;
}

/** Large hero-style card for the first/featured post in a section — full-width image, big headline, excerpt. */
export function FeaturedBlogPostCard({ post }: { post: BlogPost }) {
  const excerpt = post.excerpt || fallbackExcerpt(post.content, 200);
  const subcategoryName = useBlogSubcategoryName(post.blogCategoryId, post.blogSubcategoryId);
  const categorySlug = useBlogCategorySlug(post.blogCategoryId);
  return (
    <Link href={`/blog/${post.slug}`}>
      <Card className="overflow-hidden transition-shadow hover:shadow-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolveCoverImage(post, categorySlug)}
          alt=""
          className="h-56 w-full object-cover sm:h-72"
        />
        <div className="p-6">
          <div className="flex flex-wrap items-center gap-2">
            {post.isPinned && (
              <span className="rounded bg-flag-50 px-2 py-0.5 text-xs font-medium text-flag-600">Pinned</span>
            )}
            {post.isSponsored && (
              <span className="rounded bg-pulse-50 px-2 py-0.5 text-xs font-medium text-pulse-600">Sponsored</span>
            )}
            {post.category && (
              <span className="text-xs font-medium text-ink-400">{post.category}</span>
            )}
            {subcategoryName && (
              <span className="rounded bg-ink-50 px-2 py-0.5 text-xs font-medium text-ink-500">
                {subcategoryName}
              </span>
            )}
          </div>
          <h3 className="mt-2 font-display text-2xl font-semibold text-ink-800 sm:text-3xl">{post.title}</h3>
          {excerpt && <p className="mt-2 text-sm text-ink-500">{excerpt}</p>}
          <p className="mt-3 text-xs text-ink-400">{new Date(post.createdAt).toLocaleDateString()}</p>
        </div>
      </Card>
    </Link>
  );
}

/** Small side-list card for non-featured posts — thumbnail + title only, no excerpt. */
export function CompactBlogPostCard({ post }: { post: BlogPost }) {
  const categorySlug = useBlogCategorySlug(post.blogCategoryId);
  return (
    <Link href={`/blog/${post.slug}`}>
      <div className="flex items-start gap-4 py-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolveCoverImage(post, categorySlug)}
          alt=""
          className="h-20 w-28 shrink-0 rounded-md object-cover"
        />
        <div className="min-w-0">
          {post.category && (
            <span className="text-xs font-medium text-ink-400">{post.category}</span>
          )}
          <h4 className="mt-0.5 font-display text-base font-semibold leading-snug text-ink-800">
            {post.title}
          </h4>
          <p className="mt-1 text-xs text-ink-400">{new Date(post.createdAt).toLocaleDateString()}</p>
        </div>
      </div>
    </Link>
  );
}

export function BlogPostCard({ post }: { post: BlogPost }) {
  const excerpt = post.excerpt || fallbackExcerpt(post.content);
  const subcategoryName = useBlogSubcategoryName(post.blogCategoryId, post.blogSubcategoryId);
  const categorySlug = useBlogCategorySlug(post.blogCategoryId);
  return (
    <Link href={`/blog/${post.slug}`}>
      <Card className="overflow-hidden transition-shadow hover:shadow-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolveCoverImage(post, categorySlug)}
          alt=""
          className="h-36 w-full object-cover"
        />
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            {post.isPinned && (
              <span className="rounded bg-flag-50 px-2 py-0.5 text-xs font-medium text-flag-600">Pinned</span>
            )}
            {post.isSponsored && (
              <span className="rounded bg-pulse-50 px-2 py-0.5 text-xs font-medium text-pulse-600">Sponsored</span>
            )}
            {post.category && (
              <span className="text-xs font-medium text-ink-400">{post.category}</span>
            )}
            {subcategoryName && (
              <span className="rounded bg-ink-50 px-2 py-0.5 text-xs font-medium text-ink-500">
                {subcategoryName}
              </span>
            )}
            <ReadingTimePill content={post.content} />
          </div>
          <h3 className="mt-2 font-display text-lg font-semibold text-ink-800">{post.title}</h3>
          {excerpt && <p className="mt-1 text-sm text-ink-500 line-clamp-2">{excerpt}</p>}
          <p className="mt-2 text-xs text-ink-400">{new Date(post.createdAt).toLocaleDateString()}</p>
        </div>
      </Card>
    </Link>
  );
}

