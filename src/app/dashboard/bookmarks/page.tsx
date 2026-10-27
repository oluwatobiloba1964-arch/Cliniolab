'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { QuizCard } from '@/components/quiz/QuizCard';
import { ResourceCard } from '@/components/resources/ResourceCard';
import type { QuizWithStats, Resource } from '@/types';

export default function BookmarksPage() {
  const { user, loading } = useAuth();
  const [quizzes, setQuizzes] = useState<QuizWithStats[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [tab, setTab] = useState<'quizzes' | 'resources'>('quizzes');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loading) return;
    const cachePrefix = 'cliniolab:bookmark-resolved:v1:';
    if (!user) {
      try {
        for (let i = window.localStorage.length - 1; i >= 0; i--) {
          const key = window.localStorage.key(i);
          if (key?.startsWith(cachePrefix)) window.localStorage.removeItem(key);
        }
      } catch { /* Browser storage is optional. */ }
      setLoaded(true);
      return;
    }

    const cacheKey = `${cachePrefix}${user.id}`;
    let cachedData: { quizzes?: QuizWithStats[]; resources?: Resource[] } | null = null;
    let savedAt = 0;
    try {
      const raw = window.localStorage.getItem(cacheKey);
      const cached = raw ? JSON.parse(raw) as { savedAt?: number; data?: { quizzes?: QuizWithStats[]; resources?: Resource[] } } : null;
      if (cached?.data && typeof cached.savedAt === 'number') { cachedData = cached.data; savedAt = cached.savedAt; }
    } catch { /* Missing or corrupt cache falls back to the existing endpoint. */ }

    const apply = (data: { quizzes?: QuizWithStats[]; resources?: Resource[] }) => {
      setQuizzes(data.quizzes ?? []);
      setResources(data.resources ?? []);
      setLoaded(true);
    };
    const age = savedAt ? Date.now() - savedAt : Number.POSITIVE_INFINITY;
    if (cachedData) apply(cachedData);
    if (cachedData && age >= 0 && age < 2 * 60 * 1000) return;

    let cancelled = false;
    fetch('/api/bookmarks/resolved', { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Could not load bookmarks');
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        apply(data);
        try { window.localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data })); } catch { /* Cache is optional. */ }
      })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [user, loading]);

  if (loading) return null;
  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Login required</h1>
        <p className="mt-2 text-ink-500">Log in to see quizzes and resources you&apos;ve saved.</p>
        <Button className="mt-6" onClick={() => (window.location.href = '/login')}>Log in</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-ink-800">My bookmarks</h1>
      <p className="mt-2 text-ink-500">Quizzes and resources you&apos;ve saved for later.</p>

      <div className="mt-6 flex gap-2">
        <button
          onClick={() => setTab('quizzes')}
          className={`rounded-md border px-4 py-2 text-sm ${tab === 'quizzes' ? 'border-pulse-400 bg-pulse-50 text-pulse-700' : 'border-ink-100 text-ink-600'}`}
        >
          Quizzes {quizzes.length > 0 && `(${quizzes.length})`}
        </button>
        <button
          onClick={() => setTab('resources')}
          className={`rounded-md border px-4 py-2 text-sm ${tab === 'resources' ? 'border-pulse-400 bg-pulse-50 text-pulse-700' : 'border-ink-100 text-ink-600'}`}
        >
          Resources {resources.length > 0 && `(${resources.length})`}
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {tab === 'quizzes' &&
          (quizzes.length > 0 ? (
            quizzes.map((quiz) => <QuizCard key={quiz.id} quiz={quiz} />)
          ) : (
            loaded && <p className="col-span-full text-sm text-ink-400">No bookmarked quizzes yet.</p>
          ))}
        {tab === 'resources' &&
          (resources.length > 0 ? (
            resources.map((resource) => <ResourceCard key={resource.id} resource={resource} />)
          ) : (
            loaded && <p className="col-span-full text-sm text-ink-400">No bookmarked resources yet.</p>
          ))}
      </div>
    </div>
  );
}
