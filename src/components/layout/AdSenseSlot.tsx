// src/components/layout/AdSenseSlot.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Routes where ads must never show:
 * - /admin/*                    admin panel
 * - /dashboard/*                logged-in user's own account area
 * - /login, /register           auth forms — avoid distracting/low-value ads here
 * - /quizzes/new                quiz creation
 * - /quizzes/bulk-upload        quiz creation (bulk)
 * - /quizzes/[quizId]/edit      quiz editing
 * - /quizzes/[quizId]           this is also where a user actually
 *                               practices/takes the quiz (same route
 *                               renders the runner), so it's excluded
 *                               here too
 * - /quizzes/shared/[slug]      practicing a quiz via a shared link
 *
 * Everywhere else (homepage, blog, categories, the quizzes listing,
 * leaderboard, etc.) is fair game.
 */
function isBlockedPath(pathname: string | null): boolean {
  if (!pathname) return true;
  if (pathname.startsWith('/admin')) return true;
  if (pathname.startsWith('/dashboard')) return true;
  if (pathname === '/login' || pathname === '/register') return true;
  if (pathname === '/quizzes/new') return true;
  if (pathname === '/quizzes/bulk-upload') return true;
  if (pathname.startsWith('/quizzes/shared/')) return true;
  if (/^\/quizzes\/edit(\/|$)/.test(pathname)) return true;
  // /quizzes/[quizId] and /quizzes/[quizId]/edit — anything directly
  // under /quizzes/ that isn't the bare listing page or purchase-success.
  if (/^\/quizzes\/[^/]+/.test(pathname) && pathname !== '/quizzes/purchase-success') return true;
  // Guest Practice: quiz/study/flashcard runners, same reasoning as the
  // logged-in quiz runner above. The /guest hub listing page is fine.
  if (/^\/guest\/(quiz|flashcards)\//.test(pathname)) return true;
  // Offline runner: takes over the whole page like a quiz runner does.
  if (pathname === '/offline') return true;
  return false;
}

interface AdSenseSlotProps {
  className?: string;
  /** A stable ad unit slot id from AdSense, once you've created one. */
  slot?: string;
}

export function AdSenseSlot({ className, slot }: AdSenseSlotProps) {
  const pathname = usePathname();
  const [config, setConfig] = useState<{ enabled: boolean; clientId: string } | null>(null);
  const pushed = useRef(false);

  useEffect(() => {
    fetch('/api/adsense-config')
      .then((res) => res.json())
      .then((data) => setConfig({ enabled: !!data.enabled, clientId: data.clientId ?? '' }))
      .catch(() => setConfig({ enabled: false, clientId: '' }));
  }, []);

  useEffect(() => {
    if (!config?.enabled || !config.clientId || !slot || isBlockedPath(pathname)) return;
    if (pushed.current) return;
    try {
      // @ts-expect-error adsbygoogle is injected by the AdSense script
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense script may not be ready yet on this render — safe to skip.
    }
  }, [config, pathname, slot]);

  if (!config || !config.enabled || !config.clientId || isBlockedPath(pathname)) return null;

  // Without a slot id yet (before ad units are created in AdSense),
  // render nothing rather than an empty/broken <ins> tag.
  if (!slot) return null;

  return (
    <div className={className}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={config.clientId}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
