'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';

export default function AdminAdSensePage() {
  const [enabled, setEnabled] = useState(false);
  const [clientId, setClientId] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/adsense')
      .then((res) => res.json())
      .then((data) => {
        setEnabled(!!data.enabled);
        setClientId(data.clientId ?? '');
        setLoading(false);
      });
  }, []);

  async function save() {
    setSaved(false);
    const res = await fetch('/api/admin/adsense', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, clientId }),
    });
    if (res.ok) setSaved(true);
  }

  if (loading) return null;

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-800">Google AdSense</h1>
      <p className="mt-2 text-ink-500">
        Ads show on the homepage, blog, and other browsing pages. They are hidden on the admin
        panel, quiz creation pages, and while a user is practicing or taking a quiz, and never
        appear in the header.
      </p>

      <Card className="mt-6 space-y-4 p-5">
        <Toggle checked={enabled} onChange={setEnabled} label="Show Google AdSense ads on the site" />

        <div>
          <label className="text-sm font-medium text-ink-700">AdSense Publisher ID</label>
          <input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="ca-pub-8830559839401006"
            className="mt-1 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
          />
          <p className="mt-1 text-xs text-ink-400">
            Used to verify site ownership with Google and to load the AdSense script.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={save}>Save</Button>
          {saved && <span className="text-sm text-pulse-600">Saved.</span>}
        </div>
      </Card>
    </div>
  );
}
