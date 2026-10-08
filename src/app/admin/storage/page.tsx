// src/app/admin/storage/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Settings {
  attemptAnswersDays: number;
  emailLogDays: number;
  bannerStatsDays: number;
}

interface Usage {
  attemptAnswers: number;
  attemptAnswersEligible: number;
  quizAttempts: number;
  emailLog: number;
  emailLogEligible: number;
  bannerStatsRows: number;
  legacyBannerEvents: number | null;
}

interface RetentionRun {
  attemptAnswersDeleted: number;
  emailLogDeleted: number;
  bannerStatsDeleted: number;
  complete: boolean;
}

interface OrphanRun {
  dryRun: boolean;
  scanned: number;
  orphaned: number;
  orphanedBytes: number;
  deleted: number;
  skippedTooRecent: number;
  aborted: string | null;
  sampleOrphans: string[];
}

const DEFAULTS: Settings = { attemptAnswersDays: 60, emailLogDays: 365, bannerStatsDays: 0 };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminStoragePage() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [retentionRun, setRetentionRun] = useState<RetentionRun | null>(null);
  const [orphanRun, setOrphanRun] = useState<OrphanRun | null>(null);
  // One clear banner per action so the admin always sees "Done" or an error
  // next to the button they pressed, even when nothing was deleted.
  const [status, setStatus] = useState<{ action: string; kind: 'success' | 'error'; message: string } | null>(null);

  async function load() {
    const res = await fetch('/api/admin/retention');
    if (!res.ok) return;
    const data = await res.json();
    setSettings(data.settings);
    setUsage(data.usage);
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch('/api/admin/retention', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not save.');
        return;
      }
      setSettings(data.settings);
      setSaved(true);
      load();
    } catch {
      setError('Network error while saving. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function run(action: 'retention' | 'orphans-preview' | 'orphans-delete') {
    if (action === 'retention' && !window.confirm('Delete all data older than the windows above now? This cannot be undone.')) return;
    if (action === 'orphans-delete' && !window.confirm('Permanently delete every unused image from storage? Run "Preview" first if you are unsure.')) return;

    setBusy(action);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch('/api/admin/retention/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ action, kind: 'error', message: data.error ?? `Failed (error ${res.status}). Nothing was deleted.` });
        return;
      }

      if (action === 'retention') {
        const r: RetentionRun = data.result;
        setRetentionRun(r);
        const total = r.attemptAnswersDeleted + r.emailLogDeleted + r.bannerStatsDeleted;
        setStatus({
          action,
          kind: 'success',
          message:
            total === 0
              ? 'Done. Nothing to delete, everything is already within the time windows.'
              : `Done. Deleted ${r.attemptAnswersDeleted.toLocaleString()} answer rows, ${r.emailLogDeleted.toLocaleString()} email log rows and ${r.bannerStatsDeleted.toLocaleString()} banner stat rows.` +
                (r.complete ? '' : ' More remains, press the button again to continue.'),
        });
      } else {
        const r: OrphanRun = data.result;
        setOrphanRun(r);
        if (r.aborted) {
          setStatus({ action, kind: 'error', message: r.aborted });
        } else if (action === 'orphans-preview') {
          setStatus({
            action,
            kind: 'success',
            message:
              r.orphaned === 0
                ? `Preview complete. Scanned ${r.scanned.toLocaleString()} images and found no unused ones. Nothing was deleted.`
                : `Preview complete. Found ${r.orphaned.toLocaleString()} unused images (${formatBytes(r.orphanedBytes)}). Nothing was deleted.`,
          });
        } else {
          setStatus({
            action,
            kind: 'success',
            message:
              r.deleted === 0
                ? 'Done. No unused images to delete.'
                : `Done. Deleted ${r.deleted.toLocaleString()} unused images, freed ${formatBytes(r.orphanedBytes)}.`,
          });
        }
      }
      load();
    } catch {
      setStatus({ action, kind: 'error', message: 'Network error. Nothing was deleted. Please try again.' });
    } finally {
      setBusy(null);
    }
  }

  function renderStatus(action: string[]) {
    if (!status || !action.includes(status.action)) return null;
    const ok = status.kind === 'success';
    return (
      <p
        role="status"
        className={`mt-2 rounded-md px-3 py-2 text-sm ${ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-critical-500'}`}
      >
        {ok ? '\u2713 ' : '\u2717 '}
        {status.message}
      </p>
    );
  }

  function numberField(label: string, field: keyof Settings, help: string) {
    return (
      <div>
        <label className="text-sm font-medium text-ink-700">{label}</label>
        <input
          type="number"
          min={0}
          max={3650}
          value={settings[field]}
          onChange={(e: { target: { value: string } }) => setSettings({ ...settings, [field]: Math.max(0, Number(e.target.value) || 0) })}
          className="mt-1 w-32 rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
        />
        <span className="ml-2 text-sm text-ink-500">days</span>
        <p className="mt-1 text-xs text-ink-400">{help}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-800">Storage &amp; Cleanup</h1>
      <p className="mt-2 text-ink-500">
        Keeps the database and image storage from filling up. A scheduled cron job applies these
        windows automatically, on whatever interval it is set to run; the buttons below do the same thing on demand if the cron did not run.
      </p>

      <Card className="mt-6 space-y-5 p-5">
        <h2 className="font-display text-lg font-semibold text-ink-800">How long to keep data</h2>
        {numberField(
          'Quiz answer details',
          'attemptAnswersDays',
          'Per-question answers of past attempts. Scores, the leaderboard, and history are never deleted. 0 keeps forever. Default 60.'
        )}
        {numberField(
          'Email log',
          'emailLogDays',
          'Record of emails sent. Welcome and certificate records are always kept. 0 keeps forever. Default 365.'
        )}
        {numberField(
          'Banner daily stats',
          'bannerStatsDays',
          'Daily impression/click totals. These are tiny, so 0 (keep forever) is fine.'
        )}
        <div>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          {saved && (
            <p role="status" className="mt-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
              {'\u2713'} Saved. Quiz answers older than {settings.attemptAnswersDays === 0 ? '(never deleted)' : `${settings.attemptAnswersDays} days`} will be
              removed on the next cleanup run.
            </p>
          )}
          {error && <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-critical-500">{'\u2717'} {error}</p>}
        </div>
      </Card>

      {usage && (
        <Card className="mt-6 space-y-2 p-5 text-sm text-ink-600">
          <h2 className="font-display text-lg font-semibold text-ink-800">Right now</h2>
          <p>
            Quiz answer details: <strong>{usage.attemptAnswers.toLocaleString()}</strong> rows, of which{' '}
            <strong>{usage.attemptAnswersEligible.toLocaleString()}</strong> are older than the window and will be deleted next run.
          </p>
          <p>Quiz attempts (scores, kept forever): <strong>{usage.quizAttempts.toLocaleString()}</strong></p>
          <p>
            Email log: <strong>{usage.emailLog.toLocaleString()}</strong> rows,{' '}
            <strong>{usage.emailLogEligible.toLocaleString()}</strong> due for deletion.
          </p>
          <p>Banner daily stats: <strong>{usage.bannerStatsRows.toLocaleString()}</strong> rows</p>
          {usage.legacyBannerEvents !== null && usage.legacyBannerEvents > 0 && (
            <p className="text-amber-700">
              The old banner event log still holds {usage.legacyBannerEvents.toLocaleString()} rows. Once your banner
              stats look right, drop it (see the migration file) to free that space.
            </p>
          )}
        </Card>
      )}

      <Card className="mt-6 space-y-3 p-5">
        <h2 className="font-display text-lg font-semibold text-ink-800">Clean up now</h2>
        <div className="space-y-2">
          <p className="text-sm text-ink-500">Delete old data past the windows above.</p>
          <Button size="sm" variant="secondary" onClick={() => run('retention')} disabled={busy !== null}>
            {busy === 'retention' ? 'Cleaning…' : 'Delete old data now'}
          </Button>
          {renderStatus(['retention'])}
        </div>

        <div className="space-y-2 border-t border-ink-100 pt-4">
          <p className="text-sm text-ink-500">
            Find images in storage that no post, resource, banner, scholar, or profile uses. Images uploaded in
            the last 24 hours are always skipped.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => run('orphans-preview')} disabled={busy !== null}>
              {busy === 'orphans-preview' ? 'Scanning…' : 'Preview unused images'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => run('orphans-delete')} disabled={busy !== null}>
              {busy === 'orphans-delete' ? 'Deleting…' : 'Delete unused images'}
            </Button>
          </div>
          {renderStatus(['orphans-preview', 'orphans-delete'])}
          {orphanRun && orphanRun.dryRun && orphanRun.sampleOrphans.length > 0 && (
            <p className="mt-1 break-all text-xs text-ink-400">e.g. {orphanRun.sampleOrphans.join(', ')}</p>
          )}
        </div>
      </Card>

    </div>
  );
}
