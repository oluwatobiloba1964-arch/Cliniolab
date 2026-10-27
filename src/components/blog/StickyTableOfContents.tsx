// src/components/blog/StickyTableOfContents.tsx
'use client';

/**
 * Feature #15 - Enhanced sticky scroll-spy table of contents.
 *
 * Wraps the existing TableOfContents behavior with:
 *   - sticky position that survives long scrolls on desktop
 *   - scroll progress bar showing reading position in the article
 *   - active section highlight (already present, kept)
 *   - collapsible on mobile (kept from the original)
 *
 * Pure client-side. No DB, no API. Reads heading elements from the DOM.
 */
import { useEffect, useState } from 'react';
import type { TocItem } from '@/lib/utils/tableOfContents';

interface StickyTableOfContentsProps {
  items: TocItem[];
  /** CSS selector for the article container (used to compute scroll progress). */
  articleSelector?: string;
}

export function StickyTableOfContents({
  items,
  articleSelector = 'article',
}: StickyTableOfContentsProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (items.length === 0) return;

    const headingEls = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    if (headingEls.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '0px 0px -70% 0px', threshold: 0 },
    );
    headingEls.forEach((el) => observer.observe(el));

    // Reading progress
    const onScroll = () => {
      const article = document.querySelector(articleSelector);
      if (!article) return;
      const rect = article.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const scrolled = Math.max(0, -rect.top);
      const pct = total > 0 ? Math.min(100, Math.max(0, (scrolled / total) * 100)) : 0;
      setProgress(Math.round(pct));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [items, articleSelector]);

  if (items.length === 0) return null;

  const linkClass = (id: string, level: 2 | 3) =>
    `block truncate text-left transition-colors ${level === 3 ? 'pl-3' : ''} ${
      activeId === id ? 'font-medium text-pulse-600' : 'text-ink-500 hover:text-ink-700'
    }`;

  const list = (
    <ul className="space-y-1.5 text-sm">
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            className={linkClass(item.id, item.level)}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              setActiveId(item.id);
            }}
          >
            {item.text}
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      {/* Mobile: collapsible inline */}
      <details className="mb-6 rounded-lg border border-ink-100 p-3 lg:hidden">
        <summary className="cursor-pointer text-sm font-medium text-ink-700">
          On this page · {progress}% read
        </summary>
        <div className="mt-3">
          <div className="mb-3 h-1 overflow-hidden rounded-full bg-ink-100">
            <div className="h-full bg-pulse-500 transition-all duration-200" style={{ width: `${progress}%` }} />
          </div>
          {list}
        </div>
      </details>

      {/* Desktop: sticky sidebar with progress bar */}
      <nav
        aria-label="Table of contents"
        className="hidden lg:sticky lg:top-24 lg:block lg:self-start"
      >
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">On this page</p>
          <span className="font-mono text-[10px] text-ink-400">{progress}%</span>
        </div>
        <div className="mb-3 h-1 overflow-hidden rounded-full bg-ink-100">
          <div className="h-full bg-pulse-500 transition-all duration-200" style={{ width: `${progress}%` }} />
        </div>
        {list}
      </nav>
    </>
  );
}
