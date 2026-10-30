'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';

export default function AdminHomepageVideoPage() {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [flagEnabled, setFlagEnabled] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/admin/homepage-video')
      .then((res) => res.json())
      .then((data) => {
        setFlagEnabled(data.enabled);
        if (data.video) {
          setYoutubeUrl(data.video.youtubeUrl);
          setTitle(data.video.title);
          setDescription(data.video.description);
        }
      });
  }, []);

  async function toggleFlag(enabled: boolean) {
    setFlagEnabled(enabled);
    await fetch('/api/admin/flags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'homepage_video', enabled }),
    });
  }

  async function save() {
    const res = await fetch('/api/admin/homepage-video', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ youtubeUrl, title, description }),
    });
    if (res.ok) setSaved(true);
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-800">Homepage video</h1>
      <p className="mt-2 text-ink-500">
        Shown near the footer on the homepage. Paste any YouTube link. Watch, share, or embed
        format all work.
      </p>

      <Card className="mt-6 space-y-4 p-5">
        <Toggle checked={flagEnabled} onChange={toggleFlag} label="Show this section on the homepage" />

        <div>
          <label className="text-sm font-medium text-ink-700">YouTube URL</label>
          <input
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="mt-1 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink-700">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink-700">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
          />
        </div>
        <Button size="sm" onClick={save}>Save</Button>
        {saved && <span className="ml-3 text-xs text-pulse-600">Saved</span>}
      </Card>
    </div>
  );
}
