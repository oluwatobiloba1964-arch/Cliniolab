'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import type { QuizWithStats } from '@/types';
import { useConfirm } from '@/components/ui/ToastProvider';

const PAGE_SIZE = 20;

export default function AdminQuizzesPage() {
  const { confirm } = useConfirm();
  const [quizzes, setQuizzes] = useState<QuizWithStats[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load(targetPage = page) {
    setLoading(true);
    fetch(`/api/admin/quizzes?page=${targetPage}&pageSize=${PAGE_SIZE}`)
      .then((res) => res.json())
      .then((data) => {
        setQuizzes(data.quizzes ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function deleteQuiz(id: string) {
    const ok = await confirm({
          title: 'Delete this quiz permanently?',
          message: 'This cannot be undone.',
          confirmLabel: 'Delete',
          destructive: true,
        });
        if (!ok) return;
    setError(null);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/quizzes/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Failed to delete quiz (${res.status})`);
        return;
      }
      // If we just deleted the last item on this page (and it's not page
      // 1), step back a page so the view doesn't show an empty list.
      if (quizzes.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        load(page);
      }
    } catch {
      setError('Network error while deleting. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-800">All quizzes</h1>
      {error && (
        <p className="mt-4 rounded-md border border-critical-200 bg-critical-50 px-4 py-3 text-sm text-critical-600">
          {error}
        </p>
      )}
      <div className="mt-6 space-y-3">
        {loading && quizzes.length === 0 && <p className="text-sm text-ink-400">Loading…</p>}
        {quizzes.map((quiz) => (
          <Card key={quiz.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-medium text-ink-800">{quiz.title}</p>
              <p className="text-xs text-ink-400">
                {quiz.status} · {quiz.visibility} · {quiz.mode} · {quiz.questionCount} questions ·{' '}
                {quiz.attemptCount} attempts
              </p>
            </div>
            <Button
              size="sm"
              variant="danger"
              onClick={() => deleteQuiz(quiz.id)}
              disabled={deletingId === quiz.id}
            >
              {deletingId === quiz.id ? 'Deleting…' : 'Delete'}
            </Button>
          </Card>
        ))}
        {!loading && quizzes.length === 0 && <p className="text-sm text-ink-400">No quizzes yet.</p>}
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} className="mt-8" />
    </div>
  );
}
