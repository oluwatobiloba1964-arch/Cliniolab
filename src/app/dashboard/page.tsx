// File: src/app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FlashcardSetCard } from '@/components/flashcards/FlashcardSetCard';
import { ShareButton } from '@/components/quiz/ShareButton';
import type { Certificate, FlashcardSetWithStats, QuestionReportWithContext, QuizWithStats, UserDashboardStats } from '@/types';
import { LoadingState } from '@/components/ui/StateMessage';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [stats, setStats] = useState<UserDashboardStats | null>(null);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [certificatesEnabled, setCertificatesEnabled] = useState(true);
  const [myQuizzes, setMyQuizzes] = useState<QuizWithStats[]>([]);
  const [myFlashcardSets, setMyFlashcardSets] = useState<FlashcardSetWithStats[]>([]);
  const [flaggedQuestions, setFlaggedQuestions] = useState<QuestionReportWithContext[]>([]);
  const [dismissingReportId, setDismissingReportId] = useState<string | null>(null);
  const [deletingQuizId, setDeletingQuizId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [copiedQuizId, setCopiedQuizId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'quizzes' | 'flashcards'>('quizzes');

  // Which quiz's "go private" access-mode picker is currently open, and the
  // password field's contents while it's open (for either first-time set
  // or a later change on an already password-protected quiz).
  const [accessPickerQuizId, setAccessPickerQuizId] = useState<string | null>(null);
  const [accessModeChoice, setAccessModeChoice] = useState<'link' | 'password'>('link');
  const [passwordDraft, setPasswordDraft] = useState('');
  const [accessError, setAccessError] = useState<string | null>(null);
  const [savingAccess, setSavingAccess] = useState(false);
  const [passwordChangeQuizId, setPasswordChangeQuizId] = useState<string | null>(null);

  async function copyShareLink(quizId: string, shareSlug: string) {
    const url = `${window.location.origin}/quizzes/shared/${shareSlug}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopiedQuizId(quizId);
    setTimeout(() => setCopiedQuizId((current) => (current === quizId ? null : current)), 2000);
  }

  useEffect(() => {
    if (!user) return;
    fetch('/api/dashboard')
      .then((res) => {
        if (!res.ok) throw new Error('Dashboard request failed');
        return res.json();
      })
      .then((data) => {
        setStats(data.stats);
        setCertificates(data.certificates ?? []);
        setCertificatesEnabled(data.certificatesEnabled !== false);
        setMyQuizzes(data.myQuizzes ?? []);
        setMyFlashcardSets(data.myFlashcardSets ?? []);
        setFlaggedQuestions(data.flaggedQuestions ?? []);
      })
      .catch(() => {});
  }, [user]);

  async function regenerateLink(quizId: string) {
    const res = await fetch(`/api/quizzes/${quizId}/regenerate-link`, { method: 'POST' });
    if (res.ok) {
      const res2 = await fetch('/api/quizzes?mine=true');
      const data = await res2.json();
      setMyQuizzes(data.quizzes ?? []);
    }
  }

  async function moveToGuest(quizId: string) {
    const res = await fetch(`/api/quizzes/${quizId}/visibility`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility: 'guest' }),
    });
    if (res.ok) {
      const res2 = await fetch('/api/quizzes?mine=true');
      const data = await res2.json();
      setMyQuizzes(data.quizzes ?? []);
    } else {
      const data = await res.json().catch(() => ({}));
      window.alert(data.error ?? 'Could not move this quiz to Guest Practice.');
    }
  }

  function requestGoPrivate(quizId: string) {
    // Going private (from public OR guest): open the access-mode picker
    // instead of flipping straight to link-mode, so the creator can choose
    // link vs password.
    setAccessPickerQuizId(quizId);
    setAccessModeChoice('link');
    setPasswordDraft('');
    setAccessError(null);
  }

  async function goPublic(quizId: string) {
    // Going to public (from private OR guest) needs no picker.
    const res = await fetch(`/api/quizzes/${quizId}/visibility`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility: 'public' }),
    });
    if (res.ok) {
      const res2 = await fetch('/api/quizzes?mine=true');
      const data = await res2.json();
      setMyQuizzes(data.quizzes ?? []);
    }
  }

  async function confirmGoPrivate(quizId: string) {
    if (accessModeChoice === 'password' && passwordDraft.length < 4) {
      setAccessError('Password must be at least 4 characters');
      return;
    }
    setSavingAccess(true);
    setAccessError(null);
    try {
      const res = await fetch(`/api/quizzes/${quizId}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visibility: 'private',
          accessMode: accessModeChoice,
          ...(accessModeChoice === 'password'
            ? { password: passwordDraft }
            : { linkExpiry: '7d' }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAccessError(data.error ?? 'Failed to update visibility');
        return;
      }
      setAccessPickerQuizId(null);
      setPasswordDraft('');
      const res2 = await fetch('/api/quizzes?mine=true');
      const data2 = await res2.json();
      setMyQuizzes(data2.quizzes ?? []);
    } finally {
      setSavingAccess(false);
    }
  }

  async function changePassword(quizId: string) {
    if (passwordDraft.length < 4) {
      setAccessError('Password must be at least 4 characters');
      return;
    }
    setSavingAccess(true);
    setAccessError(null);
    try {
      const res = await fetch(`/api/quizzes/${quizId}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordDraft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAccessError(data.error ?? 'Failed to update password');
        return;
      }
      setPasswordChangeQuizId(null);
      setPasswordDraft('');
    } finally {
      setSavingAccess(false);
    }
  }

  async function deleteQuiz(quizId: string) {
    if (!confirm('Delete this quiz permanently? This cannot be undone.')) return;
    setDeleteError(null);
    setDeletingQuizId(quizId);
    try {
      const res = await fetch(`/api/quizzes/${quizId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(data.error ?? `Failed to delete quiz (${res.status})`);
        return;
      }
      setMyQuizzes((prev) => prev.filter((q) => q.id !== quizId));
    } catch {
      setDeleteError('Network error while deleting. Please try again.');
    } finally {
      setDeletingQuizId(null);
    }
  }

  async function dismissFlag(reportId: string, status: 'reviewed' | 'dismissed') {
    setDismissingReportId(reportId);
    try {
      const res = await fetch(`/api/dashboard/flagged-questions/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setFlaggedQuestions((prev) => prev.filter((r) => r.id !== reportId));
      }
    } finally {
      setDismissingReportId(null);
    }
  }

  if (loading) return <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14"><LoadingState label="Loading your dashboard" /></div>;
  const studyProgress = Math.max(0, Math.min(100, Math.round(stats?.averagePercentage ?? 0)));
  const scoreHistory = stats?.scoreHistory ?? [];
  const recentActivity = scoreHistory.slice(-3).reverse();
  const todayKey = new Date().toDateString();
  const todayAttempts = scoreHistory.filter((item) => new Date(item.date).toDateString() === todayKey).length;
  const dailyMissionTarget = 1;
  const dailyMissionComplete = todayAttempts >= dailyMissionTarget;
  const recentScores = scoreHistory.slice(-5).map((item) => item.percentage);
  const recentAverage = recentScores.length
    ? Math.round(recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length)
    : studyProgress;
  const previousScores = scoreHistory.slice(-10, -5).map((item) => item.percentage);
  const previousAverage = previousScores.length
    ? Math.round(previousScores.reduce((sum, score) => sum + score, 0) / previousScores.length)
    : null;
  const momentum = previousAverage === null ? null : recentAverage - previousAverage;
  const hasStudyActivity = (stats?.totalAttempts ?? 0) > 0 || myFlashcardSets.length > 0;
  const nextStudyAction = (stats?.totalAttempts ?? 0) > 0 ? 'Continue practising' : 'Start your first quiz';
  const masteryLabel = studyProgress >= 80 ? 'Strong foundation' : studyProgress >= 60 ? 'Building confidence' : studyProgress > 0 ? 'Keep building' : 'Ready to begin';

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Login required</h1>
        <Button className="mt-6" onClick={() => router.push('/login')}>Log in</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink-800 sm:text-3xl">
          Welcome back, {user.displayName ?? user.email}
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/dashboard/creator-settings" className="text-sm font-medium text-pulse-600 hover:text-pulse-700">
            Creator settings
          </Link>
          <Link href="/dashboard/email-preferences" className="text-sm font-medium text-pulse-600 hover:text-pulse-700">
            Email preferences
          </Link>
        </div>
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1.45fr_0.8fr]">
        <Card className="overflow-hidden p-0">
          <div className="bg-gradient-to-br from-pulse-50 via-white to-ink-50 p-6 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pulse-600">Your learning space</p>
                <h2 className="mt-2 font-display text-2xl font-semibold text-ink-900 sm:text-3xl">
                  {nextStudyAction}
                </h2>
                <p className="mt-2 text-sm leading-6 text-ink-500">
                  Learn, practise, review your performance, and return to the topics that need more attention.
                </p>
              </div>
              {user.currentStreakDays > 0 && (
                <div className="rounded-xl border border-flag-100 bg-white px-4 py-3 text-center shadow-sm">
                  <p className="font-mono text-xl font-semibold text-flag-500">🔥 {user.currentStreakDays}</p>
                  <p className="mt-0.5 text-[11px] font-medium text-ink-400">day streak</p>
                </div>
              )}
            </div>

            <div className="mt-6 rounded-xl border border-ink-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink-800">Mastery progress</p>
                  <p className="mt-0.5 text-xs text-ink-400">A simple view of your existing quiz performance</p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm font-semibold text-pulse-600">{studyProgress}%</span>
                  <p className="text-[10px] font-medium text-ink-400">{masteryLabel}</p>
                </div>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-ink-100" aria-label={`Study progress ${studyProgress}%`}>
                <div className="h-full rounded-full bg-pulse-500 transition-all duration-700 ease-out" style={{ width: `${studyProgress}%` }} />
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-ink-400">
                <span>Average {studyProgress}%</span>
                <span>Best {Math.round(stats?.bestPercentage ?? 0)}%</span>
                {momentum !== null && <span className={momentum >= 0 ? 'text-pulse-600' : 'text-critical-600'}>{momentum >= 0 ? '↗' : '↘'} {Math.abs(momentum)}% momentum</span>}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Link href="/quizzes" className="group rounded-xl border border-ink-100 bg-white p-4 transition hover:-translate-y-0.5 hover:border-pulse-200 hover:shadow-sm">
                <span className="text-xl">📝</span>
                <p className="mt-3 text-sm font-semibold text-ink-800 group-hover:text-pulse-700">Practise</p>
                <p className="mt-1 text-xs leading-5 text-ink-400">Test what you know with quizzes.</p>
              </Link>
              <Link href="/flashcards" className="group rounded-xl border border-ink-100 bg-white p-4 transition hover:-translate-y-0.5 hover:border-pulse-200 hover:shadow-sm">
                <span className="text-xl">🧠</span>
                <p className="mt-3 text-sm font-semibold text-ink-800 group-hover:text-pulse-700">Review</p>
                <p className="mt-1 text-xs leading-5 text-ink-400">Refresh important concepts with flashcards.</p>
              </Link>
              <Link href="/quizzes" className="group rounded-xl border border-ink-100 bg-white p-4 transition duration-200 hover:-translate-y-0.5 hover:border-pulse-200 hover:shadow-sm">
                <span className="text-xl">🎯</span>
                <p className="mt-3 text-sm font-semibold text-ink-800 group-hover:text-pulse-700">Daily practice</p>
                <p className="mt-1 text-xs leading-5 text-ink-400">Keep your daily learning habit going with a quick quiz.</p>
              </Link>
            </div>

            <div className="mt-4 rounded-xl border border-pulse-100 bg-pulse-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-pulse-700">Today’s mission</p>
                  <p className="mt-1 text-sm font-semibold text-ink-800">{dailyMissionComplete ? 'Daily practice complete' : 'Complete one focused practice session'}</p>
                  <p className="mt-0.5 text-xs text-ink-500">No new tracking is created — this is calculated from your existing learning history.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full bg-pulse-500 transition-all duration-500" style={{ width: `${Math.min(100, (todayAttempts / dailyMissionTarget) * 100)}%` }} />
                  </div>
                  <span className="font-mono text-xs font-semibold text-pulse-700">{Math.min(todayAttempts, dailyMissionTarget)}/{dailyMissionTarget}</span>
                  {!dailyMissionComplete && <Link href="/quizzes" className="rounded-lg bg-pulse-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-pulse-700">Start</Link>}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">Learning path</p>
              <h2 className="mt-1 font-display text-xl font-semibold text-ink-800">Build your knowledge</h2>
            </div>
            <span className="rounded-full bg-pulse-50 px-2.5 py-1 text-[11px] font-semibold text-pulse-700">4 steps</span>
          </div>
          <div className="mt-6 space-y-1">
            {[
              ['Learn', 'Understand the concept', '1'],
              ['Practise', 'Apply it with questions', '2'],
              ['Review', 'Check mistakes and gaps', '3'],
              ['Master', 'Return until you are confident', '4'],
            ].map(([title, description, step], index) => (
              <div key={title} className="relative flex gap-3 pb-5 last:pb-0">
                {index < 3 && <span className="absolute left-[15px] top-8 h-[calc(100%-8px)] w-px bg-ink-100" aria-hidden="true" />}
                <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-pulse-100 bg-pulse-50 font-mono text-xs font-semibold text-pulse-700">{step}</span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-sm font-semibold text-ink-800">{title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-ink-400">{description}</p>
                </div>
              </div>
            ))}
          </div>
          <Link href="/quizzes" className="mt-6 block rounded-lg bg-ink-900 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-ink-800">
            Start learning →
          </Link>
        </Card>
      </section>

      {hasStudyActivity && recentActivity.length > 0 && (
        <Card className="mt-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">Recent learning</p>
              <h2 className="mt-1 font-display text-lg font-semibold text-ink-800">Pick up where you left off</h2>
            </div>
            <Link href="/quizzes" className="text-sm font-semibold text-pulse-600 hover:text-pulse-700">Browse quizzes →</Link>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {recentActivity.map((item, index) => (
              <div key={`${item.date}-${item.quizTitle}-${index}`} className="rounded-xl border border-ink-100 bg-ink-50/60 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">Recent</span>
                  <span className="font-mono text-sm font-semibold text-pulse-600">{Math.round(item.percentage)}%</span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm font-semibold text-ink-800">{item.quizTitle}</p>
                <p className="mt-1 text-xs text-ink-400">{new Date(item.date).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className={`mt-8 grid grid-cols-2 gap-4 ${certificatesEnabled ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
        <Card className="p-5 text-center">
          <p className="font-mono text-3xl font-semibold text-ink-800">{stats?.totalAttempts ?? 0}</p>
          <p className="mt-1 text-xs text-ink-400">Attempts</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="font-mono text-3xl font-semibold text-pulse-600">
            {stats ? Math.round(stats.averagePercentage) : 0}%
          </p>
          <p className="mt-1 text-xs text-ink-400">Average score</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="font-mono text-3xl font-semibold text-flag-500">
            {stats ? Math.round(stats.bestPercentage) : 0}%
          </p>
          <p className="mt-1 text-xs text-ink-400">Best score</p>
        </Card>
        {certificatesEnabled && (
          <Card className="p-5 text-center">
            <p className="font-mono text-3xl font-semibold text-ink-800">{stats?.certificatesEarned ?? 0}</p>
            <p className="mt-1 text-xs text-ink-400">Certificates</p>
          </Card>
        )}
      </div>

      {stats && stats.scoreHistory.length > 0 && (
        <Card className="mt-8 p-6">
          <h2 className="font-display text-lg font-semibold text-ink-800">Score history</h2>
          <div className="mt-4 flex items-end gap-1.5" style={{ height: 120 }}>
            {stats.scoreHistory.slice(-20).map((h, i) => (
              <div
                key={i}
                title={`${h.quizTitle}: ${Math.round(h.percentage)}%`}
                className="flex-1 rounded-t bg-pulse-400"
                style={{ height: `${Math.max(4, h.percentage)}%` }}
              />
            ))}
          </div>
        </Card>
      )}

      <div className="mt-10 flex gap-2 border-b border-ink-100">
        <button
          type="button"
          onClick={() => setActiveTab('quizzes')}
          className={`-mb-px flex-1 border-b-2 px-4 py-3 text-center font-display text-base font-semibold transition-colors sm:flex-none sm:text-lg ${
            activeTab === 'quizzes'
              ? 'border-pulse-600 text-ink-800'
              : 'border-transparent text-ink-400 hover:text-ink-600'
          }`}
        >
          My quizzes <span className="ml-1 font-mono text-xs text-ink-400">({myQuizzes.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('flashcards')}
          className={`-mb-px flex-1 border-b-2 px-4 py-3 text-center font-display text-base font-semibold transition-colors sm:flex-none sm:text-lg ${
            activeTab === 'flashcards'
              ? 'border-pulse-600 text-ink-800'
              : 'border-transparent text-ink-400 hover:text-ink-600'
          }`}
        >
          My flashcards <span className="ml-1 font-mono text-xs text-ink-400">({myFlashcardSets.length})</span>
        </button>
      </div>

      {activeTab === 'quizzes' && (
        <div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Link href="/quizzes/bulk-upload">
              <Button size="sm" variant="secondary">Upload many</Button>
            </Link>
            <Link href="/quizzes/new"><Button size="sm">+ New quiz</Button></Link>
          </div>
        <div className="mt-4 space-y-3">
          {deleteError && (
            <p className="rounded-md border border-critical-200 bg-critical-50 px-4 py-3 text-sm text-critical-600">
              {deleteError}
            </p>
          )}
          {myQuizzes.map((quiz) => (
            <Card key={quiz.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium text-ink-800">{quiz.title}</p>
                <p className="text-xs text-ink-400">
                  {quiz.visibility === 'public' ? 'Public' : quiz.visibility === 'guest' ? 'Guest' : 'Private'} · {quiz.questionCount} questions ·{' '}
                  {quiz.attemptCount} attempts
                </p>
                {quiz.visibility === 'private' && quiz.accessMode === 'password' && (
                  <p className="mt-1 font-mono text-xs text-ink-400">
                    /quizzes/shared/{quiz.shareSlug} · password-protected
                  </p>
                )}
                {quiz.visibility === 'private' && quiz.accessMode === 'link' && quiz.shareSlug && (
                  <p className="mt-1 font-mono text-xs text-ink-400">
                    /quizzes/shared/{quiz.shareSlug}
                    {quiz.linkExpiresAt && ` · expires ${new Date(quiz.linkExpiresAt).toLocaleDateString()}`}
                  </p>
                )}

                {accessPickerQuizId === quiz.id && (
                  <div className="mt-3 w-full max-w-lg rounded-lg border border-ink-100 bg-ink-50 p-3">
                    <p className="text-xs font-medium text-ink-700">How should this private link work?</p>
                    <div className="mt-2 flex flex-col gap-2">
                      <label className="flex items-center gap-2 text-sm text-ink-700">
                        <input
                          type="radio"
                          name={`access-mode-${quiz.id}`}
                          checked={accessModeChoice === 'link'}
                          onChange={() => setAccessModeChoice('link')}
                        />
                        Shareable link (expires in 7 days)
                      </label>
                      <label className="flex items-center gap-2 text-sm text-ink-700">
                        <input
                          type="radio"
                          name={`access-mode-${quiz.id}`}
                          checked={accessModeChoice === 'password'}
                          onChange={() => setAccessModeChoice('password')}
                        />
                        Password-protected link (never expires)
                      </label>
                    </div>
                    {accessModeChoice === 'password' && (
                      <input
                        type="password"
                        value={passwordDraft}
                        onChange={(e) => setPasswordDraft(e.target.value)}
                        placeholder="Set a password"
                        className="mt-2 w-full rounded-md border border-ink-200 px-3 py-1.5 text-sm focus:border-pulse-400 focus:outline-none"
                      />
                    )}
                    {accessError && <p className="mt-2 text-xs text-critical-500">{accessError}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => confirmGoPrivate(quiz.id)} disabled={savingAccess}>
                        {savingAccess ? 'Saving…' : 'Make private'}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setAccessPickerQuizId(null);
                          setAccessError(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {passwordChangeQuizId === quiz.id && (
                  <div className="mt-3 w-full max-w-lg rounded-lg border border-ink-100 bg-ink-50 p-3">
                    <p className="text-xs font-medium text-ink-700">Set a new password</p>
                    <p className="mt-1 text-xs text-ink-400">The share link stays the same. Only the password changes.</p>
                    <input
                      type="password"
                      value={passwordDraft}
                      onChange={(e) => setPasswordDraft(e.target.value)}
                      placeholder="New password"
                      className="mt-2 w-full rounded-md border border-ink-200 px-3 py-1.5 text-sm focus:border-pulse-400 focus:outline-none"
                    />
                    {accessError && <p className="mt-2 text-xs text-critical-500">{accessError}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => changePassword(quiz.id)} disabled={savingAccess}>
                        {savingAccess ? 'Saving…' : 'Save password'}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setPasswordChangeQuizId(null);
                          setAccessError(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                <Link href={`/quizzes/${quiz.id}/edit`}>
                  <Button size="sm" variant="secondary">Edit</Button>
                </Link>
                {quiz.visibility === 'public' && (
                  <ShareButton
                    url={typeof window !== 'undefined' ? `${window.location.origin}/quizzes/${quiz.id}` : ''}
                    title={quiz.title}
                    showWhatsApp={false}
                    stats={{
                      questionCount: quiz.questionCount,
                      difficulty: quiz.difficulty,
                      mode: quiz.mode,
                      pricing: quiz.pricing,
                      priceKobo: quiz.priceKobo,
                      categoryName: quiz.categoryName,
                      subcategoryName: quiz.subcategoryName,
                      attemptCount: quiz.attemptCount,
                      averageScorePercent: quiz.averageScorePercent,
                    }}
                  />
                )}
                {quiz.visibility === 'private' && quiz.shareSlug && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => copyShareLink(quiz.id, quiz.shareSlug!)}
                  >
                    {copiedQuizId === quiz.id ? 'Copied!' : 'Copy link'}
                  </Button>
                )}
                {quiz.visibility === 'private' && quiz.accessMode === 'link' && (
                  <Button size="sm" variant="secondary" onClick={() => regenerateLink(quiz.id)}>
                    Regenerate link
                  </Button>
                )}
                {quiz.visibility === 'private' && quiz.accessMode === 'password' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setPasswordChangeQuizId(quiz.id);
                      setPasswordDraft('');
                      setAccessError(null);
                    }}
                  >
                    Change password
                  </Button>
                )}
                {quiz.visibility !== 'public' && (
                  <Button size="sm" variant="secondary" onClick={() => goPublic(quiz.id)}>
                    Make public
                  </Button>
                )}
                {quiz.visibility !== 'private' && (
                  <Button size="sm" variant="secondary" onClick={() => requestGoPrivate(quiz.id)}>
                    Make private
                  </Button>
                )}
                {quiz.visibility !== 'guest' && quiz.pricing !== 'paid' && (
                  <Button size="sm" variant="secondary" onClick={() => moveToGuest(quiz.id)}>
                    Move to Guest
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => deleteQuiz(quiz.id)}
                  disabled={deletingQuizId === quiz.id}
                >
                  {deletingQuizId === quiz.id ? 'Deleting…' : 'Delete'}
                </Button>
              </div>
            </Card>
          ))}
          {myQuizzes.length === 0 && (
            <p className="text-sm text-ink-400">You haven&apos;t created any quizzes yet.</p>
          )}
        </div>

        </div>
      )}

      {activeTab === 'flashcards' && (
        <div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Link href="/flashcards/bulk-upload">
              <Button size="sm" variant="secondary">Upload many</Button>
            </Link>
            <Link href="/flashcards/new"><Button size="sm">+ New flashcard set</Button></Link>
          </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {myFlashcardSets.map((set) => (
            <FlashcardSetCard key={set.id} set={set} />
          ))}
          {myFlashcardSets.length === 0 && (
            <p className="text-sm text-ink-400">You haven&apos;t created any flashcard sets yet.</p>
          )}
        </div>

        </div>
      )}

      {flaggedQuestions.length > 0 && (
        <div className="mt-10">
          <h2 className="font-display text-xl font-semibold text-ink-800">Flagged questions</h2>
          <p className="mt-1 text-sm text-ink-500">
            Quiz-takers flagged these as possibly wrong or unclear. Edit the quiz to fix a question,
            or dismiss the flag if it&apos;s fine as-is.
          </p>
          <div className="mt-4 space-y-3">
            {flaggedQuestions.map((report) => (
              <Card key={report.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-flag-600">
                      {report.quizTitle}
                    </p>
                    <p className="mt-1 text-sm font-medium text-ink-800">{report.questionPrompt}</p>
                    {report.reason && (
                      <p className="mt-1 text-xs text-ink-500">Reason: {report.reason}</p>
                    )}
                    <p className="mt-1 text-xs text-ink-400">
                      Flagged {new Date(report.createdAt).toLocaleDateString()}
                      {report.reporterName && ` by ${report.reporterName}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link href={`/quizzes/${report.quizId}/edit`}>
                      <Button size="sm" variant="secondary">Edit quiz</Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={dismissingReportId === report.id}
                      onClick={() => dismissFlag(report.id, 'dismissed')}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {certificates.length > 0 && (
        <div className="mt-10">
          <h2 className="font-display text-xl font-semibold text-ink-800">Certificates</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {certificates.map((cert) => (
              <Link key={cert.id} href={`/certificates/${cert.id}`}>
                <Card className="p-4 transition-colors hover:bg-ink-50">
                  <p className="font-medium text-ink-800">{cert.quizTitle}</p>
                  <p className="text-xs text-ink-400">
                    Issued {new Date(cert.issuedAt).toLocaleDateString()}
                  </p>
                  <p className="mt-2 text-xs font-medium text-pulse-600">View certificate →</p>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
