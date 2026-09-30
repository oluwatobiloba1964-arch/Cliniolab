// src/app/admin/contributors/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import { ImagePicker } from '@/components/ui/ImagePicker';
import type { Contributor } from '@/types';

const EMPTY = { name: '', credentials: '', title: '', bio: '', photoUrl: '', isActive: true };

/** Contributors library: outside writers/reviewers with name, credentials and photo. Used on blog posts as byline/reviewer. */
export default function ContributorsPage() {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch('/api/admin/contributors');
    if (res.ok) setContributors((await res.json()).contributors ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  function edit(c: Contributor) {
    setEditingId(c.id);
    setForm({
      name: c.name,
      credentials: c.credentials ?? '',
      title: c.title ?? '',
      bio: c.bio ?? '',
      photoUrl: c.photoUrl ?? '',
      isActive: c.isActive,
    });
  }

  function reset() {
    setEditingId(null);
    setForm(EMPTY);
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const url = editingId ? `/api/admin/contributors/${editingId}` : '/api/admin/contributors';
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to save');
        return;
      }
      reset();
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this contributor? Posts keep their byline text; only the link to this profile is removed.')) return;
    await fetch(`/api/admin/contributors/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-800">Contributors</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-500">
        Outside writers and clinical reviewers. Add them here once, then pick them from the blog editor. No login
        account is needed for a contributor.
      </p>

      <Card className="mt-6 max-w-xl space-y-3 p-5">
        <h2 className="font-semibold text-ink-800">{editingId ? 'Edit contributor' : 'Add contributor'}</h2>
        {error && <p className="text-sm text-critical-500">{error}</p>}
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Name"
          className="w-full rounded-md border border-ink-100 px-3 py-2 text-sm"
        />
        <input
          value={form.credentials}
          onChange={(e) => setForm({ ...form, credentials: e.target.value })}
          placeholder="Credentials, e.g. RN, BNSc, MSc"
          className="w-full rounded-md border border-ink-100 px-3 py-2 text-sm"
        />
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Title, e.g. Clinical Nurse Educator"
          className="w-full rounded-md border border-ink-100 px-3 py-2 text-sm"
        />
        <textarea
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
          placeholder="Short bio"
          rows={3}
          className="w-full rounded-md border border-ink-100 px-3 py-2 text-sm"
        />
        <ImagePicker value={form.photoUrl} onChange={(v) => setForm({ ...form, photoUrl: v })} purpose="blog" label="Photo" circularPreview />
        <Toggle checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label="Active" />
        <div className="flex gap-2">
          <Button onClick={save} disabled={saving || !form.name.trim()}>
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add contributor'}
          </Button>
          {editingId && <Button variant="secondary" onClick={reset}>Cancel</Button>}
        </div>
      </Card>

      <div className="mt-6 space-y-2">
        {contributors.map((c) => (
          <Card key={c.id} className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium text-ink-800">
                {c.name}
                {c.credentials && <span className="font-normal text-ink-500">, {c.credentials}</span>}
                {!c.isActive && <span className="ml-2 rounded bg-ink-50 px-2 py-0.5 text-xs text-ink-400">Inactive</span>}
              </p>
              {c.title && <p className="text-xs text-ink-400">{c.title}</p>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => edit(c)}>Edit</Button>
              <Button size="sm" variant="danger" onClick={() => remove(c.id)}>Delete</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
