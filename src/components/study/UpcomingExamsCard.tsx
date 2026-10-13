// src/components/study/UpcomingExamsCard.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { EXAMS_KEY, makeId, readJson, todayKey, writeJson } from '@/lib/services/localExtrasService';

interface ExamEntry {
  id: string;
  name: string;
  date: string;
  subjects: string;
  createdAt: string;
}

function daysUntil(dateStr: string): number | null {
  const target = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  return diff;
}

export function UpcomingExamsCard() {
  const [exams, setExams] = useState<ExamEntry[]>([]);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [subjects, setSubjects] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setExams(readJson<ExamEntry[]>(EXAMS_KEY, []));
  }, []);

  function persist(next: ExamEntry[]) {
    setExams(next);
    writeJson(EXAMS_KEY, next);
  }

  function addExam() {
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Give this exam a name.');
      return;
    }
    if (!date) {
      setError('Pick a date.');
      return;
    }
    const entry: ExamEntry = {
      id: makeId(),
      name: trimmedName,
      date,
      subjects: subjects.trim(),
      createdAt: new Date().toISOString(),
    };
    const next = [...exams, entry].sort((a, b) => a.date.localeCompare(b.date));
    persist(next);
    setName('');
    setDate('');
    setSubjects('');
  }

  function remove(id: string) {
    persist(exams.filter((e) => e.id !== id));
  }

  const nextExam = useMemo(() => {
    const today = todayKey();
    return exams.find((e) => e.date >= today) ?? null;
  }, [exams]);

  const nextDays = nextExam ? daysUntil(nextExam.date) : null;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pulse-600">
            On this device
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-ink-900">
            Exam countdown
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            Track the exams you are working towards. Nothing leaves this device.
          </p>
        </div>
        {nextExam && nextDays !== null && (
          <div className="rounded-2xl border border-pulse-100 bg-pulse-50 px-4 py-3 text-center">
            <p className="font-mono text-2xl font-semibold text-pulse-700">
              {nextDays < 0 ? 'Past' : nextDays}
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-pulse-700">
              {nextDays === 1 ? 'day left' : nextDays < 0 ? 'date passed' : 'days left'}
            </p>
          </div>
        )}
      </div>

      {nextExam && (
        <div className="mt-4 rounded-xl border border-ink-100 bg-white p-4">
          <p className="font-semibold text-ink-800">{nextExam.name}</p>
          <p className="mt-1 text-xs text-ink-500">
            {new Date(`${nextExam.date}T00:00:00`).toLocaleDateString()}
          </p>
          {nextExam.subjects && (
            <p className="mt-2 text-xs text-ink-600">Focus: {nextExam.subjects}</p>
          )}
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {exams.map((exam) => (
          <li
            key={exam.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-ink-100 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink-800">{exam.name}</p>
              <p className="text-xs text-ink-500">
                {new Date(`${exam.date}T00:00:00`).toLocaleDateString()}
                {exam.subjects ? ` · ${exam.subjects}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => remove(exam.id)}
              className="rounded-md border border-ink-200 px-2.5 py-1 text-xs font-semibold text-ink-500 hover:border-red-300 hover:text-red-600"
            >
              Remove
            </button>
          </li>
        ))}
        {exams.length === 0 && (
          <li className="rounded-lg border border-dashed border-ink-200 p-4 text-sm text-ink-500">
            No exams added yet. Add one below to see a countdown.
          </li>
        )}
      </ul>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Exam name"
          className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
        <input
          value={subjects}
          onChange={(e) => setSubjects(e.target.value)}
          placeholder="Focus subjects"
          className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <button
        type="button"
        onClick={addExam}
        className="mt-3 rounded-lg bg-pulse-600 px-4 py-2 text-sm font-semibold text-white hover:bg-pulse-700"
      >
        Add exam
      </button>
    </Card>
  );
}
