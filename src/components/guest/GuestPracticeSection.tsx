'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Card, DifficultyBadge } from '@/components/ui/Card';
import { usePublicConfig } from '@/lib/hooks/usePublicConfig';
import type { GuestItem } from '@/lib/db/services/guestService';

/**
 * Homepage "Guest Practice" carousel. Auto-advances on a timer and can also
 * be dragged/swiped by hand at any time — a manual swipe pauses autoplay
 * briefly rather than fighting it. Renders nothing while flag is off or
 * there are no guest items, so it never leaves an empty section.
 */
export function GuestPracticeSection() {
  const { flags, guest } = usePublicConfig();
  const [items, setItems] = useState<GuestItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef<number | null>(null);
  const dragDelta = useRef(0);
  const resumeTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!flags.guestPractice) return;
    fetch(`/api/guest/items?limit=${guest.homepageCount}`)
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => setItems(data.items ?? []))
      .catch(() => setItems([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flags.guestPractice, guest.homepageCount]);

  const perView = 3; // visual grouping; CSS below handles responsive overflow
  const count = items?.length ?? 0;

  useEffect(() => {
    if (!guest.autoplay || paused || count <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, Math.max(2, guest.intervalSeconds) * 1000);
    return () => window.clearInterval(id);
  }, [guest.autoplay, guest.intervalSeconds, paused, count]);

  function pauseThenResume() {
    setPaused(true);
    if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => setPaused(false), 6000);
  }

  function goTo(i: number) {
    if (count === 0) return;
    setIndex(((i % count) + count) % count);
    pauseThenResume();
  }

  function onPointerDown(e: React.PointerEvent) {
    dragStartX.current = e.clientX;
    dragDelta.current = 0;
  }
  function onPointerMove(e: React.PointerEvent) {
    if (dragStartX.current === null) return;
    dragDelta.current = e.clientX - dragStartX.current;
  }
  function onPointerUp() {
    if (dragStartX.current === null) return;
    const delta = dragDelta.current;
    dragStartX.current = null;
    if (Math.abs(delta) > 40) {
      goTo(index + (delta < 0 ? 1 : -1));
    } else {
      pauseThenResume();
    }
  }

  if (!flags.guestPractice || items === null || items.length === 0) return null;

  return (
    <section className="border-y border-ink-100 bg-ink-50/40 py-12">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink-800">{guest.sectionTitle}</h2>
            <p className="mt-1 text-sm text-ink-500">{guest.sectionSubtitle}</p>
          </div>
          <Link href="/guest" className="whitespace-nowrap text-sm font-semibold text-pulse-600 hover:underline">
            See more
          </Link>
        </div>

        <div
          ref={trackRef}
          className="mt-6 touch-pan-y select-none overflow-hidden"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => (dragStartX.current = null)}
        >
          <div
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {items.map((item) => (
              <div key={`${item.kind}-${item.id}`} className="w-full shrink-0 px-1.5 sm:w-1/2 lg:w-1/3">
                <GuestItemCard item={item} />
              </div>
            ))}
          </div>
        </div>

        {count > 1 && (
          <div className="mt-4 flex justify-center gap-1.5">
            {items.map((item, i) => (
              <button
                key={`${item.kind}-${item.id}`}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => goTo(i)}
                className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-pulse-500' : 'w-1.5 bg-ink-200'}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

const KIND_LABEL: Record<GuestItem['kind'], string> = {
  quiz: 'Quiz',
  study: 'Study Mode',
  flashcards: 'Flashcards',
};

function GuestItemCard({ item }: { item: GuestItem }) {
  return (
    <Link href={item.href}>
      <Card className="h-full p-5 transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="rounded bg-pulse-50 px-2 py-0.5 text-xs font-semibold text-pulse-600">
            {KIND_LABEL[item.kind]}
          </span>
          {item.difficulty && <DifficultyBadge difficulty={item.difficulty as 'easy' | 'medium' | 'hard'} />}
        </div>
        <h3 className="mt-3 line-clamp-2 font-display text-lg font-semibold text-ink-800">{item.title}</h3>
        <p className="mt-1 text-xs text-ink-400">
          {item.categoryName} · {item.subcategoryName}
        </p>
        <p className="mt-3 text-xs text-ink-500">
          {item.itemCount} {item.kind === 'flashcards' ? 'cards' : 'questions'} · No account needed
        </p>
      </Card>
    </Link>
  );
}
