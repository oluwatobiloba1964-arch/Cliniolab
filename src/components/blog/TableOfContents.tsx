// src/components/blog/TableOfContents.tsx
'use client';

import { useEffect, useState } from 'react';
import type { TocItem } from '@/lib/utils/tableOfContents';

/**
 * Auto-generated "on this page" navigation for a blog post's <h2>/<h3>
 * headings. Renders as a collapsible block inline with the article on
 * small screens, and as a sticky sidebar alongside the content on large
 * screens (the parent grid in BlogPostClient switches layout for that).
 */
export function TableOfContents({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (items.length === 0) return;
    const headingEls = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    if (headingEls.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the heading closest to the top of the viewport among those
        // currently intersecting, so the highlighted link tracks scroll
        // position without jumping around on fast scrolls.
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '0px 0px -70% 0px', threshold: 0 }
    );
    headingEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  const linkClass = (id: string, level: 2 | 3) =>
    `block truncate text-left transition-colors ${level === 3 ? 'pl-3' : ''} ${
      activeId === id ? 'font-medium text-pulse-500' : 'text-ink-500 hover:text-ink-700'
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
      {/* Small screens: collapsible, inline with the article flow. */}
      <details className="mb-6 rounded-lg border border-ink-100 p-3 lg:hidden">
        <summary className="cursor-pointer text-sm font-medium text-ink-700">On this page</summary>
        <div className="mt-3">{list}</div>
      </details>

      {/* Large screens: sticky sidebar (parent supplies the grid column). */}
      <nav aria-label="Table of contents" className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">On this page</p>
        {list}
      </nav>
    </>
  );
}
