'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';

const STORAGE_KEY = 'cliniolab_local_study_toolkit_v1';
type Task = { id: string; text: string; done: boolean; date: string };
type Note = { id: string; title: string; body: string; updatedAt: string };
type ToolkitData = { tasks: Task[]; notes: Note[]; dailyGoalMinutes: number; studyDays: string[]; minutesByDay: Record<string, number>; savedTopics?: Array<{ id: string; title: string; href: string; savedAt: string }>; articleStudyProgress?: Record<string, { understood: boolean; reviewedAt?: string }>; topicStatuses?: Record<string, 'not-started' | 'studying' | 'understood' | 'revise'> };
const emptyData: ToolkitData = { tasks: [], notes: [], dailyGoalMinutes: 30, studyDays: [], minutesByDay: {} };
const todayKey = () => new Date().toLocaleDateString('en-CA');
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Browser-only study planner, notes, timer and progress. Never calls an API or database. */
export function LocalStudyToolkit() {
  const [data, setData] = useState<ToolkitData>(emptyData);
  const [ready, setReady] = useState(false);
  const [taskText, setTaskText] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [minutes, setMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'plan' | 'notes' | 'timer' | 'progress'>('plan');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ToolkitData>;
        setData({ ...emptyData, ...parsed, tasks: parsed.tasks ?? [], notes: parsed.notes ?? [], minutesByDay: parsed.minutesByDay ?? {}, studyDays: parsed.studyDays ?? [] });
      }
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  }, [data, ready]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!running || secondsLeft !== 0) return;
    setRunning(false);
    setData((prev) => {
      const day = todayKey();
      const total = (prev.minutesByDay[day] ?? 0) + minutes;
      return { ...prev, studyDays: Array.from(new Set([...prev.studyDays, day])), minutesByDay: { ...prev.minutesByDay, [day]: total } };
    });
  }, [running, secondsLeft, minutes]);

  const today = todayKey();
  const todayMinutes = data.minutesByDay[today] ?? 0;
  const completedTasks = data.tasks.filter((task) => task.done && task.date === today).length;
  const pendingTasks = data.tasks.filter((task) => !task.done && task.date === today);
  const totalStudyMinutes = Object.values(data.minutesByDay).reduce((sum, value) => sum + value, 0);
  const streak = useMemo(() => {
    const days = new Set(data.studyDays);
    const cursor = new Date();
    if (!days.has(todayKey())) cursor.setDate(cursor.getDate() - 1);
    let count = 0;
    while (days.has(cursor.toLocaleDateString('en-CA'))) { count++; cursor.setDate(cursor.getDate() - 1); }
    return count;
  }, [data.studyDays]);

  function addTask() {
    const text = taskText.trim();
    if (!text) return;
    setData((prev) => ({ ...prev, tasks: [{ id: uid(), text, done: false, date: today }, ...prev.tasks].slice(0, 100) }));
    setTaskText('');
  }

  function addNote() {
    const body = noteBody.trim();
    if (!body) return;
    setData((prev) => ({ ...prev, notes: [{ id: uid(), title: noteTitle.trim() || 'Study note', body, updatedAt: new Date().toISOString() }, ...prev.notes].slice(0, 50) }));
    setNoteTitle(''); setNoteBody('');
  }

  function changeGoal(value: number) {
    setData((prev) => ({ ...prev, dailyGoalMinutes: Math.max(5, Math.min(600, value || 30)) }));
  }

  return (
    <section className="mt-8" aria-labelledby="local-study-toolkit-heading">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pulse-600">Private study tools</p>
        <h2 id="local-study-toolkit-heading" className="mt-1 font-display text-xl font-semibold text-ink-900">Your study space</h2>
        <p className="mt-1 text-sm text-ink-500">Plan revision, save personal notes and focus with a timer. Stored on your device.</p>
      </div>
      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-2 gap-px bg-ink-100 sm:grid-cols-4">
          {([['plan', 'Study plan'], ['notes', `Notes (${data.notes.length})`], ['timer', 'Focus timer'], ['progress', 'Progress']] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setActiveTab(key)} aria-pressed={activeTab === key} className={`px-3 py-3 text-sm font-semibold transition ${activeTab === key ? 'bg-white text-pulse-700' : 'bg-ink-50 text-ink-500 hover:bg-white'}`}>{label}</button>
          ))}
        </div>
        <div className="p-4 sm:p-6">
          {activeTab === 'plan' && <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-sm font-semibold text-ink-800">Today's goal</p><p className="text-xs text-ink-500">{todayMinutes} of {data.dailyGoalMinutes} minutes studied</p></div>
              <label className="flex items-center gap-2 text-xs text-ink-500">Goal <input aria-label="Daily study goal in minutes" type="number" min={5} max={600} value={data.dailyGoalMinutes} onChange={(e) => changeGoal(Number(e.target.value))} className="w-20 rounded-md border border-ink-200 px-2 py-1.5 text-sm text-ink-800" /> min</label>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-pulse-500 transition-all" style={{ width: `${Math.min(100, todayMinutes / Math.max(1, data.dailyGoalMinutes) * 100)}%` }} /></div>
            <form className="mt-5 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); addTask(); }}><input value={taskText} onChange={(e) => setTaskText(e.target.value)} placeholder="Add a topic to revise today" aria-label="New study task" className="min-w-0 flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm" /><button className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Add task</button></form>
            <ul className="mt-3 space-y-2">{data.tasks.filter((task) => task.date === today).map((task) => <li key={task.id} className="flex items-center gap-3 rounded-lg border border-ink-100 px-3 py-2"><input type="checkbox" checked={task.done} onChange={(e) => setData((prev) => ({ ...prev, tasks: prev.tasks.map((item) => item.id === task.id ? { ...item, done: e.target.checked } : item) }))} aria-label={`Mark ${task.text} complete`} /><span className={`flex-1 text-sm ${task.done ? 'text-ink-400 line-through' : 'text-ink-700'}`}>{task.text}</span><button type="button" onClick={() => setData((prev) => ({ ...prev, tasks: prev.tasks.filter((item) => item.id !== task.id) }))} className="text-xs text-ink-400 hover:text-critical-600">Remove</button></li>)}</ul>
            {pendingTasks.length === 0 && <p className="mt-3 text-xs text-ink-400">No pending tasks for today. Add a topic above to plan your next session.</p>}
          </div>}
          {activeTab === 'notes' && <div>
            <form onSubmit={(e) => { e.preventDefault(); addNote(); }} className="space-y-2"><input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="Note title (optional)" aria-label="Study note title" className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm" /><textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Write a clinical concept, formula, reminder or revision point..." aria-label="Study note content" rows={3} className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm" /><button className="rounded-lg bg-pulse-600 px-4 py-2 text-sm font-semibold text-white hover:bg-pulse-700">Save note on this device</button></form>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">{data.notes.map((note) => <article key={note.id} className="rounded-xl border border-ink-100 p-3"><div className="flex items-start justify-between gap-2"><h3 className="text-sm font-semibold text-ink-800">{note.title}</h3><button type="button" onClick={() => setData((prev) => ({ ...prev, notes: prev.notes.filter((item) => item.id !== note.id) }))} className="text-xs text-ink-400 hover:text-critical-600">Delete</button></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-600">{note.body}</p><p className="mt-2 text-[10px] text-ink-400">Saved {new Date(note.updatedAt).toLocaleString()}</p></article>)}</div>
            {data.notes.length === 0 && <p className="mt-4 text-sm text-ink-400">Your personal study notes will appear here.</p>}
          </div>}
          {activeTab === 'timer' && <div className="mx-auto max-w-md text-center"><p className="text-sm font-semibold text-ink-700">Focus session</p><div className="my-4 font-mono text-5xl font-semibold tracking-tight text-ink-900" role="timer" aria-live="off">{String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:{String(secondsLeft % 60).padStart(2, '0')}</div><label className="inline-flex items-center gap-2 text-sm text-ink-500">Session length <select disabled={running} value={minutes} onChange={(e) => { const value = Number(e.target.value); setMinutes(value); setSecondsLeft(value * 60); }} className="rounded-md border border-ink-200 bg-white px-2 py-1.5"><option value={5}>5 min</option><option value={10}>10 min</option><option value={15}>15 min</option><option value={25}>25 min</option><option value={45}>45 min</option><option value={60}>60 min</option></select></label><div className="mt-4 flex justify-center gap-2"><button type="button" onClick={() => setRunning((value) => !value)} disabled={secondsLeft === 0} className="rounded-lg bg-pulse-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{running ? 'Pause' : 'Start focus'}</button><button type="button" onClick={() => { setRunning(false); setSecondsLeft(minutes * 60); }} className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700">Reset</button></div><p className="mt-3 text-xs text-ink-400">Completed sessions count toward your local daily study total. Leaving this page pauses the timer.</p></div>}
          {activeTab === 'progress' && <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-ink-50 p-4"><p className="text-xs text-ink-500">Study streak</p><p className="mt-1 text-2xl font-semibold text-ink-900">{streak} day{streak === 1 ? '' : 's'}</p></div><div className="rounded-xl bg-ink-50 p-4"><p className="text-xs text-ink-500">Total focus time</p><p className="mt-1 text-2xl font-semibold text-ink-900">{Math.floor(totalStudyMinutes / 60)}h {totalStudyMinutes % 60}m</p></div><div className="rounded-xl bg-ink-50 p-4"><p className="text-xs text-ink-500">Tasks completed today</p><p className="mt-1 text-2xl font-semibold text-ink-900">{completedTasks}</p></div><div className="rounded-xl border border-pulse-100 bg-pulse-50 p-4 sm:col-span-3"><p className="text-sm font-semibold text-pulse-800">Milestones</p><p className="mt-1 text-sm text-pulse-700">{totalStudyMinutes >= 300 ? '5-hour focus milestone unlocked.' : totalStudyMinutes >= 60 ? 'First hour of focus completed.' : 'Complete your first focus session to start building your study record.'}</p><p className="mt-1 text-xs text-pulse-700">Stored on your device. It does not sync across devices or accounts.</p></div></div>}
        </div>
      </Card>
    </section>
  );
}
