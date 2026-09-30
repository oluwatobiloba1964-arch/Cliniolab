// src/app/admin/scholars/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ImagePicker } from '@/components/ui/ImagePicker';
import type { ScholarOfTheDay } from '@/types';

export default function AdminScholarsPage() {
  const [scholars, setScholars] = useState<ScholarOfTheDay[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [bio, setBio] = useState('');
  const [achievement, setAchievement] = useState('');
  const [quote, setQuote] = useState('');
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch('/api/scholars')
      .then((res) => res.json())
      .then((data) => setScholars(data.scholars ?? []));
  }

  useEffect(load, []);

  function resetForm() {
    setEditingId(null);
    setName('');
    setPhotoUrl('');
    setBio('');
    setAchievement('');
    setQuote('');
  }

  function startEdit(s: ScholarOfTheDay) {
    setEditingId(s.id);
    setName(s.name);
    setPhotoUrl(s.photoUrl ?? '');
    setBio(s.bio ?? '');
    setAchievement(s.achievement ?? '');
    setQuote(s.quote ?? '');
  }

  async function save() {
    if (!name.trim()) return;
    setError(null);
    const payload = {
      name,
      photoUrl: photoUrl || undefined,
      bio: bio || undefined,
      achievement: achievement || undefined,
      quote: quote || undefined,
    };
    const res = editingId
      ? await fetch(`/api/scholars/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      : await fetch('/api/scholars', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

    if (res.ok) {
      resetForm();
      load();
    } else {
      const data = await res.json();
      setError(data.error);
    }
  }

  async function activate(id: string) {
    const res = await fetch(`/api/scholars/${id}/activate`, { method: 'POST' });
    if (res.ok) load();
  }

  async function remove(id: string) {
    if (!confirm('Delete this scholar entry?')) return;
    const res = await fetch(`/api/scholars/${id}`, { method: 'DELETE' });
    if (res.ok) load();
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-800">Scholar of the Day</h1>
      <p className="mt-1 text-sm text-ink-500">
        Feature anyone on the homepage — they don&apos;t need to be a Cliniolab user. Creating a
        new entry (or reactivating an old one) automatically becomes the active homepage
        spotlight.
      </p>

      <Card className="mt-6 space-y-3 p-5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
        />
        <ImagePicker value={photoUrl} onChange={setPhotoUrl} purpose="scholars" label="Photo" circularPreview />
        <input
          value={achievement}
          onChange={(e) => setAchievement(e.target.value)}
          placeholder="Achievement highlight, e.g. Top scorer in Cardiology this month"
          className="w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
        />
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Short bio"
          rows={2}
          className="w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
        />
        <input
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          placeholder="Quote (optional)"
          className="w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={save}>{editingId ? 'Save changes' : 'Add & feature'}</Button>
          {editingId && (
            <button onClick={resetForm} className="text-xs text-ink-400 hover:text-ink-600">
              Cancel editing
            </button>
          )}
        </div>
        {error && <p className="text-sm text-critical-500">{error}</p>}
      </Card>

      <div className="mt-6 space-y-2">
        {scholars.map((s) => (
          <Card key={s.id} className="flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              {s.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pulse-50 text-sm font-semibold text-pulse-600">
                  {s.name.charAt(0)}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-ink-800">{s.name}</p>
                  {s.isActive && (
                    <span className="rounded bg-pulse-50 px-2 py-0.5 text-xs font-medium text-pulse-600">
                      Active
                    </span>
                  )}
                </div>
                {s.achievement && <p className="text-xs text-ink-400">{s.achievement}</p>}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              {!s.isActive && (
                <button onClick={() => activate(s.id)} className="text-xs font-medium text-pulse-600 hover:text-pulse-700">
                  Make active
                </button>
              )}
              <button onClick={() => startEdit(s)} className="text-xs font-medium text-ink-500 hover:text-ink-700">
                Edit
              </button>
              <button onClick={() => remove(s.id)} className="text-xs font-medium text-critical-500 hover:text-critical-600">
                Delete
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
