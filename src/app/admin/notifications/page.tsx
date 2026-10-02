'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import type { FeatureFlag } from '@/types';

interface NotificationSettings {
  vapid: {
    publicKey: string;
    privateKeyConfigured: boolean;
    privateKeyMasked: string;
    subject: string;
  };
  cron: {
    secretConfigured: boolean;
    secretMasked: string;
  };
}

const PUSH_FLAG_LABELS: Record<string, string> = {
  push_inactivity_nudge: 'Inactivity nudge (3 / 7 / 14 days away)',
  push_comment_reply: 'Comment reply',
  push_daily_quiz: 'Daily quiz reminder',
  push_new_content_category: 'New content in a category you\u2019re active in',
  push_leaderboard_rank_change: 'Leaderboard rank change (entering top 10)',
  push_payout_update: 'Payout sent / purchase made (creators)',
  push_interest_match: 'New job or scholarship posting',
};

type CronJobKey = 'daily-quiz-push' | 'inactivity-nudge';

export default function AdminNotificationsPage() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [publicKeyDraft, setPublicKeyDraft] = useState('');
  const [privateKeyDraft, setPrivateKeyDraft] = useState('');
  const [subjectDraft, setSubjectDraft] = useState('');
  const [cronSecretDraft, setCronSecretDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [pushFlags, setPushFlags] = useState<FeatureFlag[]>([]);

  // ADDED: admin "Run now" for the two cron broadcasts — src/app/admin/notifications/page.tsx
  const [runningJob, setRunningJob] = useState<CronJobKey | null>(null);
  const [runResults, setRunResults] = useState<Record<CronJobKey, string | null>>({
    'daily-quiz-push': null,
    'inactivity-nudge': null,
  });

  useEffect(() => {
    fetch('/api/admin/notifications')
      .then((res) => res.json())
      .then((data: NotificationSettings) => {
        setSettings(data);
        setPublicKeyDraft(data.vapid.publicKey);
        setSubjectDraft(data.vapid.subject);
      });

    fetch('/api/admin/flags')
      .then((res) => res.json())
      .then((data) => {
        const flags: FeatureFlag[] = data.flags ?? [];
        setPushFlags(flags.filter((f) => f.key.startsWith('push_')));
      });
  }, []);

  async function saveNotificationSettings() {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vapid: {
            publicKey: publicKeyDraft,
            // Only sent if the admin typed a new one — blank means "keep existing".
            privateKey: privateKeyDraft || undefined,
            subject: subjectDraft,
          },
          cronSecret: cronSecretDraft || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSettings(data);
        setPrivateKeyDraft('');
        setCronSecretDraft('');
        setSaveMessage('Saved.');
      } else {
        setSaveMessage(data.error || 'Failed to save.');
      }
    } finally {
      setSaving(false);
    }
  }

  // ADDED: admin "Run now" for the two cron broadcasts — src/app/admin/notifications/page.tsx
  // Hits the same cron route's GET handler (admin-session auth'd, see
  // that route's GET export) rather than the x-cron-secret POST path
  // the external scheduler uses — this button is for triggering a
  // one-off send (e.g. to test, or to re-send after fixing something)
  // without needing the cron secret on hand.
  async function runCronJob(key: CronJobKey) {
    setRunningJob(key);
    setRunResults((prev) => ({ ...prev, [key]: null }));
    try {
      const res = await fetch(`/api/cron/${key}`);
      const data = await res.json();
      if (!res.ok) {
        setRunResults((prev) => ({ ...prev, [key]: data.error || 'Failed to run.' }));
        return;
      }
      const parts: string[] = [];
      if (typeof data.sent === 'number') parts.push(`${data.sent} sent`);
      if (typeof data.skipped === 'number') parts.push(`${data.skipped} skipped`);
      if (data.reason) parts.push(data.reason);
      setRunResults((prev) => ({ ...prev, [key]: parts.length ? parts.join(', ') : 'Done.' }));
    } catch {
      setRunResults((prev) => ({ ...prev, [key]: 'Network error — please try again.' }));
    } finally {
      setRunningJob(null);
    }
  }

  async function toggleFlag(key: string, enabled: boolean) {
    const res = await fetch('/api/admin/flags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, enabled }),
    });
    if (res.ok) {
      const data = await res.json();
      const flags: FeatureFlag[] = data.flags ?? [];
      setPushFlags(flags.filter((f) => f.key.startsWith('push_')));
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-800">Push Notifications</h1>
      <p className="mt-2 text-ink-500">
        Configure VAPID keys and the cron shared secret, and turn individual notification types on or off.
      </p>

      <Card className="mt-6 space-y-4 p-5">
        <h2 className="font-medium text-ink-800">VAPID keys</h2>
        <p className="text-sm text-ink-500">
          Generate with <code className="rounded bg-ink-50 px-1">npx web-push generate-vapid-keys</code>. Keys saved
          here take priority; <code className="rounded bg-ink-50 px-1">VAPID_PUBLIC_KEY</code> /{' '}
          <code className="rounded bg-ink-50 px-1">VAPID_PRIVATE_KEY</code> env vars are used as a fallback when
          nothing is saved here.
        </p>

        <div>
          <label className="text-xs font-medium text-ink-600">Public key</label>
          <input
            value={publicKeyDraft}
            onChange={(e) => setPublicKeyDraft(e.target.value)}
            placeholder={settings ? '' : 'Loading…'}
            className="mt-1 w-full rounded-md border border-ink-100 px-3 py-2 font-mono text-xs focus:border-pulse-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-ink-600">
            Private key {settings?.vapid.privateKeyConfigured && (
              <span className="text-ink-400">(currently set: {settings.vapid.privateKeyMasked})</span>
            )}
          </label>
          <input
            value={privateKeyDraft}
            onChange={(e) => setPrivateKeyDraft(e.target.value)}
            placeholder={settings?.vapid.privateKeyConfigured ? 'Leave blank to keep current key' : 'Not set'}
            className="mt-1 w-full rounded-md border border-ink-100 px-3 py-2 font-mono text-xs focus:border-pulse-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-ink-600">Contact subject (mailto: or https:)</label>
          <input
            value={subjectDraft}
            onChange={(e) => setSubjectDraft(e.target.value)}
            placeholder="mailto:support@cliniolab.com"
            className="mt-1 w-full rounded-md border border-ink-100 px-3 py-2 text-sm focus:border-pulse-400 focus:outline-none"
          />
        </div>
      </Card>

      <Card className="mt-4 space-y-4 p-5">
        <h2 className="font-medium text-ink-800">Cron shared secret</h2>
        <p className="text-sm text-ink-500">
          Used by <code className="rounded bg-ink-50 px-1">/api/cron/inactivity-nudge</code> and{' '}
          <code className="rounded bg-ink-50 px-1">/api/cron/daily-quiz-push</code>. Set this to whatever secret you
          configure as the <code className="rounded bg-ink-50 px-1">x-cron-secret</code> header on your cron-job.org
          job — rotate it here any time without redeploying.{' '}
          {settings?.cron.secretConfigured && (
            <span className="text-ink-400">Currently set: {settings.cron.secretMasked}</span>
          )}
        </p>
        <input
          value={cronSecretDraft}
          onChange={(e) => setCronSecretDraft(e.target.value)}
          placeholder={settings?.cron.secretConfigured ? 'Leave blank to keep current secret' : 'Not set'}
          className="mt-1 w-full rounded-md border border-ink-100 px-3 py-2 font-mono text-xs focus:border-pulse-400 focus:outline-none"
        />
      </Card>

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={saveNotificationSettings} disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </Button>
        {saveMessage && <span className="text-sm text-ink-500">{saveMessage}</span>}
      </div>

      {/* ADDED: manual "Run now" for the two cron broadcasts — src/app/admin/notifications/page.tsx */}
      <Card className="mt-4 space-y-4 p-5">
        <h2 className="font-medium text-ink-800">Run a broadcast now</h2>
        <p className="text-sm text-ink-500">
          Triggers the same sweep the external scheduler calls on{' '}
          <code className="rounded bg-ink-50 px-1">/api/cron/daily-quiz-push</code> and{' '}
          <code className="rounded bg-ink-50 px-1">/api/cron/inactivity-nudge</code>, run immediately using your
          admin session instead of the cron secret. Useful for testing, or re-sending after fixing a
          misconfigured quiz — this does not replace the scheduled cron, which keeps running on its own.
        </p>

        <div className="flex items-center justify-between gap-3 rounded-md border border-ink-100 p-4">
          <div>
            <p className="text-sm font-medium text-ink-800">Daily quiz reminder</p>
            <p className="text-xs text-ink-400">Sends to every subscribed user who hasn&apos;t taken today&apos;s quiz.</p>
            {runResults['daily-quiz-push'] && (
              <p className="mt-1 text-xs text-ink-500">{runResults['daily-quiz-push']}</p>
            )}
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => runCronJob('daily-quiz-push')}
            disabled={runningJob !== null}
          >
            {runningJob === 'daily-quiz-push' ? 'Running…' : 'Run now'}
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-md border border-ink-100 p-4">
          <div>
            <p className="text-sm font-medium text-ink-800">Inactivity nudge</p>
            <p className="text-xs text-ink-400">Sends to users inactive for 3, 7, or 14 days.</p>
            {runResults['inactivity-nudge'] && (
              <p className="mt-1 text-xs text-ink-500">{runResults['inactivity-nudge']}</p>
            )}
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => runCronJob('inactivity-nudge')}
            disabled={runningJob !== null}
          >
            {runningJob === 'inactivity-nudge' ? 'Running…' : 'Run now'}
          </Button>
        </div>
      </Card>

      <h2 className="mt-8 font-medium text-ink-800">Notification types</h2>
      <p className="mt-1 text-sm text-ink-500">
        Each toggle turns one notification type on/off sitewide. All are on by default.
      </p>
      <div className="mt-4 space-y-3">
        {pushFlags.map((flag) => (
          <Card key={flag.key} className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-medium text-ink-800">{PUSH_FLAG_LABELS[flag.key] ?? flag.key}</p>
              <p className="font-mono text-xs text-ink-400">{flag.key}</p>
            </div>
            <Toggle checked={flag.enabled} onChange={(v) => toggleFlag(flag.key, v)} />
          </Card>
        ))}
        {pushFlags.length === 0 && (
          <p className="text-sm text-ink-400">
            No push notification flags found yet — run the migration that adds them, then reload this page.
          </p>
        )}
      </div>
    </div>
  );
}
