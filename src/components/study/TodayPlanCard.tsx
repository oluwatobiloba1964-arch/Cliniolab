// File: src/components/study/TodayPlanCard.tsx
// Browser-only daily plan. Combines signals that already exist in local
// storage (readiness components, flashcard backlog, tonight's quiz queue,
// upcoming exams, streak) into one prioritised suggestion with deep links.
// No database, no API calls. Renders nothing on a fresh device.

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarDays, Flame, Layers, ListChecks, Target } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { computeReadinessScore, countDueFlashcards, getWeakTopics } from '@/lib/services/localInsightsService';
import { computeStreak } from '@/lib/services/gamificationService';
import { QUIZ_QUEUE_KEY, EXAMS_KEY, readJson } from '@/lib/services/localExtrasService';

type QueueEntry = { id: string; title?: string };
type ExamEntry = { id: string; name: string; date: string };

type PlanAction = {
  key: string;
  eyebrow: string;
  title: string;
  detail: string;
  href: string;
  cta: string;
};

function daysUntil(dateStr: string): number | null {
  const target = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function TodayPlanCard() {
  const [ready, setReady] = useState(false);
  const [dueCards, setDueCards] = useState(0);
  const [queueCount, setQueueCount] = useState(0);
  const [nextExam, setNextExam] = useState<ExamEntry | null>(null);
  const [weakest, setWeakest] = useState<{ label: string; ratio: number } | null>(null);
  const [weakTopic, setWeakTopic] = useState<string | null>(null);
  const [hasHistory, setHasHistory] = useState(false);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    try {
      const due = countDueFlashcards();
      setDueCards(due.due);

      const queue = readJson<QueueEntry[]>(QUIZ_QUEUE_KEY, []);
      setQueueCount(Array.isArray(queue) ? queue.length : 0);

      const exams = readJson<ExamEntry[]>(EXAMS_KEY, []);
      const upcoming = (Array.isArray(exams) ? exams : [])
        .map((exam) => ({ ...exam, days: daysUntil(exam.date) }))
        .filter((exam) => exam.days !== null && exam.days >= 0 && exam.days <= 30)
        .sort((a, b) => (a.days ?? 0) - (b.days ?? 0))[0];
      if (upcoming) setNextExam({ id: upcoming.id, name: upcoming.name, date: upcoming.date });

      const readiness = computeReadinessScore();
      const worst = readiness.components
        .map((component) => ({ label: component.label, ratio: component.value / Math.max(1, component.max) }))
        .sort((a, b) => a.ratio - b.ratio)[0];
      setWeakest(worst ?? null);

      const topics = getWeakTopics();
      setWeakTopic(topics[0]?.topic ?? null);

      setHasHistory(readiness.components.some((component) => component.value > 0));
      setStreak(computeStreak().current);
    } catch {
      // The daily plan is a nicety and must never break the dashboard.
    }
    setReady(true);
  }, []);

  const plan = useMemo<PlanAction | null>(() => {
    // 1. Exam countdown wins when an exam is close.
    if (nextExam) {
      const days = daysUntil(nextExam.date) ?? 0;
      return {
        key: 'exam',
        eyebrow: 'Exam countdown',
        title: `${nextExam.name} is in ${days === 0 ? 'less than a day' : `${days} day${days === 1 ? '' : 's'}`}`,
        detail: weakTopic
          ? `Focus today on your weakest area: ${weakTopic}. Short, targeted practice beats long sessions.`
          : 'Prioritise short, targeted practice on the topics you keep missing.',
        href: weakTopic ? `/search?q=${encodeURIComponent(weakTopic)}` : '/study/revision',
        cta: 'Practise this topic',
      };
    }

    // 2. Flashcard backlog is the cheapest high-value win.
    if (dueCards >= 1) {
      return {
        key: 'flashcards',
        eyebrow: 'Spaced repetition',
        title: `Clear ${dueCards} due flashcard${dueCards === 1 ? '' : 's'}`,
        detail: 'Reviews are due right now. Clearing the backlog keeps the schedule working for you.',
        href: '/flashcards',
        cta: 'Review flashcards',
      };
    }

    // 3. Tonight's queue keeps momentum on planned work.
    if (queueCount >= 1) {
      return {
        key: 'queue',
        eyebrow: 'Your queue',
        title: `Work through ${queueCount} queued quiz${queueCount === 1 ? '' : 'zes'}`,
        detail: 'You saved these for later. Start with the first one, even a short run counts.',
        href: '/quizzes',
        cta: 'Open quizzes',
      };
    }

    // 4. Target the weakest readiness component.
    if (weakest && weakest.ratio < 1) {
      if (weakest.label === 'Flashcard backlog') {
        return {
          key: 'readiness-flashcards',
          eyebrow: 'Readiness focus',
          title: 'Build a flashcard habit',
          detail: 'Your readiness is limited by flashcard backlog. A ten minute review session lifts it.',
          href: '/flashcards',
          cta: 'Open flashcards',
        };
      }
      if (weakest.label === 'Study consistency') {
        return {
          key: 'readiness-consistency',
          eyebrow: 'Readiness focus',
          title: 'Log one focus session today',
          detail: 'Consistency is your weakest signal. One focus timer session today moves it up.',
          href: '/dashboard#study-toolkit',
          cta: 'Start focus timer',
        };
      }
      if (weakest.label === 'Miss trend') {
        return {
          key: 'readiness-misses',
          eyebrow: 'Readiness focus',
          title: 'Review why you miss questions',
          detail: 'Too many misses are knowledge gaps. The revision queue targets exactly those.',
          href: '/study/revision',
          cta: 'Open revision queue',
        };
      }
      return {
        key: 'readiness-quiz',
        eyebrow: 'Readiness focus',
        title: 'Take a quiz to lift your score',
        detail: 'Quiz performance drives your readiness the most. One solid attempt today helps.',
        href: '/quizzes',
        cta: 'Browse quizzes',
      };
    }

    // 5. Revive a lapsed streak.
    if (streak === 0 && hasHistory) {
      return {
        key: 'streak',
        eyebrow: 'Streak revive',
        title: 'Restart your study streak today',
        detail: 'A short quiz or one focus session is enough to put day one back on the board.',
        href: '/quizzes',
        cta: 'Pick a quick quiz',
      };
    }

    // 6. Default: keep momentum.
    if (hasHistory) {
      return {
        key: 'momentum',
        eyebrow: 'Keep going',
        title: 'You are on track. Add one more quiz.',
        detail: 'Momentum is compounding. One more attempt today keeps your readiness rising.',
        href: '/quizzes',
        cta: 'Browse quizzes',
      };
    }

    return null;
  }, [nextExam, dueCards, queueCount, weakest, streak, hasHistory, weakTopic]);

  if (!ready || !plan) return null;

  const secondary: { key: string; label: string; href: string; icon: 'flash' | 'queue' | 'exam' | 'streak' }[] = [];
  if (plan.key !== 'flashcards' && dueCards >= 1) {
    secondary.push({ key: 'sec-flash', label: `${dueCards} flashcard${dueCards === 1 ? '' : 's'} due`, href: '/flashcards', icon: 'flash' });
  }
  if (plan.key !== 'queue' && queueCount >= 1) {
    secondary.push({ key: 'sec-queue', label: `${queueCount} in tonight's queue`, href: '/quizzes', icon: 'queue' });
  }
  if (plan.key !== 'exam' && !nextExam) {
    secondary.push({ key: 'sec-exam', label: 'Set an exam date', href: '/dashboard#study-toolkit', icon: 'exam' });
  }
  if (plan.key !== 'streak' && streak === 0) {
    secondary.push({ key: 'sec-streak', label: 'Start a streak today', href: '/quizzes', icon: 'streak' });
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pulse-600">Today&apos;s plan</p>
            <h3 className="mt-1 font-display text-lg font-semibold text-ink-900">One thing that moves you forward</h3>
          </div>
          <span className="rounded-full bg-ink-50 px-3 py-1 text-[10px] font-semibold text-ink-400">
            Device only · no sync
          </span>
        </div>

        <div className="rounded-2xl border border-pulse-100 bg-gradient-to-br from-pulse-50/80 to-white p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-pulse-600">{plan.eyebrow}</p>
          <p className="mt-1.5 font-display text-lg font-semibold text-ink-900">{plan.title}</p>
          <p className="mt-1 text-sm leading-6 text-ink-500">{plan.detail}</p>
          <Link
            href={plan.href}
            className="mt-3.5 inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-800"
          >
            {plan.cta}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>

        {secondary.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-400">Also worth a look</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {secondary.slice(0, 3).map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-600 transition hover:border-pulse-300 hover:text-pulse-700"
                >
                  {item.icon === 'flash' && <Layers aria-hidden="true" className="h-3.5 w-3.5" />}
                  {item.icon === 'queue' && <ListChecks aria-hidden="true" className="h-3.5 w-3.5" />}
                  {item.icon === 'exam' && <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />}
                  {item.icon === 'streak' && <Flame aria-hidden="true" className="h-3.5 w-3.5" />}
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
