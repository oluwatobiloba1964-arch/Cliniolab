'use client';
// File: src/components/layout/FeedbackWidget.tsx

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { getSiteWidgets } from '@/lib/client/siteWidgets';
import type { FeedbackCategory } from '@/types';

export function FeedbackWidget() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>('general');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getSiteWidgets()
      .then((data) => setEnabled(data.flags.feedback_widget !== false))
      .catch(() => setEnabled(true));
  }, []);

  async function submit() {
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          message: message.trim(),
          pageUrl: typeof window !== 'undefined' ? window.location.pathname : undefined,
        }),
      });
      if (res.ok) {
        setSubmitted(true);
        setMessage('');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!enabled) return null;

  return (
    <>
      <button
        onClick={() => { setOpen(true); setSubmitted(false); }}
        className="fixed bottom-4 right-4 z-40 rounded-full bg-ink-800 px-4 py-3 text-xs font-medium text-white shadow-lg hover:bg-ink-700"
      >
        Feedback
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/20 p-4 sm:items-center sm:justify-center">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
            {submitted ? (
              <>
                <p className="text-sm font-medium text-ink-800">Thanks for the feedback!</p>
                <Button size="sm" className="mt-4" onClick={() => setOpen(false)}>Close</Button>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-ink-800">Send feedback</p>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
                  className="mt-3 w-full rounded-md border border-ink-100 px-3 py-1.5 text-sm"
                >
                  <option value="general">General</option>
                  <option value="bug">Report a bug</option>
                  <option value="suggestion">Suggestion</option>
                </select>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What's on your mind?"
                  rows={4}
                  className="mt-3 w-full rounded-md border border-ink-100 px-3 py-2 text-sm focus:border-pulse-400 focus:outline-none"
                />
                <div className="mt-3 flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button size="sm" onClick={submit} disabled={submitting || !message.trim()}>
                    {submitting ? 'Sending…' : 'Send'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
