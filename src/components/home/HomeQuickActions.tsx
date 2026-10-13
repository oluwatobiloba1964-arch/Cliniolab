// src/components/home/HomeQuickActions.tsx
'use client';

import Link from 'next/link';

export function HomeQuickActions({ signedIn }: { signedIn: boolean }) {
  const items = [
    {
      href: '/quizzes',
      icon: '📝',
      title: 'Practise',
      text: 'Test what you know with focused quizzes and CBT-style questions.',
      action: 'Take a quiz',
    },
    {
      href: '/flashcards',
      icon: '🧠',
      title: 'Review',
      text: 'Strengthen recall with quick, focused flashcard sessions.',
      action: 'Review cards',
    },
    {
      href: '/resources',
      icon: '📚',
      title: 'Learn',
      text: 'Build your understanding with clinical notes and study resources.',
      action: 'Explore resources',
    },
    ...(signedIn      ? [
          {
            href: '/dashboard',
            icon: '📈',
            title: 'Track progress',
            text: 'Open your dashboard, plan revision and use private study tools saved on this device.',
            action: 'Open study space',
          },
        ]
      : []),
  ];

  return (
    <section className="mx-auto max-w-7xl px-6 py-10 sm:py-14">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">
          Choose your next step
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold text-ink-900 sm:text-3xl">
          How do you want to study today?
        </h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-2xl border border-ink-100 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-pulse-200 hover:shadow-lg sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-pulse-50 text-xl">
                {item.icon}
              </span>
              <span className="text-sm font-semibold text-pulse-600 opacity-0 transition group-hover:opacity-100">
                →
              </span>
            </div>
            <h3 className="mt-5 font-display text-xl font-semibold text-ink-900">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-ink-500">{item.text}</p>
            <p className="mt-4 text-sm font-semibold text-pulse-600">{item.action} →</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
