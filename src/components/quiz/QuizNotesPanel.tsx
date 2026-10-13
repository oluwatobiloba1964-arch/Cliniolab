// src/components/quiz/QuizNotesPanel.tsx
'use client';

import { useEffect, useState } from 'react';
import { QUIZ_NOTES_KEY, readJson, writeJson } from '@/lib/services/localExtrasService';

export function QuizNotesPanel({ quizId }: { quizId: string }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const map = readJson<Record<string, string>>(QUIZ_NOTES_KEY, {});
    setNotes(map[quizId] ?? '');
  }, [quizId]);

  function save() {
    const map = readJson<Record<string, string>>(QUIZ_NOTES_KEY, {});
    map[quizId] = notes;
    writeJson(QUIZ_NOTES_KEY, map);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="mt-6 rounded-xl border border-ink-100 bg-ink-50/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink-800">My notes on this quiz</p>
          <p className="mt-1 text-xs text-ink-500">Stored only in this browser.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-600 hover:border-pulse-300 hover:text-pulse-700"
        >
          {open ? 'Hide' : 'Open'}
        </button>
      </div>
      {open && (
        <div className="mt-3">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Reminders, mnemonics, or things you want to check."
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
          />
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              className="rounded-lg bg-pulse-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Save note
            </button>
            {saved && <span className="text-xs font-semibold text-pulse-600">Saved</span>}
          </div>
        </div>
      )}
    </div>
  );
}
