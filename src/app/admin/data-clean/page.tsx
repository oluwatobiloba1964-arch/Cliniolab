'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { DataCleanTarget } from '@/types';

/** Admin Data Clean: shows what can be removed, saves age windows, and supports one-click general cleanup. */
export default function DataCleanPage() {
  const [targets, setTargets] = useState<DataCleanTarget[] | null>(null);
  const [days, setDays] = useState<Record<string, number>>({});
  const [savedDays, setSavedDays] = useState<Record<string, number>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/admin/data-clean', { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    const nextDays: Record<string, number> = {};
    for (const t of data.targets as DataCleanTarget[]) nextDays[t.key] = t.defaultOlderThanDays;
    setTargets(data.targets);
    setDays(nextDays);
    setSavedDays(nextDays);
  }

  useEffect(() => {
    load();
  }, []);

  const dirty = useMemo(() => JSON.stringify(days) !== JSON.stringify(savedDays), [days, savedDays]);
  const cleanableTotal = useMemo(() => (targets ?? []).reduce((sum, t) => sum + t.cleanableCount, 0), [targets]);

  async function saveSettings() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/data-clean', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: days }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? 'Could not save cleanup dates.');
        return;
      }
      setSavedDays(data.settings);
      setDays(data.settings);
      setMessage('Cleanup dates saved.');
      await load();
    } catch {
      setMessage('Network error while saving cleanup dates.');
    } finally {
      setSaving(false);
    }
  }

  async function clean(key: string) {
    if (key === 'open_reports') {
      const age = days[key] ?? 180;
      if (!window.confirm(`Remove unresolved question reports older than ${age} days? The questions themselves will not be deleted.`)) return;
    }

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
        setMessage(`Removed ${Number(data.deleted ?? 0).toLocaleString()} row(s).`);
        await load();
      } else {
        setMessage(data.error ?? 'Clean failed');
      }
    } catch {
      setMessage('Network error. Nothing was deleted.');
    } finally {
      setBusyKey(null);
    }
  }

  async function cleanAll() {
    if (dirty) {
      setMessage('Save the cleanup dates first, then use Clear all.');
      return;
    }
    if (!cleanableTotal) {
      setMessage('Nothing is currently cleanable.');
      return;
    }
    if (
      !window.confirm(
        `Clear all ${cleanableTotal.toLocaleString()} currently cleanable rows using the saved windows? This includes stale unresolved question reports. This cannot be undone.`
      )
    ) return;

    setBusyKey('all');
    setMessage(null);
    try {
      const res = await fetch('/api/admin/data-clean', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'all' }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`General cleanup complete. Removed ${Number(data.deleted ?? 0).toLocaleString()} row(s).${data.hasMore ? ' More remains; press Clear all again to continue.' : ''}`);
        await load();
      } else {
        setMessage(data.error ?? 'General cleanup failed');
      }
    } catch {
      setMessage('Network error. Nothing was deleted.');
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-800">Data Clean</h1>
          <p className="mt-2 max-w-3xl text-sm text-ink-500">
            Safe, on-demand cleanup for expired throttle rows, anonymous Guest Practice counters, resolved and stale
            unresolved question reports, resolved feedback, unused contributors, and abandoned private quizzes. This
            does not touch quiz attempts, purchases, or user accounts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={saving || !dirty} onClick={saveSettings}>
            {saving ? 'Saving…' : 'Save cleanup dates'}
          </Button>
          <Button size="sm" variant="danger" disabled={busyKey !== null || saving || dirty || cleanableTotal === 0} onClick={cleanAll}>
            {busyKey === 'all' ? 'Clearing…' : 'Clear all cleanable data'}
          </Button>
        </div>
      </div>

      {message && <p role="status" className="mt-3 text-sm text-pulse-600">{message}</p>}

      <div className="mt-6 space-y-3">
        {targets?.map((t) => {
          const ageEditable = t.key !== 'expired_rate_limits' && t.key !== 'guest_counters';
          return (
            <Card key={t.key} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink-800">{t.label}</p>
                  <p className="mt-0.5 text-xs text-ink-500">{t.description}</p>
                  <p className="mt-1 font-mono text-xs text-ink-400">
                    {t.rowCount.toLocaleString()} total · {t.cleanableCount.toLocaleString()} cleanable now
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {ageEditable ? (
                    <label className="flex items-center gap-1 text-xs text-ink-500">
                      Older than
                      <input
                        type="number"
                        min={0}
                        max={3650}
                        value={days[t.key] ?? t.defaultOlderThanDays}
                        onChange={(e) => setDays((d) => ({ ...d, [t.key]: Math.max(0, Math.min(3650, Number(e.target.value) || 0)) }))}
                        className="w-20 rounded-md border border-ink-100 px-2 py-1"
                      />
                      days
                    </label>
                  ) : (
                    <span className="text-xs text-ink-400">No age filter</span>
                  )}
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busyKey !== null || t.cleanableCount === 0 || (ageEditable && dirty)}
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
