'use client';

import { PageTools } from '@/components/layout/PageTools';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { BlogPostCard } from '@/components/cms/BlogPostCard';
import type { BlogPost } from '@/types';

interface BlogCategoryOption { id: string; name: string; slug: string; sortOrder: number }
interface BlogSubcategoryOption { id: string; blogCategoryId: string; name: string; slug: string; sortOrder: number }

export default function BlogCategoryPage() {
  const params = useParams<{ category: string }>();
  const categorySlug = decodeURIComponent(params.category);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState(categorySlug);
  const [subcategories, setSubcategories] = useState<BlogSubcategoryOption[]>([]);
  // null = "All" (no subcategory filter) — the default, always shown first.
  const [activeSubcategoryId, setActiveSubcategoryId] = useState<string | null>(null);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  // Resolve the category slug to its id/name once, then load that
  // category's subcategories so the nav bar is available immediately —
  // it doesn't depend on which subcategory (if any) ends up selected.
  useEffect(() => {
    fetch('/api/blog-categories')
      .then((res) => res.json())
      .then((data) => {
        const match = (data.categories ?? []).find((c: BlogCategoryOption) => c.slug === categorySlug);
        if (match) {
          setCategoryName(match.name);
          setCategoryId(match.id);
        }
      });
    setActiveSubcategoryId(null);
  }, [categorySlug]);

  useEffect(() => {
    if (!categoryId) return;
    fetch(`/api/blog-subcategories?categoryId=${encodeURIComponent(categoryId)}`)
      .then((res) => res.json())
      .then((data) => setSubcategories(data.subcategories ?? []))
      .catch(() => setSubcategories([]));
  }, [categoryId]);

  // Reload posts whenever the category or the active subcategory filter
  // changes. Subcategory takes precedence when set.
  useEffect(() => {
    setPostsLoading(true);
    const url = activeSubcategoryId
      ? `/api/blog?subcategoryId=${encodeURIComponent(activeSubcategoryId)}`
      : `/api/blog?categorySlug=${encodeURIComponent(categorySlug)}`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => setPosts(data.posts ?? []))
      .finally(() => setPostsLoading(false));
  }, [categorySlug, activeSubcategoryId]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <PageTools reading />
      <h1 className="font-display text-3xl font-semibold text-ink-800">{categoryName}</h1>

      {/* Subcategory nav — pinned right under the heading, above the post
          grid, so switching subcategories never requires scrolling back
          up past a full row of posts to find it again. */}
      {subcategories.length > 0 && (
        <div className="sticky top-0 z-10 -mx-6 mt-6 border-b border-ink-100 bg-white/95 px-6 py-3 backdrop-blur">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveSubcategoryId(null)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                activeSubcategoryId === null
                  ? 'border-pulse-400 bg-pulse-50 text-pulse-700'
                  : 'border-ink-100 text-ink-600 hover:bg-ink-50'
              }`}
            >
              All
            </button>
            {subcategories.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => setActiveSubcategoryId(sub.id)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeSubcategoryId === sub.id
                    ? 'border-pulse-400 bg-pulse-50 text-pulse-700'
                    : 'border-ink-100 text-ink-600 hover:bg-ink-50'
                }`}
              >
                {sub.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {postsLoading && (
          <p className="col-span-full text-sm text-ink-400">Loading…</p>
        )}
        {!postsLoading &&
          posts.map((post) => <BlogPostCard key={post.id} post={post} />)}
        {!postsLoading && posts.length === 0 && (
          <p className="col-span-full text-sm text-ink-400">
            No posts {activeSubcategoryId ? 'in this subcategory' : 'in this category'} yet.
          </p>
        )}
      </div>
    </div>
  );
}
