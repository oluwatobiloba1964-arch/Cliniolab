'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FeaturedFlashcardSetCard } from '@/components/flashcards/FlashcardSetCard';
import type { Category, FlashcardSetWithStats } from '@/types';

/** Sits inside each category's homepage block, labelled "Flashcard", right alongside that category's quiz section. */
export function CategoryFlashcardSection({ category, initialSets }: { category: Category; initialSets?: FlashcardSetWithStats[] | null }) {
  const [sets, setSets] = useState<FlashcardSetWithStats[]>(initialSets ?? []);

  useEffect(() => {
    if (initialSets !== undefined) {
      if (initialSets !== null) setSets(initialSets);
      return;
    }
    fetch(`/api/flashcards?categoryId=${category.id}&limit=1`)
      .then((res) => res.json())
      .then((data) => setSets(data.sets ?? []));
  }, [category.id, initialSets]);

  if (sets.length === 0) return null;

  const featured = sets[0];

  return (
    <section className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-ink-800">
          {category.name} <span className="text-pulse-600">· Flashcard</span>
        </h2>
        <Link
          href={`/categories/group/${category.slug}?tab=flashcards`}
          className="text-sm font-medium text-pulse-600 hover:text-pulse-700"
        >
          See more →
        </Link>
      </div>
      <div className="mt-6">
        <FeaturedFlashcardSetCard set={featured} />
      </div>
    </section>
  );
}
