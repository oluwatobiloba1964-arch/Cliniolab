// src/components/home/HomeResumeSection.tsx
'use client';

import Link from 'next/link';
import type { QuizWithStats } from '@/types';

export function HomeResumeSection({ items }: { items: QuizWithStats[] }) {
  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-6 pb-10 sm:pb-14">
      <div className="rounded-2xl border border-pulse-100 bg-pulse-50/40 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pulse-600">
              Continue studying
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-ink-900">
              Pick up where you left off
            </h2>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold text-ink-500 shadow-sm">
            Saved on this device
          </span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {items.map((quiz) => (
            <Link
              key={quiz.id}
              href={`/quizzes/${quiz.id}`}
              className="group rounded-xl border border-white bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-pulse-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="line-clamp-2 font-display font-semibold text-ink-800 group-hover:text-pulse-700">
                  {quiz.title}
                </h3>
                <span className="shrink-0 text-pulse-600">→</span>
              </div>
              <p className="mt-2 text-xs text-ink-400">
                {quiz.questionCount} questions ·{' '}
                {quiz.mode === 'combined' ? 'Combined' : quiz.mode === 'exam' ? 'Exam' : quiz.mode === 'study' ? 'Study' : 'Quiz'} mode
              </p>
              <p className="mt-3 text-xs font-semibold text-pulse-600">Continue session</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
