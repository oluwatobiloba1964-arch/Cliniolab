// src/app/dashboard/page.tsx
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

      {user.currentStreakDays > 0 && (
        <Card className="mt-6 flex items-center gap-4 p-5">
          <span className="font-mono text-3xl font-semibold text-flag-500">🔥 {user.currentStreakDays}</span>
          <div>
            <p className="text-sm font-medium text-ink-800">day streak</p>
            <p className="text-xs text-ink-400">Longest: {user.longestStreakDays} days</p>
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
