'use client';
// File: src/components/layout/NavBar.tsx

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { SearchAutocomplete } from '@/components/search/SearchAutocomplete';
import { SmartRevisionBadge } from '@/components/layout/SmartRevisionBadge';
import { publicFetchJsonSessionCached } from '@/lib/client/publicFetch';
import { Home, Layers, LayoutDashboard, Search, Menu, X } from 'lucide-react';

interface BlogCategoryOption { id: string; name: string; slug: string; sortOrder: number }

const navLinks = [
  { href: '/categories', label: 'Categories' },
  { href: '/quizzes', label: 'Latest Quizzes' },
  { href: '/flashcards', label: 'Flashcards' },
  { href: '/guest', label: 'Guest Practice' },
  { href: '/offline', label: 'Offline' },
  { href: '/resources', label: 'Resources' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/blog', label: 'Articles' },
];

export function NavBar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [learningOpen, setLearningOpen] = useState(false);
  const [mobileLearningOpen, setMobileLearningOpen] = useState(false);
  const [learningCategories, setLearningCategories] = useState<BlogCategoryOption[]>([]);
  const learningRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    publicFetchJsonSessionCached<{ categories?: BlogCategoryOption[] }>('/api/blog-categories', 300_000)
      .then((data) => setLearningCategories((data.categories ?? []).filter((c) => c.slug !== 'job' && c.slug !== 'scholarship')))
      .catch(() => setLearningCategories([]));
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!learningOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (learningRef.current && !learningRef.current.contains(e.target as Node)) {
        setLearningOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [learningOpen]);

  return (
    <>
    <header className="sticky top-0 z-50 border-b border-ink-100 bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/icon-192.png" alt="Cliniolab logo" width={28} height={28} className="rounded-md" />
          <span className="font-display text-xl font-semibold text-ink-800">Cliniolab</span>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          <div ref={learningRef} className="relative">
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
              <span aria-hidden="true" className={`text-xs transition-transform ${learningOpen ? 'rotate-180' : ''}`}>▾</span>
            </button>
            {learningOpen && learningCategories.length > 0 && (
              <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-ink-100 bg-paper p-2 shadow-lg">
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
          {navLinks.map((link) => {
            const isCurrent = pathname?.startsWith(link.href) ?? false;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isCurrent ? 'page' : undefined}
                className={`text-sm font-medium transition-colors ${
                  isCurrent
                    ? 'text-pulse-600'
                    : 'text-ink-500 hover:text-ink-800'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <ThemeToggle />
          <button
            onClick={() => setSearchOpen((v) => !v)}
            className="text-ink-500 hover:text-ink-800"
            aria-label="Search"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </button>
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="text-sm font-medium text-ink-500 hover:text-ink-800"
              >
                Dashboard
              </Link>
              <Link
                href="/quizzes/bulk-upload"
                className="text-sm font-medium text-ink-500 hover:text-ink-800"
              >
                Upload quizzes
              </Link>
              <Link
                href="/flashcards/bulk-upload"
                className="text-sm font-medium text-ink-500 hover:text-ink-800"
              >
                Upload flashcards
              </Link>
              {(user.role === 'admin' || user.role === 'moderator') && (
                <Link
                  href="/admin"
                  className="text-sm font-medium text-ink-500 hover:text-ink-800"
                >
                  Admin
                </Link>
              )}
              <button
                onClick={() => logout()}
                className="rounded-md bg-ink-800 px-4 py-2 text-sm font-medium text-paper hover:bg-ink-700"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-ink-500 hover:text-ink-800">
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-pulse-500 px-4 py-2 text-sm font-medium text-white hover:bg-pulse-600"
              >
                Sign up
              </Link>
            </>
          )}
        </div>

        <button
          className="lg:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-6 w-6 text-ink-800" aria-hidden="true" /> : <Menu className="h-6 w-6 text-ink-800" aria-hidden="true" />}
        </button>
      </div>

      {searchOpen && (
        <div className="border-t border-ink-100 bg-paper px-4 py-3">
          <div className="mx-auto max-w-7xl">
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
    </header>

      {/* Mobile bottom navigation: PWA-style bar with the four most
          important destinations for a learner on a phone — Home,
          Quizzes, Dashboard, Search. Rendered as a sibling of <header>,
          not a descendant: header has backdrop-blur, and any ancestor
          with a backdrop-filter/transform/filter becomes the containing
          block for position:fixed children, which would trap this bar
          inside header's own (short) box instead of the viewport. */}
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

      {/* Right-side slide-in drawer menu (mobile/tablet, < lg). Also a
          sibling of header for the same containing-block reason above —
          "fixed inset-0" needs to cover the real viewport, not just
          header's ~64px strip. Backdrop closes on click; drawer itself
          stops click-through. */}
      <div
        className={`fixed inset-0 z-50 lg:hidden ${mobileOpen ? '' : 'pointer-events-none'}`}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          tabIndex={mobileOpen ? 0 : -1}
          className={`absolute inset-0 bg-ink-900/40 transition-opacity duration-200 ${
            mobileOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <nav
          aria-label="Mobile menu"
          className={`absolute right-0 top-0 flex h-full w-72 max-w-[85vw] flex-col gap-1 overflow-y-auto border-l border-ink-100 bg-paper px-4 py-4 shadow-xl transition-transform duration-200 ease-out ${
            mobileOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="font-display text-sm font-semibold text-ink-800">Menu</span>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-700 hover:bg-ink-50"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              setSearchOpen(true);
            }}
            className="text-left text-sm font-medium text-ink-600"
          >
            Search
          </button>
          {learningCategories.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setMobileLearningOpen((v) => !v)}
                aria-expanded={mobileLearningOpen}
                className="flex w-full items-center justify-between text-left text-sm font-medium text-ink-600"
              >
                Learning
                <span aria-hidden="true" className={`text-xs transition-transform ${mobileLearningOpen ? 'rotate-180' : ''}`}>▾</span>
              </button>
              {mobileLearningOpen && (
                <div className="mt-2 flex flex-col gap-2 border-l border-ink-100 pl-3">
                  {learningCategories.slice(0, 10).map((c) => (
                    <Link
                      key={c.id}
                      href={`/blog/category/${c.slug}`}
                      onClick={() => setMobileOpen(false)}
                      className="text-sm text-ink-500 hover:text-ink-800"
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="text-sm font-medium text-ink-600"
            >
              {link.label}
            </Link>
          ))}
          {user ? (
            <>
              <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-ink-600">
                Dashboard
              </Link>
              <Link href="/quizzes/bulk-upload" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-ink-600">
                Upload quizzes
              </Link>
              <Link href="/flashcards/bulk-upload" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-ink-600">
                Upload flashcards
              </Link>
              {(user.role === 'admin' || user.role === 'moderator') && (
                <Link href="/admin" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-ink-600">
                  Admin
                </Link>
              )}
              <button
                onClick={() => {
                  setMobileOpen(false);
                  logout();
                }}
                className="text-left text-sm font-medium text-critical-500"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-ink-600">
                Log in
              </Link>
              <Link href="/register" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-pulse-600">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </>
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
