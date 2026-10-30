'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const DEFAULT_SIZE = 10;

export default function AdminLeaderboardPage() {
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/leaderboard-size')
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.leaderboardSize === 'number') setSize(data.leaderboardSize);
      });
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch('/api/admin/leaderboard-size', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaderboardSize: size }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not save.');
        return;
      }
      setSaved(true);
    } catch {
      setError('Network error while saving. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-800">Leaderboard</h1>
      <p className="mt-2 text-ink-500">
        Controls how many names show on every leaderboard across the site: the general
        site-wide leaderboard, category leaderboards, and per-quiz leaderboards all use this
        same number.
      </p>

      <Card className="mt-6 space-y-4 p-5">
        <div>
          <label className="text-sm font-medium text-ink-700">Number of entries to show</label>
          <input
            type="number"
            min={3}
            max={100}
            value={size}
            onChange={(e) => setSize(Math.min(100, Math.max(3, Number(e.target.value) || DEFAULT_SIZE)))}
            className="mt-1 w-32 rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
          />
          <p className="mt-1 text-xs text-ink-400">Between 3 and 100. Defaults to 10.</p>
        </div>
      </Card>

      <Button className="mt-6" size="sm" onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </Button>
      {saved && <span className="ml-3 text-xs text-pulse-600">Saved</span>}
      {error && <p className="mt-3 text-sm text-critical-500">{error}</p>}
    </div>
  );
}
