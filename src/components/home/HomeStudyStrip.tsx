// src/components/home/HomeStudyStrip.tsx
'use client';

import Link from 'next/link';

/** Quick "study window" picker + compact study-tools grid. Purely navigational. */
export function HomeStudyStrip() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-10 sm:pb-14">
      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pulse-600">
                Quick practice
              </p>
              <h2 className="mt-1 font-display text-xl font-semibold text-ink-900">
                Choose your study window
              </h2>
              <p className="mt-1 text-sm text-ink-500">
                Pick a target duration, then choose any quiz that fits your session.
              </p>
            </div>
            <span className="hidden rounded-full bg-pulse-50 px-2.5 py-1 text-[10px] font-semibold text-pulse-700 sm:block">
              No tracking
            </span>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {[5, 10, 20].map((minutes) => (
              <Link
                key={minutes}
                href={`/quizzes?studyTime=${minutes}`}
                className="rounded-xl border border-ink-100 px-3 py-3 text-center transition hover:-translate-y-0.5 hover:border-pulse-200 hover:shadow-sm"
              >
                <span className="block font-display text-lg font-semibold text-ink-900">
                  {minutes}
                </span>
                <span className="text-[11px] font-semibold text-ink-400">minutes</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-ink-100 bg-ink-50/50 p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">
            Study tools
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-ink-900">
            Everything in one tap
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {(
              [
                ['📝', 'Quizzes', '/quizzes'],
                ['🧠', 'Flashcards', '/flashcards'],
                ['📚', 'Resources', '/resources'],
                ['📖', 'Articles', '/blog'],
              ] as const
            ).map(([icon, label, href]) => (
              <Link
                key={href}
                href={href}
                className="rounded-xl border border-ink-100 bg-white px-3 py-3 text-sm font-semibold text-ink-700 transition hover:border-pulse-200 hover:text-pulse-700"
              >
                {icon} <span className="ml-1">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
