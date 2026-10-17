'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';

const navigationGroups = [
  {
    label: 'Overview',
    links: [{ href: '/admin', label: 'Dashboard' }, { href: '/admin/analytics', label: 'Analytics' }],
  },
  {
    label: 'Learning content',
    links: [
      { href: '/admin/categories', label: 'Categories' },
      { href: '/admin/quizzes', label: 'Quizzes' },
      { href: '/admin/daily-quiz', label: 'Daily Quiz' },
      { href: '/admin/clinical-practice', label: 'Clinical Practice' },
      { href: '/admin/abbreviations', label: 'Abbreviations' },
      { href: '/admin/resources', label: 'Books & Past Questions' },
      { href: '/admin/related-content', label: 'Related Content' },
    ],
  },
  {
    label: 'Website',
    links: [
      { href: '/admin/blog', label: 'Blog' },
      { href: '/admin/pages', label: 'Site Pages' },
      { href: '/admin/homepage-video', label: 'Homepage Video' },
      { href: '/admin/banners', label: 'Banners' },
      { href: '/admin/adsense', label: 'Google AdSense' },
      { href: '/admin/cookie-consent', label: 'Cookie Consent' },
      { href: '/admin/platform-settings', label: 'Guest, Theme & Offline' },
    ],
  },
  {
    label: 'People & engagement',
    links: [
      { href: '/admin/users', label: 'Users' },
      { href: '/admin/contributors', label: 'Contributors' },
      { href: '/admin/scholars', label: 'Scholars' },
      { href: '/admin/leaderboard', label: 'Leaderboard' },
      { href: '/admin/notifications', label: 'Push Notifications' },
      { href: '/admin/reports', label: 'Reports' },
      { href: '/admin/feedback', label: 'Feedback' },
    ],
  },
  {
    label: 'Operations',
    links: [
      { href: '/admin/payments', label: 'Payments' },
      { href: '/admin/flags', label: 'Feature Flags' },
      { href: '/admin/storage', label: 'Storage & Cleanup' },
      { href: '/admin/data-clean', label: 'Data Clean' },
    ],
  },
];

const links = navigationGroups.flatMap((group) => group.links);

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

  const activeLabel =
    links.find((link) => link.href === pathname)?.label ??
    links.find((link) => link.href !== '/admin' && pathname.startsWith(`${link.href}/`))?.label ??
    'Admin';

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12 md:flex-row md:gap-8 md:px-6">
      <div className="min-w-0 flex-1 md:order-2">{children}</div>

      {/* Grouped navigation keeps the long admin menu scannable on every screen. */}
      <div className="order-first md:order-1 md:w-60 md:shrink-0">
        <div className="rounded-2xl border border-ink-100 bg-white p-3 shadow-sm md:sticky md:top-5">
          <div className="mb-3 flex items-center justify-between px-2 py-1">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">Cliniolab</p>
              <h2 className="font-display text-lg font-semibold text-ink-900">Admin workspace</h2>
            </div>
            <span className="rounded-lg bg-pulse-50 px-2 py-1 text-xs font-semibold text-pulse-700">Admin</span>
          </div>

          <button
            onClick={() => setMobileNavOpen((value) => !value)}
            className="flex w-full items-center justify-between rounded-xl border border-ink-100 bg-ink-50 px-3 py-3 text-left md:hidden"
            aria-expanded={mobileNavOpen}
            aria-controls="admin-navigation"
          >
            <span>
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink-400">Current section</span>
              <span className="text-sm font-semibold text-ink-800">{activeLabel}</span>
            </span>
            <span aria-hidden="true" className={`text-ink-500 transition-transform ${mobileNavOpen ? 'rotate-180' : ''}`}>⌄</span>
          </button>

          <nav id="admin-navigation" className={`${mobileNavOpen ? 'mt-3 block' : 'hidden'} space-y-4 md:mt-0 md:block`} aria-label="Admin navigation">
            {navigationGroups.map((group) => (
              <div key={group.label}>
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">{group.label}</p>
                <div className="space-y-0.5">
                  {group.links.map((link) => {
                    const active = pathname === link.href || (link.href !== '/admin' && pathname.startsWith(`${link.href}/`));
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        aria-current={active ? 'page' : undefined}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          active ? 'bg-pulse-50 text-pulse-700' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
                        }`}
                      >
                        {active && <span className="h-1.5 w-1.5 rounded-full bg-pulse-600" aria-hidden="true" />}
                        <span>{link.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
