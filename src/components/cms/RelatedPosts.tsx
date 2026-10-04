'use client';

import { useEffect, useState } from 'react';
import { publicFetchJson } from '@/lib/client/publicFetch';
import { CompactBlogPostCard } from '@/components/cms/BlogPostCard';
import type { BlogPost } from '@/types';

interface RelatedPostsProps {
  /** Endpoint to fetch related posts from, e.g. /api/blog/{slug}/related-posts */
  endpoint: string;
  title?: string;
}

export function RelatedPosts({ endpoint, title = 'Related posts' }: RelatedPostsProps) {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    publicFetchJson<{ posts?: BlogPost[] }>(endpoint, 60_000)
      .then((data) => {
        if (!cancelled) setPosts(data.posts ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  // Render nothing while loading and nothing if there's genuinely no
  // related content, rather than showing an empty section header.
  if (!loaded || posts.length === 0) return null;

  return (
    <div className="mt-10">
      <h2 className="font-display text-xl font-semibold text-ink-800">{title}</h2>
      <div className="mt-4 divide-y divide-ink-100">
        {posts.map((post) => (
          <CompactBlogPostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}
