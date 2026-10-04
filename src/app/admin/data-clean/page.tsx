// src/app/admin/data-clean/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { DataCleanTarget } from '@/types';

/** Admin Data Clean: shows how much of each removable thing exists, and cleans it on demand. */
export default function DataCleanPage() {
  const [targets, setTargets] = useState<DataCleanTarget[] | null>(null);
  // Committed ages (what counts were fetched with) vs. the input's draft value,
  // so typing doesn't refetch on every keystroke/blur — only "Save" does.
  const [days, setDays] = useState<Record<string, number>>({});
  const [draftDays, setDraftDays] = useState<Record<string, number>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [allBusy, setAllBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load(withDays: Record<string, number> = days) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(withDays)) params.set(`days.${key}`, String(value));
    const res = await fetch(`/api/admin/data-clean?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setTargets(data.targets);
      const nextDays: Record<string, number> = {};
      for (const t of data.targets as DataCleanTarget[]) {
        if (withDays[t.key] === undefined) nextDays[t.key] = t.defaultOlderThanDays;
      }
      if (Object.keys(nextDays).length) {
        setDays((d) => ({ ...d, ...nextDays }));
        setDraftDays((d) => ({ ...d, ...nextDays }));
      }
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function saveDays(key: string) {
    const next = { ...days, [key]: draftDays[key] };
    setDays(next);
    load(next);
  }

  async function clean(key: string) {
    setBusyKey(key);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/data-clean', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, olderThanDays: days[key] }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Removed ${data.deleted} row(s).`);
        await load();
      } else {
        setMessage(data.error ?? 'Clean failed');
      }
    } finally {
      setBusyKey(null);
    }
  }

  async function cleanAll() {
    if (!window.confirm('Clean every target now? This runs all cleanups at once using the ages shown below.')) return;
    setAllBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/data-clean', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'all', days }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Removed ${data.deleted} row(s) across all targets.`);
        await load();
      } else {
        setMessage(data.error ?? 'Clean failed');
      }
    } finally {
      setAllBusy(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-800">Data Clean</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-500">
        Safe, on-demand cleanup for expired throttle rows, anonymous Guest Practice counters, resolved reports and
        feedback, unused contributors, and abandoned private quizzes. This does not touch quiz attempts, purchases,
        or user accounts — see Storage &amp; Cleanup for retention on those.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button size="sm" variant="danger" disabled={allBusy || busyKey !== null} onClick={cleanAll}>
          {allBusy ? 'Cleaning everything…' : 'Clean all now'}
        </Button>
        <span className="text-xs text-ink-400">Runs every target below at once, using the ages shown.</span>
      </div>

      {message && <p className="mt-3 text-sm text-pulse-600">{message}</p>}

      <div className="mt-6 space-y-3">
        {targets?.map((t) => {
          const dirty = draftDays[t.key] !== days[t.key];
          return (
            <Card key={t.key} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-ink-800">{t.label}</p>
                  <p className="mt-0.5 text-xs text-ink-500">{t.description}</p>
                  <p className="mt-1 font-mono text-xs text-ink-400">
                    {t.rowCount} total · {t.cleanableCount} cleanable now
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-xs text-ink-500">
                    Older than
                    <input
                      type="number"
                      min={0}
                      max={3650}
                      value={draftDays[t.key] ?? t.defaultOlderThanDays}
                      onChange={(e) => setDraftDays((d) => ({ ...d, [t.key]: Number(e.target.value) }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveDays(t.key);
                      }}
                      className="w-16 rounded-md border border-ink-100 px-2 py-1"
                    />
                    days
                  </label>
                  <Button size="sm" variant="secondary" disabled={!dirty} onClick={() => saveDays(t.key)}>
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busyKey === t.key || allBusy || t.cleanableCount === 0}
                    onClick={() => clean(t.key)}
                  >
                    {busyKey === t.key ? 'Cleaning…' : 'Clean now'}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
