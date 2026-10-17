'use client';
// File: src/components/layout/NavBar.tsx

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { SearchAutocomplete } from '@/components/search/SearchAutocomplete';
import { publicFetchJson } from '@/lib/client/publicFetch';

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
    publicFetchJson<{ categories?: BlogCategoryOption[] }>('/api/blog-categories', 300_000)
      .then((data) => setLearningCategories((data.categories ?? []).filter((c) => c.slug !== 'job' && c.slug !== 'scholarship')))
      .catch(() => setLearningCategories([]));
  }, []);

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
    <header className="sticky top-0 z-50 border-b border-ink-100 bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/icon-192.png" alt="" width={28} height={28} className="rounded-md" />
          <span className="font-display text-xl font-semibold text-ink-800">Cliniolab</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
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
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors ${
                pathname?.startsWith(link.href)
                  ? 'text-pulse-600'
                  : 'text-ink-500 hover:text-ink-800'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />
          <button
            onClick={() => setSearchOpen((v) => !v)}
            className="text-ink-500 hover:text-ink-800"
            aria-label="Search"
          >
            🔍
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
          className="md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          <span className="text-2xl text-ink-800">{mobileOpen ? '✕' : '☰'}</span>
        </button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto overscroll-x-contain border-t border-ink-100 px-4 py-2 md:hidden">
        {[
          { href: '/', label: 'Home' },
          { href: '/categories', label: 'Categories' },
          { href: '/quizzes', label: 'Quizzes' },
          { href: '/flashcards', label: 'Flashcards' },
          { href: '/blog', label: 'Articles' },
          { href: user ? '/dashboard' : '/login', label: user ? 'Dashboard' : 'Log in' },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`min-h-9 shrink-0 rounded-full px-3 py-2 text-xs font-medium ${
              pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href))
                ? 'bg-pulse-50 text-pulse-700'
                : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800'
            }`}
          >
            {link.label}
          </Link>
        ))}
        <span className="ml-auto shrink-0">
          <ThemeToggle />
        </span>
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

      {mobileOpen && (
        <nav className="border-t border-ink-100 bg-paper px-4 py-4 shadow-lg md:hidden">
          <div className="flex flex-col gap-3">
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
          </div>
        </nav>
      )}
    </header>
  );
}
