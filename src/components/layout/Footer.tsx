// src/components/layout/Footer.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { HomepageVideoSection } from './HomepageVideoSection';
import { BannerSlot } from './BannerSlot';
import { AdSenseSlot } from './AdSenseSlot';

interface BlogCategoryOption { id: string; name: string; slug: string; sortOrder: number }

export function Footer() {
  const [blogCategories, setBlogCategories] = useState<BlogCategoryOption[]>([]);

  useEffect(() => {
    fetch('/api/blog-categories')
      .then((res) => res.json())
      .then((data) => setBlogCategories(data.categories ?? []));
  }, []);

  return (
    <footer className="mt-16">
      <HomepageVideoSection />

      <BannerSlot placement="footer" />

      <div className="mx-auto max-w-7xl px-6 py-4">
        <AdSenseSlot slot={process.env.NEXT_PUBLIC_ADSENSE_FOOTER_SLOT} />
      </div>

      <div className="border-t border-ink-100 bg-ink-800 text-ink-100">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-5">
            <div className="col-span-2 sm:col-span-1">
              <span className="font-display text-lg font-semibold text-white">Cliniolab</span>
              <p className="mt-2 text-sm text-ink-300">
                Cliniolab helps clinical and nursing students prepare for exams with quizzes, flashcards, and reviewed study content, plus jobs and scholarships to support your career.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Explore</h4>
              <ul className="mt-3 space-y-2 text-sm text-ink-300">
                <li><Link href="/categories" className="hover:text-white">Categories</Link></li>
                <li><Link href="/quizzes" className="hover:text-white">Latest Quizzes</Link></li>
                <li><Link href="/leaderboard" className="hover:text-white">Leaderboard</Link></li>
                <li><Link href="/blog" className="hover:text-white">Blog</Link></li>
                <li><Link href="/jobs" className="hover:text-white">Jobs</Link></li>
                <li><Link href="/scholarships" className="hover:text-white">Scholarships</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Learning Content</h4>
              <ul className="mt-3 space-y-2 text-sm text-ink-300">
                {blogCategories
                  .filter((c) => c.slug !== 'job' && c.slug !== 'scholarship')
                  .map((c) => (
                    <li key={c.id}>
                      <Link href={`/blog/category/${c.slug}`} className="hover:text-white">
                        {c.name}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Account</h4>
              <ul className="mt-3 space-y-2 text-sm text-ink-300">
                <li><Link href="/login" className="hover:text-white">Log in</Link></li>
                <li><Link href="/register" className="hover:text-white">Sign up</Link></li>
                <li><Link href="/dashboard" className="hover:text-white">Dashboard</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Site</h4>
              <ul className="mt-3 space-y-2 text-sm text-ink-300">
                <li><Link href="/about" className="hover:text-white">About</Link></li>
                <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
                <li><Link href="/faq" className="hover:text-white">FAQ</Link></li>
                <li><Link href="/editorial-policy" className="hover:text-white">Editorial Policy</Link></li>
                <li><Link href="/medical-review-policy" className="hover:text-white">Medical Review Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white">Terms</Link></li>
                <li><Link href="/privacy" className="hover:text-white">Privacy</Link></li>
              </ul>
            </div>
          </div>
          <div className="chart-strip mt-10 text-ink-400" aria-hidden />
          <p className="mt-6 text-xs text-ink-400">
            © {new Date().getFullYear()} Cliniolab. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
