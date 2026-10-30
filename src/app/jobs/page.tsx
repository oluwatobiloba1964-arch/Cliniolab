'use client';

import { useEffect, useState } from 'react';
import { BlogPostCard } from '@/components/cms/BlogPostCard';
import { JOB_CATEGORY_SLUG } from '@/lib/constants/blogCategories';
import type { BlogPost } from '@/types';
import { publicFetchJsonLocalCached, PUBLIC_LIST_TTL_MS, PUBLIC_CONFIG_TTL_MS } from '@/lib/client/publicFetch';

export default function JobsPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      publicFetchJsonLocalCached<{ enabled?: boolean }>('/api/flags/jobs_page', PUBLIC_CONFIG_TTL_MS),
      publicFetchJsonLocalCached<{ posts?: BlogPost[] }>(`/api/blog?categorySlug=${JOB_CATEGORY_SLUG}`, PUBLIC_LIST_TTL_MS),
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
        <h1 className="font-display text-2xl font-semibold text-ink-800">Jobs</h1>
        <p className="mt-2 text-ink-500">This page isn&apos;t available right now.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-ink-800">Jobs</h1>
      <p className="mt-2 text-ink-500">
        Health-sciences jobs, internships, and clinical placements, posted directly by the
        Cliniolab team.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <BlogPostCard key={post.id} post={post} />
        ))}
        {posts.length === 0 && (
          <p className="col-span-full text-sm text-ink-400">No job listings yet. Check back soon.</p>
        )}
      </div>
    </div>
  );
}
