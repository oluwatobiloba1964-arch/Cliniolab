'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';

const links = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/flags', label: 'Feature Flags' },
  { href: '/admin/categories', label: 'Categories' },
  { href: '/admin/quizzes', label: 'Quizzes' },
  { href: '/admin/blog', label: 'Blog' },
  { href: '/admin/abbreviations', label: 'Abbreviations' },
  { href: '/admin/clinical-practice', label: 'Clinical Practice' },
  { href: '/admin/resources', label: 'Books & Past Questions' },
  { href: '/admin/pages', label: 'Site Pages' },
  { href: '/admin/homepage-video', label: 'Homepage Video' },
  { href: '/admin/banners', label: 'Banners' },
  { href: '/admin/adsense', label: 'Google AdSense' },
  { href: '/admin/notifications', label: 'Push Notifications' },
  { href: '/admin/daily-quiz', label: 'Daily Quiz' },
  { href: '/admin/related-content', label: 'Related Content' },
  { href: '/admin/leaderboard', label: 'Leaderboard' },
  { href: '/admin/cookie-consent', label: 'Cookie Consent' },
  { href: '/admin/storage', label: 'Storage & Cleanup' },
  { href: '/admin/data-clean', label: 'Data Clean' },
  { href: '/admin/platform-settings', label: 'Guest, Theme & Offline' },
  { href: '/admin/contributors', label: 'Contributors' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/feedback', label: 'Feedback' },
  { href: '/admin/users', label: 'Users' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!loading && (!user || (user.role !== 'admin' && user.role !== 'moderator'))) {
      router.replace('/');
    }
  }, [loading, user, router]);

  // Close the mobile section dropdown whenever the route changes.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  if (loading || !user || (user.role !== 'admin' && user.role !== 'moderator')) return null;

  const activeLabel = links.find((link) => link.href === pathname)?.label ?? 'Admin';

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12 md:flex-row md:gap-8 md:px-6">
      {/* Mobile: collapsible dropdown */}
      <div className="md:hidden">
        <button
          onClick={() => setMobileNavOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-md border border-ink-100 bg-paper px-4 py-3 text-left"
          aria-expanded={mobileNavOpen}
        >
          <span>
            <span className="block text-xs font-medium uppercase tracking-wide text-ink-400">Admin</span>
            <span className="font-display text-base font-semibold text-ink-800">{activeLabel}</span>
          </span>
          <span className={`text-ink-500 transition-transform ${mobileNavOpen ? 'rotate-180' : ''}`}>
            ▾
          </span>
        </button>
        {mobileNavOpen && (
          <nav className="mt-2 rounded-md border border-ink-100 bg-paper p-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block rounded-md px-3 py-2 text-sm font-medium ${
                  pathname === link.href ? 'bg-pulse-50 text-pulse-700' : 'text-ink-600 hover:bg-ink-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {/* Desktop: fixed sidebar */}
      <aside className="hidden w-56 shrink-0 md:block">
        <h2 className="font-display text-lg font-semibold text-ink-800">Admin</h2>
        <nav className="mt-4 space-y-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`block rounded-md px-3 py-2 text-sm font-medium ${
                pathname === link.href ? 'bg-pulse-50 text-pulse-700' : 'text-ink-600 hover:bg-ink-50'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
