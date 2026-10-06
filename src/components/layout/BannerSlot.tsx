'use client';
// File: src/components/layout/BannerSlot.tsx

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { Banner, BannerPlacement } from '@/types';
import { getSiteWidgets } from '@/lib/client/siteWidgets';

interface BannerSlotProps {
  placement: BannerPlacement;
}

/** Fire-and-forget event beacon — never blocks or throws into the caller. */
function trackBannerEvent(bannerId: string, eventType: 'impression' | 'click') {
  fetch(`/api/banners/${bannerId}/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType }),
    keepalive: true, // lets the request complete even if the user navigates away right after a click
  }).catch(() => {});
}

/**
 * Renders admin-managed CTA/advertising banners.
 * - 'header': a long, full-width strip (goes under the homepage hero).
 * - 'footer': a normal-sized banner (goes above the footer's link grid).
 * Renders nothing if the placement is disabled or has no active banners,
 * so it never leaves an empty gap on the page.
 */
export function BannerSlot({ placement }: BannerSlotProps) {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loaded, setLoaded] = useState(false);
  const trackedImpressions = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    getSiteWidgets()
      .then((data) => {
        const slot = data.banners[placement];
        if (!cancelled) setBanners(slot.enabled ? (slot.banners ?? []) : []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [placement]);

  // Fire one impression event per banner the first time it's actually
  // rendered to the visitor. The ref guards against double-firing from
  // React re-renders (e.g. StrictMode) within the same page load.
  useEffect(() => {
    for (const banner of banners) {
      if (!trackedImpressions.current.has(banner.id)) {
        trackedImpressions.current.add(banner.id);
        trackBannerEvent(banner.id, 'impression');
      }
    }
  }, [banners]);

  if (!loaded || banners.length === 0) return null;

  const sliderBanners = banners.filter((b) => b.displayMode === 'slider');
  const staticBanners = banners.filter((b) => b.displayMode === 'static');

  if (placement === 'header') {
    return (
      <div className="mx-auto max-w-7xl px-6 py-4 space-y-4">
        {sliderBanners.length > 0 && (
          <BannerCarousel banners={sliderBanners} className="aspect-[4/3] w-full sm:aspect-[16/5]" />
        )}
        {staticBanners.map((banner) => (
          <BannerImage key={banner.id} banner={banner} className="aspect-[4/3] w-full sm:aspect-[16/5]" />
        ))}
      </div>
    );
  }

  // Footer banner(s): large and full-width, stacked vertically if there's
  // more than one static banner (no side-by-side grid — a 2-up grid would
  // just make each banner narrower, working against making them bigger).
  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-4">
      {sliderBanners.length > 0 && <BannerCarousel banners={sliderBanners} className="aspect-[4/3] w-full sm:aspect-[16/5]" />}
      {staticBanners.map((banner) => (
        <BannerImage key={banner.id} banner={banner} className="aspect-[4/3] w-full sm:aspect-[16/5]" />
      ))}
    </div>
  );
}

/**
 * Auto-advancing (with manual override) slider for banners the admin has
 * explicitly marked as displayMode: 'slider'. Rendered above the static
 * stacked grid, which independently shows every displayMode: 'static'
 * banner at once.
 */
function BannerCarousel({ banners, className }: { banners: Banner[]; className: string }) {
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-advance every 5s. Restarts whenever `index` changes so a manual
  // click resets the countdown instead of jumping again a moment later.
  // Skipped entirely with only one slide, since there'd be nothing to
  // advance to.
  useEffect(() => {
    if (banners.length <= 1) return;
    timerRef.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [index, banners.length]);

  // Clamp in case the banner list shrinks (e.g. one gets deactivated)
  // while a later slide index was already selected.
  const safeIndex = index % banners.length;
  const current = banners[safeIndex];

  function goTo(next: number) {
    setIndex((next + banners.length) % banners.length);
  }

  const showControls = banners.length > 1;

  return (
    <div className={`relative overflow-hidden rounded-lg border border-ink-100 shadow-sm ${className}`}>
      <BannerImage banner={current} className="h-full w-full" fill />

      {showControls && (
        <>
          <button
            type="button"
            aria-label="Previous banner"
            onClick={() => goTo(safeIndex - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-ink-900/40 p-1.5 text-white hover:bg-ink-900/60"
          >
            <ChevronIcon direction="left" />
          </button>
          <button
            type="button"
            aria-label="Next banner"
            onClick={() => goTo(safeIndex + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-ink-900/40 p-1.5 text-white hover:bg-ink-900/60"
          >
            <ChevronIcon direction="right" />
          </button>

          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
            {banners.map((banner, i) => (
              <button
                key={banner.id}
                type="button"
                aria-label={`Go to banner ${i + 1}`}
                onClick={() => goTo(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === safeIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      {direction === 'left' ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
    </svg>
  );
}

function BannerImage({
  banner,
  className,
  fill,
}: {
  banner: Banner;
  className: string;
  fill?: boolean;
}) {
  const image = (
    <div
      className={
        fill
          ? `relative h-full w-full bg-ink-50 ${className}`
          : `relative overflow-hidden rounded-lg border border-ink-100 bg-ink-50 shadow-sm ${className}`
      }
    >
      <Image src={banner.imagePath} alt={banner.title} fill className="object-contain" unoptimized />
    </div>
  );

  if (banner.linkUrl) {
    const isExternal = /^https?:\/\//.test(banner.linkUrl);
    const handleClick = () => trackBannerEvent(banner.id, 'click');
    return isExternal ? (
      <a href={banner.linkUrl} target="_blank" rel="noopener noreferrer" aria-label={banner.title} onClick={handleClick}>
        {image}
      </a>
    ) : (
      <Link href={banner.linkUrl} aria-label={banner.title} onClick={handleClick}>
        {image}
      </Link>
    );
  }

  return image;
}
