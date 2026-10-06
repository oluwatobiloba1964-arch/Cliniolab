'use client';
// File: src/components/layout/Footer.tsx

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { publicFetchJson } from '@/lib/client/publicFetch';
import { HomepageVideoSection } from './HomepageVideoSection';
import { BannerSlot } from './BannerSlot';
import { AdSenseSlot } from './AdSenseSlot';
import { ArrowUpRight, BookOpen, GraduationCap, HeartPulse, Mail, ShieldCheck, Sparkles } from 'lucide-react';

interface BlogCategoryOption { id: string; name: string; slug: string; sortOrder: number }

export function Footer() {
  const [blogCategories, setBlogCategories] = useState<BlogCategoryOption[]>([]);

  useEffect(() => {
    publicFetchJson<{ categories?: BlogCategoryOption[] }>('/api/blog-categories', 300_000)
      .then((data) => setBlogCategories(data.categories ?? []))
      .catch(() => setBlogCategories([]));
  }, []);

  return (
    <footer className="mt-16">
      <HomepageVideoSection />

      <BannerSlot placement="footer" />

      <div className="mx-auto max-w-7xl px-6 py-4">
        <AdSenseSlot slot={process.env.NEXT_PUBLIC_ADSENSE_FOOTER_SLOT} />
      </div>

      <div className="border-t border-ink-100 bg-ink-800 text-ink-100">
        <div className="mx-auto max-w-7xl px-6 py-12 sm:py-14">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 text-pulse-300">
                  <HeartPulse className="h-5 w-5" aria-hidden />
                  <span className="text-xs font-semibold uppercase tracking-[0.18em]">Study smarter</span>
                </div>
                <h2 className="mt-2 font-display text-2xl font-semibold text-white sm:text-3xl">
                  Your clinical learning hub.
                </h2>
                <p className="mt-2 text-sm leading-6 text-ink-300">
                  Practice with quizzes, review with flashcards, discover study resources, and keep moving toward your next exam.
                </p>
              </div>
              <Link
                href="/quizzes"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-pulse-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pulse-600"
              >
                Start practising
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-8 sm:grid-cols-5">
            <div className="col-span-2 sm:col-span-1">
              <Link href="/" className="inline-flex items-center gap-2" aria-label="Cliniolab home">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-pulse-500/15 text-pulse-300">
                  <HeartPulse className="h-5 w-5" aria-hidden />
                </span>
                <span className="font-display text-xl font-semibold text-white">Cliniolab</span>
              </Link>
              <p className="mt-3 text-sm leading-6 text-ink-300">
                A focused learning platform for clinical and nursing students, with practical exam preparation and career resources.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-medium text-ink-400">
                <span className="rounded-full border border-white/10 px-2.5 py-1">Quizzes</span>
                <span className="rounded-full border border-white/10 px-2.5 py-1">Flashcards</span>
                <span className="rounded-full border border-white/10 px-2.5 py-1">Resources</span>
              </div>
            </div>

            <div>
              <h4 className="flex items-center gap-2 text-sm font-semibold text-white"><BookOpen className="h-4 w-4 text-pulse-300" /> Explore</h4>
              <ul className="mt-4 space-y-2.5 text-sm text-ink-300">
                <li><Link href="/categories" className="transition hover:text-white">Categories</Link></li>
                <li><Link href="/quizzes" className="transition hover:text-white">Latest Quizzes</Link></li>
                <li><Link href="/leaderboard" className="transition hover:text-white">Leaderboard</Link></li>
                <li><Link href="/blog" className="transition hover:text-white">Blog</Link></li>
                <li><Link href="/jobs" className="transition hover:text-white">Jobs</Link></li>
                <li><Link href="/scholarships" className="transition hover:text-white">Scholarships</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="flex items-center gap-2 text-sm font-semibold text-white"><GraduationCap className="h-4 w-4 text-pulse-300" /> Learning</h4>
              <ul className="mt-4 space-y-2.5 text-sm text-ink-300">
                {blogCategories
                  .filter((c) => c.slug !== 'job' && c.slug !== 'scholarship')
                  .slice(0, 7)
                  .map((c) => (
                    <li key={c.id}><Link href={`/blog/category/${c.slug}`} className="transition hover:text-white">{c.name}</Link></li>
                  ))}
                <li><Link href="/flashcards" className="font-medium text-pulse-300 transition hover:text-pulse-200">Browse flashcards →</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="flex items-center gap-2 text-sm font-semibold text-white"><Sparkles className="h-4 w-4 text-pulse-300" /> Account</h4>
              <ul className="mt-4 space-y-2.5 text-sm text-ink-300">
                <li><Link href="/login" className="transition hover:text-white">Log in</Link></li>
                <li><Link href="/register" className="transition hover:text-white">Create free account</Link></li>
                <li><Link href="/dashboard" className="transition hover:text-white">Dashboard</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="flex items-center gap-2 text-sm font-semibold text-white"><ShieldCheck className="h-4 w-4 text-pulse-300" /> Site & help</h4>
              <ul className="mt-4 space-y-2.5 text-sm text-ink-300">
                <li><Link href="/about" className="transition hover:text-white">About</Link></li>
                <li><Link href="/contact" className="transition hover:text-white">Contact</Link></li>
                <li><Link href="/faq" className="transition hover:text-white">FAQ</Link></li>
                <li><Link href="/editorial-policy" className="transition hover:text-white">Editorial Policy</Link></li>
                <li><Link href="/medical-review-policy" className="transition hover:text-white">Medical Review Policy</Link></li>
                <li><Link href="/terms" className="transition hover:text-white">Terms</Link></li>
                <li><Link href="/privacy" className="transition hover:text-white">Privacy</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-10 chart-strip text-ink-400" aria-hidden />
          <div className="mt-5 flex flex-col gap-3 text-xs text-ink-400 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Cliniolab. All rights reserved.</p>
            <p className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" aria-hidden /> Built for better clinical learning.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
