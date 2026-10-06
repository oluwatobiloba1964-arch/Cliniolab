'use client';
// File: src/components/layout/ClientUXEnhancements.tsx

import Link from 'next/link';
import { useEffect, useState } from 'react';

const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: '⌂' },
  { href: '/quizzes', label: 'Quizzes', icon: '✓' },
  { href: '/flashcards', label: 'Cards', icon: '▣' },
  { href: '/blog', label: 'Articles', icon: '✎' },
];

export function ClientUXEnhancements() {
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 500);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <nav className="mobile-bottom-nav" aria-label="Quick navigation">
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href}>
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <button
        type="button"
        className={`back-to-top ${showTop ? 'back-to-top-visible' : ''}`}
        aria-label="Back to top"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        ↑
      </button>
    </>
  );
}
