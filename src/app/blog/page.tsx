// src/app/blog/page.tsx
import Link from 'next/link';
import { BlogPostCard } from '@/components/cms/BlogPostCard';
import { cmsService, blogCategoryService } from '@/lib/db';

// Revalidate periodically so new posts show up without a full redeploy,
// while still shipping pre-rendered HTML (fast first load, crawlable by
// Googlebot/AdSense without waiting on client-side JS).
export const revalidate = 300; // 5 minutes

export default async function BlogPage() {
  const [posts, blogCategories] = await Promise.all([
    cmsService.listPublishedPosts(),
    blogCategoryService.listBlogCategories(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-ink-800">Blog</h1>
      <p className="mt-2 text-ink-500">
        Clinical tips, exam prep guidance, and news for nursing and clinical students.
      </p>

      {/* Category pills navigate to that category's dedicated page. */}
      <div className="mt-6 flex flex-wrap gap-2">
        {blogCategories.map((c) => (
          <Link
            key={c.id}
            href={`/blog/category/${c.slug}`}
            className="rounded-full bg-ink-50 px-3 py-1.5 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-100"
          >
            {c.name}
          </Link>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {posts.map((post) => (
          <BlogPostCard key={post.id} post={post} />
        ))}
        {posts.length === 0 && (
          <p className="col-span-full text-sm text-ink-400">No posts yet.</p>
        )}
      </div>
    </div>
  );
}
