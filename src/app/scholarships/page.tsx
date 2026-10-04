'use client';

import { useEffect, useState } from 'react';
import { BlogPostCard } from '@/components/cms/BlogPostCard';
import { SCHOLARSHIP_CATEGORY_SLUG } from '@/lib/constants/blogCategories';
import type { BlogPost } from '@/types';
import { publicFetchJson } from '@/lib/client/publicFetch';

export default function ScholarshipsPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      publicFetchJson<{ enabled?: boolean }>('/api/flags/scholarships_page', 60_000),
      publicFetchJson<{ posts?: BlogPost[] }>(`/api/blog?categorySlug=${SCHOLARSHIP_CATEGORY_SLUG}`, 60_000),
    ])
      .then(([flag, data]) => {
        setEnabled(flag.enabled !== false);
        setPosts(data.posts ?? []);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (loaded && !enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Scholarships</h1>
        <p className="mt-2 text-ink-500">This page isn&apos;t available right now.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-ink-800">Scholarships</h1>
      <p className="mt-2 text-ink-500">
        Scholarships, grants, and funding opportunities for health-sciences students  -  posted
        directly by the Cliniolab team.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <BlogPostCard key={post.id} post={post} />
        ))}
        {posts.length === 0 && (
          <p className="col-span-full text-sm text-ink-400">No scholarships listed yet  -  check back soon.</p>
        )}
      </div>
    </div>
  );
}
