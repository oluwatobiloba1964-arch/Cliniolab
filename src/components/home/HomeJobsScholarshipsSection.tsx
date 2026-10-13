// src/components/home/HomeJobsScholarshipsSection.tsx
'use client';

import Link from 'next/link';
import { FeaturedBlogPostCard, CompactBlogPostCard } from '@/components/cms/BlogPostCard';
import type { HomeData } from '@/lib/hooks/useHomeData';

export function HomeJobsScholarshipsSection({ data }: { data: HomeData | null }) {
  const jobPosts = data?.jobPosts ?? [];
  const scholarshipPosts = data?.scholarshipPosts ?? [];

  return (
    <>
      <section className="mx-auto max-w-7xl px-6 py-12 sm:py-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">
              Career
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-ink-900">Jobs</h2>
            <p className="mt-2 text-sm text-ink-500">
              Clinical and nursing opportunities curated for students and professionals.
            </p>
          </div>
          <Link
            href="/jobs"
            className="text-sm font-semibold text-pulse-600 hover:text-pulse-700"
          >
            See more →
          </Link>
        </div>
        {jobPosts.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[3fr_2fr]">
            <FeaturedBlogPostCard post={jobPosts[0]} />
            {jobPosts.length > 1 && (
              <div className="divide-y divide-ink-100">
                {jobPosts.slice(1).map((post) => (
                  <CompactBlogPostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="mt-6 text-sm text-ink-400">No job listings yet. Check back soon.</p>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12 sm:py-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">
              Opportunities
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-ink-900">
              Scholarships
            </h2>
            <p className="mt-2 text-sm text-ink-500">
              Funding opportunities for nursing and clinical students.
            </p>
          </div>
          <Link
            href="/scholarships"
            className="text-sm font-semibold text-pulse-600 hover:text-pulse-700"
          >
            See more →
          </Link>
        </div>
        {scholarshipPosts.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[3fr_2fr]">
            <FeaturedBlogPostCard post={scholarshipPosts[0]} />
            {scholarshipPosts.length > 1 && (
              <div className="divide-y divide-ink-100">
                {scholarshipPosts.slice(1).map((post) => (
                  <CompactBlogPostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="mt-6 text-sm text-ink-400">No scholarships yet. Check back soon.</p>
        )}
      </section>
    </>
  );
}
