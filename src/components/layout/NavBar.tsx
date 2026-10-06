'use client';
// File: src/components/layout/NavBar.tsx

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { SearchAutocomplete } from '@/components/search/SearchAutocomplete';

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

  return (
    <header className="sticky top-0 z-50 border-b border-ink-100 bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/icon-192.png" alt="" width={28} height={28} className="rounded-md" />
          <span className="font-display text-xl font-semibold text-ink-800">Cliniolab</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
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
