// File: src/components/study/SmartRevisionQueue.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';

const TOOLKIT_KEY = 'cliniolab_local_study_toolkit_v1';
type QueueItem = { id: string; kind: string; title: string; detail: string; href?: string; priority: number; source: string };
type Topic = { id: string; title: string; href?: string; savedAt: string };

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

/** Combines only data already stored on this device. Never calls an API. */
export function SmartRevisionQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const next: QueueItem[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key.startsWith('cl-guest-missed:')) {
          const quizId = key.slice('cl-guest-missed:'.length);
          const missed = safeParse<unknown[]>(localStorage.getItem(key), []);
          if (missed.length) next.push({ id: `missed:${quizId}`, kind: 'Missed questions', title: `Review missed questions`, detail: `${missed.length} question${missed.length === 1 ? '' : 's'} from a previous quiz`, href: `/quizzes/${encodeURIComponent(quizId)}?retakeMissed=1`, priority: 100, source: key });
        }
        if (key.startsWith('cliniolab:spaced-repetition:')) {
          const schedule = safeParse<Record<string, { dueAt?: string; intervalDays?: number }>>(localStorage.getItem(key), {});
          const dueCount = Object.values(schedule).filter((card) => !card.dueAt || new Date(card.dueAt).getTime() <= Date.now()).length;
          if (dueCount) next.push({ id: `flashcards:${key}`, kind: 'Flashcards due', title: 'Review flashcards', detail: `${dueCount} card${dueCount === 1 ? '' : 's'} due for review`, href: '/flashcards', priority: 90, source: key });
        }
      }
      const toolkit = safeParse<{ tasks?: Array<{ id?: string; text?: string; done?: boolean; date?: string }>; notes?: Array<{ id?: string; title?: string }>; savedTopics?: Topic[] }>(localStorage.getItem(TOOLKIT_KEY), {});
      for (const task of toolkit.tasks ?? []) {
        if (task.text && !task.done) next.push({ id: `task:${task.id ?? task.text}`, kind: 'Study plan', title: task.text, detail: 'An unfinished item from your existing study plan', href: '/dashboard', priority: 70, source: TOOLKIT_KEY });
      }
      for (const topic of toolkit.savedTopics ?? []) next.push({ id: `topic:${topic.id}`, kind: 'Saved topic', title: topic.title, detail: 'Saved locally for revision', href: topic.href, priority: 60, source: TOOLKIT_KEY });
      // Read any existing local bookmark cache if the app/browser has one. No remote bookmark request is made.
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !/bookmark/i.test(key)) continue;
        const cached = safeParse<unknown>(localStorage.getItem(key), null);
        if (Array.isArray(cached)) cached.slice(0, 20).forEach((entry, index) => {
          if (entry && typeof entry === 'object') {
            const row = entry as Record<string, unknown>;
            const title = String(row.title ?? row.name ?? row.label ?? '').trim();
            const href = typeof row.href === 'string' ? row.href : typeof row.url === 'string' ? row.url : undefined;
            if (title) next.push({ id: `bookmark:${key}:${String(row.id ?? index)}`, kind: 'Bookmark', title, detail: 'Found in local bookmark cache', href, priority: 50, source: key });
          }
        });
      }
    } catch { /* Local storage can be disabled or full. Keep the page usable. */ }
    const unique = Array.from(new Map(next.map((item) => [item.id, item])).values());
    setItems(unique.sort((a, b) => b.priority - a.priority).slice(0, 100));
    setReady(true);
  }, []);

  const grouped = useMemo(() => items.reduce<Record<string, QueueItem[]>>((all, item) => { (all[item.kind] ??= []).push(item); return all; }, {}), [items]);

  return <div className="mx-auto max-w-5xl px-5 py-10 sm:px-6">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pulse-600">Device-only revision</p>
    <h1 className="mt-2 font-display text-3xl font-semibold text-ink-900">Smart Revision Queue</h1>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500">Your next revision tasks are prioritised from missed questions, flashcards due for review, and unfinished items already saved on this device. Nothing is uploaded.</p>
    <div className="mt-6 grid gap-3 sm:grid-cols-3"><Card className="p-4"><p className="text-xs text-ink-500">Items to review</p><p className="mt-1 text-2xl font-semibold text-ink-900">{ready ? items.length : '…'}</p></Card><Card className="p-4"><p className="text-xs text-ink-500">High priority</p><p className="mt-1 text-2xl font-semibold text-ink-900">{items.filter((x) => x.priority >= 90).length}</p></Card><Card className="p-4"><p className="text-xs text-ink-500">Data source</p><p className="mt-1 text-sm font-semibold text-ink-900">This device only</p></Card></div>
    {!ready ? <p className="mt-8 text-sm text-ink-500">Loading local study data…</p> : items.length === 0 ? <Card className="mt-8 p-6"><h2 className="font-semibold text-ink-800">Your queue is clear</h2><p className="mt-2 text-sm text-ink-500">Complete a quiz, review flashcards, or add a topic to your study plan to build your revision queue.</p><div className="mt-4 flex flex-wrap gap-2"><Link className="rounded-lg bg-pulse-600 px-4 py-2 text-sm font-semibold text-white" href="/quizzes">Practise quizzes</Link><Link className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700" href="/flashcards">Review flashcards</Link></div></Card> : <div className="mt-8 space-y-6">{Object.entries(grouped).map(([kind, group]) => <section key={kind}><h2 className="mb-3 font-semibold text-ink-800">{kind}</h2><div className="grid gap-3 sm:grid-cols-2">{group.map((item) => <Card key={item.id} className="flex items-start justify-between gap-4 p-4"><div><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${item.priority >= 90 ? 'bg-amber-50 text-amber-700' : 'bg-ink-50 text-ink-500'}`}>{item.priority >= 90 ? 'Review soon' : 'For revision'}</span><h3 className="mt-2 text-sm font-semibold text-ink-800">{item.title}</h3><p className="mt-1 text-xs leading-5 text-ink-500">{item.detail}</p></div>{item.href && <Link href={item.href} className="shrink-0 text-sm font-semibold text-pulse-600 hover:text-pulse-700">Open</Link>}</Card>)}</div></section>)}</div>}
    <p className="mt-8 text-xs leading-5 text-ink-400">Some bookmarks are saved to your account instead of this device. Only the ones already saved here are shown, so this list may not include everything you have bookmarked.</p>
  </div>;
}
