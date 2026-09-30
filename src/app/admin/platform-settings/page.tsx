'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import type { AuthorBoxSetting, GuestPracticeSetting, OfflineSetting, ThemeSetting } from '@/types';

/** Admin controls for Guest Practice, default theme, offline downloads and the author/reviewer box. */
export default function PlatformSettingsPage() {
  const [guest, setGuest] = useState<GuestPracticeSetting | null>(null);
  const [theme, setTheme] = useState<ThemeSetting | null>(null);
  const [offline, setOffline] = useState<OfflineSetting | null>(null);
  const [authorBox, setAuthorBox] = useState<AuthorBoxSetting | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/platform-settings')
      .then((res) => res.json())
      .then((data) => {
        setGuest(data.guest);
        setTheme(data.theme);
        setOffline(data.offline);
        setAuthorBox(data.authorBox);
      });
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/platform-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest, theme, offline, authorBox }),
      });
      if (res.ok) setMessage('Saved.');
      else setMessage((await res.json()).error ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (!guest || !theme || !offline || !authorBox) return null;

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-semibold text-ink-800">Guest, Theme & Offline</h1>
      {message && <p className="mt-2 text-sm text-pulse-600">{message}</p>}

      <Card className="mt-6 space-y-4 p-5">
        <h2 className="font-semibold text-ink-800">Guest Practice</h2>
        <label className="block text-sm text-ink-700">
          Section title
          <input
            value={guest.sectionTitle}
            onChange={(e) => setGuest({ ...guest, sectionTitle: e.target.value })}
            className="mt-1 w-full rounded-md border border-ink-100 px-3 py-2"
          />
        </label>
        <label className="block text-sm text-ink-700">
          Subtitle
          <input
            value={guest.sectionSubtitle}
            onChange={(e) => setGuest({ ...guest, sectionSubtitle: e.target.value })}
            className="mt-1 w-full rounded-md border border-ink-100 px-3 py-2"
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm text-ink-700">
            Homepage items
            <input
              type="number"
              min={3}
              max={30}
              value={guest.homepageCount}
              onChange={(e) => setGuest({ ...guest, homepageCount: Number(e.target.value) })}
              className="mt-1 w-full rounded-md border border-ink-100 px-3 py-2"
            />
          </label>
          <label className="text-sm text-ink-700">
            Autoplay interval (seconds)
            <input
              type="number"
              min={2}
              max={30}
              value={guest.intervalSeconds}
              onChange={(e) => setGuest({ ...guest, intervalSeconds: Number(e.target.value) })}
              className="mt-1 w-full rounded-md border border-ink-100 px-3 py-2"
            />
          </label>
        </div>
        <Toggle checked={guest.autoplay} onChange={(v) => setGuest({ ...guest, autoplay: v })} label="Autoplay carousel" />
        <Toggle
          checked={guest.includeInSitemap}
          onChange={(v) => setGuest({ ...guest, includeInSitemap: v })}
          label="Include guest items in sitemap"
        />
        <label className="block text-sm text-ink-700">
          Who can publish to Guest
          <select
            value={guest.creatorAccess}
            onChange={(e) => setGuest({ ...guest, creatorAccess: e.target.value as GuestPracticeSetting['creatorAccess'] })}
            className="mt-1 w-full rounded-md border border-ink-100 px-3 py-2"
          >
            <option value="all">All quiz/set creators</option>
            <option value="admin_moderator">Admins and moderators</option>
            <option value="admin_only">Admins only</option>
          </select>
        </label>
      </Card>

      <Card className="mt-6 space-y-4 p-5">
        <h2 className="font-semibold text-ink-800">Default theme</h2>
        <select
          value={theme.defaultTheme}
          onChange={(e) => setTheme({ defaultTheme: e.target.value as ThemeSetting['defaultTheme'] })}
          className="w-full rounded-md border border-ink-100 px-3 py-2"
        >
          <option value="system">Follow device (System)</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </Card>

      <Card className="mt-6 space-y-4 p-5">
        <h2 className="font-semibold text-ink-800">Offline downloads</h2>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm text-ink-700">
            Max items per device
            <input
              type="number"
              min={1}
              max={100}
              value={offline.maxItems}
              onChange={(e) => setOffline({ ...offline, maxItems: Number(e.target.value) })}
              className="mt-1 w-full rounded-md border border-ink-100 px-3 py-2"
            />
          </label>
          <label className="text-sm text-ink-700">
            Refresh reminder (days)
            <input
              type="number"
              min={1}
              max={90}
              value={offline.refreshDays}
              onChange={(e) => setOffline({ ...offline, refreshDays: Number(e.target.value) })}
              className="mt-1 w-full rounded-md border border-ink-100 px-3 py-2"
            />
          </label>
        </div>
        <Toggle
          checked={offline.allowPaid}
          onChange={(v) => setOffline({ ...offline, allowPaid: v })}
          label="Allow offline copies of paid content the user owns"
        />
      </Card>

      <Card className="mt-6 space-y-4 p-5">
        <h2 className="font-semibold text-ink-800">Author & reviewer box</h2>
        <Toggle
          checked={authorBox.showAuthorBox}
          onChange={(v) => setAuthorBox({ ...authorBox, showAuthorBox: v })}
          label="Show author box on blog posts"
        />
        <Toggle
          checked={authorBox.showReviewer}
          onChange={(v) => setAuthorBox({ ...authorBox, showReviewer: v })}
          label="Show medical reviewer line"
        />
        <label className="block text-sm text-ink-700">
          Reviewer label
          <input
            value={authorBox.reviewerLabel}
            onChange={(e) => setAuthorBox({ ...authorBox, reviewerLabel: e.target.value })}
            className="mt-1 w-full rounded-md border border-ink-100 px-3 py-2"
          />
        </label>
      </Card>

      <Button className="mt-6" onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save settings'}
      </Button>
    </div>
  );
}
