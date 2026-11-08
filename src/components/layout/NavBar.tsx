'use client';
// File: src/components/layout/NavBar.tsx
//
// Header structure across breakpoints (no overlap on any width):
//
//   < 640px  (sm down)   : logo | hamburger            + bottom-nav PWA bar
//   640-1023 (sm to lg)  : logo | search | compact menu  (collapsed "More" + user)
//   ≥ 1024px  (lg up)    : logo | nav links | right actions (full)
//
// The full set of nav links is only ever shown at lg+. Below that, the
// secondary links (Offline, Resources, Leaderboard, Articles) collapse
// into a "More" dropdown so the bar never overflows or wraps.

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { SearchAutocomplete } from '@/components/search/SearchAutocomplete';
import { SmartRevisionBadge } from '@/components/layout/SmartRevisionBadge';
import { publicFetchJsonSessionCached } from '@/lib/client/publicFetch';
import {
  Home,
  Layers,
  LayoutDashboard,
  Search,
  Menu,
  X,
  ChevronDown,
  MoreHorizontal,
  Upload,
  Shield,
  LogOut,
} from 'lucide-react';

interface BlogCategoryOption { id: string; name: string; slug: string; sortOrder: number }

// Primary links — always shown on desktop (lg+).
const PRIMARY_NAV = [
  { href: '/categories', label: 'Categories' },
  { href: '/quizzes', label: 'Quizzes' },
  { href: '/flashcards', label: 'Flashcards' },
  { href: '/guest', label: 'Guest Practice' },
  { href: '/blog', label: 'Articles' },
] as const;

// Secondary links — collapsed into a "More" dropdown on lg+, hidden on sm/lg.
const SECONDARY_NAV = [
  { href: '/offline', label: 'Offline' },
  { href: '/resources', label: 'Resources' },
  { href: '/leaderboard', label: 'Leaderboard' },
] as const;

export function NavBar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [learningOpen, setLearningOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileLearningOpen, setMobileLearningOpen] = useState(false);
  const [learningCategories, setLearningCategories] = useState<BlogCategoryOption[]>([]);
  const learningRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    publicFetchJsonSessionCached<{ categories?: BlogCategoryOption[] }>('/api/blog-categories', 300_000)
      .then((data) => setLearningCategories((data.categories ?? []).filter((c) => c.slug !== 'job' && c.slug !== 'scholarship')))
      .catch(() => setLearningCategories([]));
  }, []);

  // Close popovers on route change so a navigation never leaves one open.
  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
    setLearningOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  // Outside-click handlers for both desktop popovers.
  useEffect(() => {
    if (!learningOpen && !moreOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (learningRef.current && !learningRef.current.contains(e.target as Node)) {
        setLearningOpen(false);
      }
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [learningOpen, moreOpen]);

  // Lock body scroll when the mobile slide-down menu is open, so the page
  // doesn't scroll behind the overlay.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const isCurrent = (href: string) => (pathname?.startsWith(href) ?? false);

  return (
    <header className="sticky top-0 z-50 border-b border-ink-100 bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        {/* === LEFT: logo (always visible, never shrinks) === */}
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Cliniolab home">
          <Image src="/icon-192.png" alt="Cliniolab logo" width={28} height={28} className="rounded-md" />
          <span className="font-display text-xl font-semibold text-ink-800">Cliniolab</span>
        </Link>

        {/* === CENTER: full nav (lg+ only — 1024px and up) ===
            Primary links + Learning dropdown + More dropdown for secondary
            links. Below lg, this entire block is hidden and a compact
            menu icon takes over. */}
        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-5 lg:flex">
          <div ref={learningRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setLearningOpen((v) => !v)}
              aria-expanded={learningOpen}
              aria-haspopup="true"
              className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                pathname?.startsWith('/blog/category') ? 'text-pulse-600' : 'text-ink-500 hover:text-ink-800'
              }`}
            >
              Learning
              <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 transition-transform ${learningOpen ? 'rotate-180' : ''}`} />
            </button>
            {learningOpen && learningCategories.length > 0 && (
              <div className="absolute left-0 top-full z-50 mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-xl border border-ink-100 bg-paper p-2 shadow-lg">
                {learningCategories.slice(0, 10).map((c) => (
                  <Link
                    key={c.id}
                    href={`/blog/category/${c.slug}`}
                    onClick={() => setLearningOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {PRIMARY_NAV.map((link) => {
            const current = isCurrent(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current ? 'page' : undefined}
                className={`shrink-0 text-sm font-medium transition-colors ${
                  current ? 'text-pulse-600' : 'text-ink-500 hover:text-ink-800'
                }`}
              >
                {link.label}
              </Link>
            );
          })}

          {/* More dropdown — secondary links collapsed here so the bar
              never overflows on lg screens. */}
          <div ref={moreRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              aria-haspopup="true"
              aria-label="More navigation"
              className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                SECONDARY_NAV.some((l) => isCurrent(l.href)) ? 'text-pulse-600' : 'text-ink-500 hover:text-ink-800'
              }`}
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only sm:ml-0.5">More</span>
              <ChevronDown aria-hidden="true" className={`h-3 w-3 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-48 max-w-[calc(100vw-2rem)] rounded-xl border border-ink-100 bg-paper p-2 shadow-lg">
                {SECONDARY_NAV.map((link) => {
                  const current = isCurrent(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMoreOpen(false)}
                      aria-current={current ? 'page' : undefined}
                      className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-ink-50 hover:text-ink-900 ${
                        current ? 'text-pulse-600' : 'text-ink-600'
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* === RIGHT: actions (split into lg+ full and sm-to-lg compact) ===

            At lg+, show ThemeToggle + Search + Dashboard + Upload + (Admin) + Log out
            (or ThemeToggle + Search + Log in + Sign up when logged out).
            Upload and Admin are icon-only at lg to save horizontal space.

            At sm-to-lg (640-1023), show ThemeToggle + Search + hamburger icon.
            The hamburger opens the same slide-down menu as the < sm mobile
            breakpoint, so we don't duplicate the menu code. */}
        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          <button
            onClick={() => setSearchOpen((v) => !v)}
            className="text-ink-500 hover:text-ink-800"
            aria-label="Search"
            aria-expanded={searchOpen}
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </button>
          {user ? (
            <>
              <Link
                href="/dashboard"
                aria-current={isCurrent('/dashboard') ? 'page' : undefined}
                className="text-sm font-medium text-ink-500 hover:text-ink-800"
              >
                Dashboard
              </Link>
              <Link
                href="/quizzes/bulk-upload"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-800"
                aria-label="Upload quizzes"
                title="Upload quizzes"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/flashcards/bulk-upload"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-800"
                aria-label="Upload flashcards"
                title="Upload flashcards"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
              </Link>
              {(user.role === 'admin' || user.role === 'moderator') && (
                <Link
                  href="/admin"
                  aria-current={isCurrent('/admin') ? 'page' : undefined}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-800"
                  aria-label="Admin"
                  title="Admin"
                >
                  <Shield className="h-4 w-4" aria-hidden="true" />
                </Link>
              )}
              <button
                onClick={() => logout()}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-ink-800 px-3 text-sm font-medium text-paper transition-colors hover:bg-ink-700"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span className="hidden xl:inline">Log out</span>
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-ink-500 hover:text-ink-800">
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-pulse-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pulse-600"
              >
                Sign up
              </Link>
            </>
          )}
        </div>

        {/* Compact right cluster for sm-to-lg: theme + menu icon only.
            Search lives in the bottom nav at these widths, so we don't
            duplicate it here. Hidden below sm (those widths use only
            logo + hamburger — bottom nav handles everything else). */}
        <div className="hidden items-center gap-2 sm:flex lg:hidden">
          <ThemeToggle />
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-700 transition-colors hover:bg-ink-50"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>

        {/* Smallest screens (below sm): just a hamburger, no theme/search
            icons in the top bar (search lives in the bottom nav). */}
        <button
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-700 transition-colors hover:bg-ink-50 sm:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>

      {/* === Search bar (slides down, max-width clamped so it never
              overflows on small screens) === */}
      {searchOpen && (
        <div className="border-t border-ink-100 bg-paper px-4 py-3">
          <div className="mx-auto max-w-3xl">
            <SearchAutocomplete
              value={searchQuery}
              onChange={setSearchQuery}
              onSubmit={() => {
                setSearchOpen(false);
                setSearchQuery('');
              }}
              placeholder="Search quizzes, articles, resources…"
              compact
              className="overflow-visible"
              inputClassName="rounded-l-md border border-ink-100"
            />
          </div>
        </div>
      )}

      {/* === Mobile slide-down menu (covers sm-to-lg and < sm) ===
          Locked body scroll while open so the page doesn't scroll
          behind it. Each link closes the menu on tap. */}
      {mobileOpen && (
        <>
          {/* Click-away backdrop */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 top-16 z-40 cursor-default bg-ink-900/20 lg:hidden"
            tabIndex={-1}
          />
          <nav
            className="absolute left-0 right-0 top-16 z-50 max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-ink-100 bg-paper px-4 py-4 shadow-lg lg:hidden"
            aria-label="Mobile menu"
          >
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  setSearchOpen(true);
                }}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-ink-600 hover:bg-ink-50"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                Search
              </button>
              {learningCategories.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setMobileLearningOpen((v) => !v)}
                    aria-expanded={mobileLearningOpen}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium text-ink-600 hover:bg-ink-50"
                  >
                    <span className="flex items-center gap-2">
                      <Layers className="h-4 w-4" aria-hidden="true" />
                      Learning
                    </span>
                    <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${mobileLearningOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {mobileLearningOpen && (
                    <div className="mt-1 flex flex-col gap-0.5 border-l border-ink-100 pl-3">
                      {learningCategories.slice(0, 10).map((c) => (
                        <Link
                          key={c.id}
                          href={`/blog/category/${c.slug}`}
                          onClick={() => setMobileOpen(false)}
                          className="rounded-lg px-3 py-2 text-sm text-ink-500 hover:bg-ink-50 hover:text-ink-800"
                        >
                          {c.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="my-1 h-px bg-ink-100" aria-hidden="true" />
              {PRIMARY_NAV.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={isCurrent(link.href) ? 'page' : undefined}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-ink-50 ${
                    isCurrent(link.href) ? 'bg-pulse-50 text-pulse-700' : 'text-ink-600'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {SECONDARY_NAV.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={isCurrent(link.href) ? 'page' : undefined}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-ink-50 ${
                    isCurrent(link.href) ? 'bg-pulse-50 text-pulse-700' : 'text-ink-600'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="my-1 h-px bg-ink-100" aria-hidden="true" />
              {user ? (
                <>
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileOpen(false)}
                    aria-current={isCurrent('/dashboard') ? 'page' : undefined}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50"
                  >
                    <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                    Dashboard
                  </Link>
                  <Link
                    href="/quizzes/bulk-upload"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50"
                  >
                    <Upload className="h-4 w-4" aria-hidden="true" />
                    Upload quizzes
                  </Link>
                  <Link
                    href="/flashcards/bulk-upload"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50"
                  >
                    <Upload className="h-4 w-4" aria-hidden="true" />
                    Upload flashcards
                  </Link>
                  {(user.role === 'admin' || user.role === 'moderator') && (
                    <Link
                      href="/admin"
                      onClick={() => setMobileOpen(false)}
                      aria-current={isCurrent('/admin') ? 'page' : undefined}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50"
                    >
                      <Shield className="h-4 w-4" aria-hidden="true" />
                      Admin
                    </Link>
                  )}
                  <button
                    onClick={() => {
                      setMobileOpen(false);
                      logout();
                    }}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-critical-500 hover:bg-critical-50"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Log out
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-2 px-3 pt-2">
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg border border-ink-200 px-4 py-2 text-center text-sm font-medium text-ink-700 hover:bg-ink-50"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg bg-pulse-500 px-4 py-2 text-center text-sm font-medium text-white hover:bg-pulse-600"
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </>
      )}

      {/* === Mobile bottom navigation: PWA-style bar with the four most
          important destinations for a learner on a phone — Home,
          Quizzes, Dashboard, Search. Visible on every screen below lg
          (1024px). At lg+, the full desktop nav takes over and the
          bottom bar is hidden. This is the primary mobile navigation —
          it is intentionally NOT hidden at sm or md. */}
      <nav
        aria-label="Mobile primary"
        className="cliniolab-mobile-bottom-nav fixed bottom-0 left-0 right-0 z-40 flex items-stretch justify-around border-t border-ink-100 bg-paper/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <BottomNavItem href="/" label="Home" icon={<Home className="h-5 w-5" aria-hidden="true" />} pathname={pathname} exactMatch />
        <BottomNavItem href="/quizzes" label="Quizzes" icon={<Layers className="h-5 w-5" aria-hidden="true" />} pathname={pathname} badge={<SmartRevisionBadge />} />
        <BottomNavItem href={user ? '/dashboard' : '/login'} label={user ? 'Dashboard' : 'Log in'} icon={<LayoutDashboard className="h-5 w-5" aria-hidden="true" />} pathname={pathname} />
        <button
          type="button"
          onClick={() => setSearchOpen((v) => !v)}
          aria-label="Search"
          aria-expanded={searchOpen}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold text-ink-500 transition hover:text-pulse-600"
        >
          <Search className={`h-5 w-5 ${searchOpen ? 'text-pulse-600' : ''}`} aria-hidden="true" />
          <span>Search</span>
        </button>
      </nav>
    </header>
  );
}

type BottomNavItemProps = {
  href: string;
  label: string;
  icon: ReactNode;
  pathname: string | null;
  exactMatch?: boolean;
  badge?: ReactNode;
};

function BottomNavItem({ href, label, icon, pathname, exactMatch, badge }: BottomNavItemProps) {
  const isCurrent = exactMatch
    ? pathname === href
    : (pathname?.startsWith(href) ?? false);
  return (
    <Link
      href={href}
      aria-current={isCurrent ? 'page' : undefined}
      className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition ${
        isCurrent ? 'text-pulse-600' : 'text-ink-500 hover:text-pulse-600'
      }`}
    >
      <span className="relative">
        {icon}
        {badge && <span className="absolute -right-2 -top-1">{badge}</span>}
      </span>
      <span>{label}</span>
    </Link>
  );
}
