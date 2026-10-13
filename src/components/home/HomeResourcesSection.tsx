// src/components/home/HomeResourcesSection.tsx
'use client';

import Link from 'next/link';
import { ResourceCard } from '@/components/resources/ResourceCard';
import type { HomeData } from '@/lib/hooks/useHomeData';

export function HomeResourcesSection({ data }: { data: HomeData | null }) {
  if (!data?.resourcesEnabled) return null;

  return (
    <section className="mx-auto max-w-7xl px-6 py-12 sm:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">
            Study library
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-ink-900 sm:text-3xl">
            Books &amp; past questions
          </h2>
          <p className="mt-2 text-sm text-ink-500">Extra material for deeper preparation.</p>
        </div>
        <Link
          href="/resources"
          className="text-sm font-semibold text-pulse-600 hover:text-pulse-700"
        >
          See all resources →
        </Link>
      </div>
      <div className="mt-7 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
        {(data.resources ?? []).map((resource) => (
          <ResourceCard key={resource.id} resource={resource} />
        ))}
        {data.resources.length === 0 && (
          <p className="col-span-full text-sm text-ink-400">No resources yet.</p>
        )}
      </div>
    </section>
  );
}
