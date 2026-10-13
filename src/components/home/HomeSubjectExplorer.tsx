// src/components/home/HomeSubjectExplorer.tsx
'use client';

import Link from 'next/link';
import type { Category } from '@/types';

export function HomeSubjectExplorer({ categories }: { categories: Category[] }) {
  if (categories.length === 0) return null;

  return (
    <section className="border-y border-ink-100 bg-ink-50/50">
      <div className="mx-auto max-w-7xl px-6 py-12 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">
              Explore by subject
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-ink-900 sm:text-3xl">
              Find your next topic
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500">
              Jump straight into a subject and practise the areas you need most.
            </p>
          </div>
          <Link
            href="/categories"
            className="text-sm font-semibold text-pulse-600 hover:text-pulse-700"
          >
            View all subjects →
          </Link>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {categories.slice(0, 8).map((category, index) => (
            <Link
              key={category.id}
              href={`/categories/group/${category.slug}`}
              className="group rounded-2xl border border-ink-100 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-pulse-200 hover:shadow-md"
            >
              <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-pulse-600">
                0{index + 1}
              </span>
              <h3 className="mt-3 line-clamp-2 font-display text-base font-semibold text-ink-800 group-hover:text-pulse-700">
                {category.name}
              </h3>
              <p className="mt-3 text-xs font-semibold text-ink-400 group-hover:text-pulse-600">
                Explore →
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
