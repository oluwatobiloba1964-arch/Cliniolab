// File: src/components/quiz/QuizStudyToolkit.tsx
/*
 * CHANGE SUMMARY (QuizStudyToolkit.tsx -- NEW FILE)
 * - Per-quiz personal study panel shown at the bottom of the quiz/study screens:
 *   study streak + session counter, a daily session goal with progress bar, a
 *   focus timer (5-60 min, start/pause/reset), free-text personal notes, and
 *   export/restore of notes or a full local backup (as downloadable .txt/.json).
 * - Entirely localStorage-based, keyed per quiz (`cliniolab-local-study-toolkit:
 *   <quizId>`), never calls an API or the database.
 * RENAMED during review: this file was originally named `LocalStudyToolkit.tsx`
 * in the quiz/ folder and exported a component of the same name -- a direct
 * collision with the EXISTING, unrelated `src/components/study/LocalStudyToolkit.tsx`
 * (the account-wide planner already used on the dashboard, with its own separate
 * storage key, tasks, notes and tabs). Both would have compiled fine since they're
 * different import paths, but the duplicate name is confusing and error-prone for
 * future edits. Renamed this new component and its file to `QuizStudyToolkit`
 * (and updated its two callers in QuizRunner.tsx and StudyModeRunner.tsx) to keep
 * the two toolkits clearly distinct: QuizStudyToolkit = one quiz, LocalStudyToolkit
 * = whole account.
 * Reviewed: balanced braces. Approved with the rename.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';

interface QuizStudyToolkitProps {
  quizId: string;
  quizTitle: string;
}

interface LocalStudyData {
  notes: string;
  dailyGoal: number;
  completedSessions: number;
  lastStudyDate: string | null;
  streak: number;
  todaySessions: number;
}

const emptyData: LocalStudyData = {
  notes: '',
  dailyGoal: 20,
  completedSessions: 0,
  lastStudyDate: null,
  streak: 0,
  todaySessions: 0,
};

function dateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function shiftDateKey(key: string, days: number): string {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

export function QuizStudyToolkit({ quizId, quizTitle }: QuizStudyToolkitProps) {
  const storageKey = `cliniolab-local-study-toolkit:${quizId}`;
  const [data, setData] = useState<LocalStudyData>(emptyData);
  const [loadedStorageKey, setLoadedStorageKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerComplete, setTimerComplete] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');

  useEffect(() => {
    setLoadedStorageKey(null);
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) setData({ ...emptyData, ...JSON.parse(saved) });
      else setData(emptyData);
    } catch {
      setData(emptyData);
    } finally {
      setLoadedStorageKey(storageKey);
    }
  }, [storageKey]);

  useEffect(() => {
    if (loadedStorageKey !== storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      // Private browsing or a full storage quota should not interrupt study.
    }
  }, [storageKey, data, loadedStorageKey]);

  useEffect(() => {
    if (!timerRunning) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setTimerRunning(false);
          setTimerComplete(true);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [timerRunning]);

  const today = dateKey();
  const todayGoalProgress = useMemo(() => Math.min(100, Math.round((data.todaySessions / Math.max(1, data.dailyGoal)) * 100)), [data.todaySessions, data.dailyGoal]);

  function logSession() {
    setData((current) => {
      const sameDay = current.lastStudyDate === today;
      const yesterday = current.lastStudyDate === shiftDateKey(today, -1);
      return {
        ...current,
        completedSessions: current.completedSessions + 1,
        todaySessions: sameDay ? current.todaySessions + 1 : 1,
        streak: sameDay ? current.streak : yesterday ? current.streak + 1 : 1,
        lastStudyDate: today,
      };
    });
    setBackupMessage('Study session saved on this device.');
  }

  function exportNotes() {
    const content = `${quizTitle}\nPersonal study notes\n\n${data.notes || 'No notes added yet.'}\n`;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `cliniolab-notes-${quizId}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    setBackupMessage('Notes exported.');
  }

  function exportBackup() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, quizId, quizTitle, data }, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `cliniolab-study-backup-${quizId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setBackupMessage('Local backup exported.');
  }

  async function restoreBackup(file?: File) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed?.version !== 1 || parsed?.quizId !== quizId || !parsed?.data || typeof parsed.data.notes !== 'string') {
        setBackupMessage('This backup does not match the current quiz.');
        return;
      }
      setData({ ...emptyData, ...parsed.data });
      setBackupMessage('Backup restored on this device.');
    } catch {
      setBackupMessage('The selected file is not a valid Cliniolab backup.');
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-ink-100 bg-white shadow-sm" aria-label="Personal study tools">
      <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span>
          <span className="block text-sm font-semibold text-ink-800">Personal study tools</span>
          <span className="mt-0.5 block text-xs text-ink-500">Notes, focus timer, goals and backup. Saved on this device.</span>
        </span>
        <span aria-hidden="true" className="text-lg text-ink-400">{expanded ? '−' : '+'}</span>
      </button>
      {expanded && (
        <div className="border-t border-ink-100 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-pulse-50 p-3">
              <p className="text-xs font-medium text-pulse-700">Study streak</p>
              <p className="mt-1 text-2xl font-semibold text-ink-800">{data.streak} day{data.streak === 1 ? '' : 's'}</p>
            </div>
            <div className="rounded-xl bg-ink-50 p-3">
              <p className="text-xs font-medium text-ink-500">Sessions completed</p>
              <p className="mt-1 text-2xl font-semibold text-ink-800">{data.completedSessions}</p>
            </div>
            <div className="rounded-xl bg-ink-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={`daily-goal-${quizId}`} className="text-xs font-medium text-ink-500">Daily study-session goal</label>
                <select id={`daily-goal-${quizId}`} value={data.dailyGoal} onChange={(event) => setData((current) => ({ ...current, dailyGoal: Number(event.target.value) }))} className="rounded border border-ink-200 bg-white px-2 py-1 text-xs">
                  {[1, 2, 3, 5, 10].map((goal) => <option key={goal} value={goal}>{goal}</option>)}
                </select>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-pulse-500 transition-all" style={{ width: `${todayGoalProgress}%` }} /></div>
              <p className="mt-1 text-xs text-ink-500">{data.todaySessions} of {data.dailyGoal} sessions logged today</p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-ink-100 p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink-800">Focus timer</p>
                <p className="text-xs text-ink-500">A quiet, local timer for focused study sessions.</p>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor={`focus-minutes-${quizId}`} className="text-xs text-ink-500">Duration</label>
                <select id={`focus-minutes-${quizId}`} value={focusMinutes} disabled={timerRunning} onChange={(event) => { const minutes = Number(event.target.value); setFocusMinutes(minutes); setSecondsLeft(minutes * 60); setTimerComplete(false); }} className="rounded-md border border-ink-200 bg-white px-2 py-1.5 text-sm">
                  {[5, 10, 15, 20, 25, 30, 45, 60].map((minutes) => <option key={minutes} value={minutes}>{minutes} min</option>)}
                </select>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-ink-900 px-4 py-4 text-white">
              <div>
                <p className="text-xs uppercase tracking-widest text-white/60">{timerComplete ? 'Session complete' : timerRunning ? 'Focus in progress' : 'Ready when you are'}</p>
                <p className="mt-1 font-mono text-3xl font-semibold tabular-nums">{String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:{String(secondsLeft % 60).padStart(2, '0')}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { if (timerRunning) setTimerRunning(false); else { if (secondsLeft <= 0) setSecondsLeft(focusMinutes * 60); setTimerComplete(false); setTimerRunning(true); } }} className="min-h-10 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-ink-900">{timerRunning ? 'Pause' : 'Start'}</button>
                <button type="button" onClick={() => { setTimerRunning(false); setSecondsLeft(focusMinutes * 60); setTimerComplete(false); }} className="min-h-10 rounded-lg border border-white/25 px-3 py-2 text-sm font-medium text-white">Reset</button>
              </div>
            </div>
            {timerComplete && <p role="status" className="mt-2 text-sm font-medium text-pulse-700">Nice work. Take a short break, then start another session when ready.</p>}
          </div>

          <div className="mt-4">
            <label htmlFor={`personal-notes-${quizId}`} className="block text-sm font-semibold text-ink-800">Personal notes</label>
            <textarea id={`personal-notes-${quizId}`} value={data.notes} onChange={(event) => setData((current) => ({ ...current, notes: event.target.value }))} rows={5} placeholder="Write a reminder, key concept, or topic to revisit..." className="mt-2 w-full rounded-xl border border-ink-200 bg-white px-3 py-3 text-sm leading-6 text-ink-700 outline-none transition focus:border-pulse-400 focus:ring-2 focus:ring-pulse-100" />
            <p className="mt-1 text-xs text-ink-400">Notes are stored in this browser for this quiz. They are not uploaded or synced to other devices.</p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={logSession} className="min-h-10 rounded-lg bg-pulse-600 px-3 py-2 text-sm font-semibold text-white hover:bg-pulse-700">Log study session</button>
            <button type="button" onClick={exportNotes} className="min-h-10 rounded-lg border border-ink-200 px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50">Export notes</button>
            <button type="button" onClick={exportBackup} className="min-h-10 rounded-lg border border-ink-200 px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50">Export backup</button>
            <label className="inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-ink-200 px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50">Restore backup<input type="file" accept="application/json,.json" className="sr-only" onChange={(event) => { void restoreBackup(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label>
          </div>
          {backupMessage && <p role="status" className="mt-3 text-xs text-ink-500">{backupMessage}</p>}
        </div>
      )}
    </section>
  );
}
