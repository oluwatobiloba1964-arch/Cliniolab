// src/components/blog/AuthorFields.tsx
'use client';

import { useEffect, useState } from 'react';
import { ImagePicker } from '@/components/ui/ImagePicker';
import type { Contributor } from '@/types';

export interface AuthorFieldsValue {
  authorName: string;
  authorCredentials: string;
  authorPhotoUrl: string;
  authorContributorId: string;
  authorBio: string;
  reviewerName: string;
  reviewerCredentials: string;
  reviewerPhotoUrl: string;
  reviewerContributorId: string;
  reviewerBio: string;
}

interface Props {
  value: AuthorFieldsValue;
  onChange: (value: AuthorFieldsValue) => void;
}

/**
 * Byline and "Medically reviewed by" fields for a post. Picking a
 * contributor fills the name/credentials/photo from the Contributors
 * library, but every field stays freely editable afterward — an editor
 * can change the displayed name or credentials for this post without
 * changing the contributor record itself.
 */
export function AuthorFields({ value, onChange }: Props) {
  const [contributors, setContributors] = useState<Contributor[]>([]);

  useEffect(() => {
    fetch('/api/admin/contributors')
      .then((res) => (res.ok ? res.json() : { contributors: [] }))
      .then((data) => setContributors(data.contributors ?? []))
      .catch(() => {});
  }, []);

  function set<K extends keyof AuthorFieldsValue>(key: K, v: AuthorFieldsValue[K]) {
    onChange({ ...value, [key]: v });
  }

  function pickContributor(role: 'author' | 'reviewer', id: string) {
    const c = contributors.find((x) => x.id === id);
    if (!c) {
      set(role === 'author' ? 'authorContributorId' : 'reviewerContributorId', '');
      return;
    }
    if (role === 'author') {
      onChange({
        ...value,
        authorContributorId: c.id,
        authorName: c.name,
        authorCredentials: c.credentials ?? '',
        authorPhotoUrl: c.photoUrl ?? '',
        authorBio: c.bio ?? '',
      });
    } else {
      onChange({
        ...value,
        reviewerContributorId: c.id,
        reviewerName: c.name,
        reviewerCredentials: c.credentials ?? '',
        reviewerPhotoUrl: c.photoUrl ?? '',
        reviewerBio: c.bio ?? '',
      });
    }
  }

  return (
    <div className="space-y-6 rounded-md border border-ink-100 p-4">
      <div>
        <p className="text-sm font-semibold text-ink-800">Author</p>
        <p className="mt-0.5 text-xs text-ink-400">
          Shown on the post for trust (name and credentials). Pick from Contributors or type your own.
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <select
            value={value.authorContributorId}
            onChange={(e) => pickContributor('author', e.target.value)}
            className="rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-700"
          >
            <option value="">— Pick a contributor (optional) —</option>
            {contributors.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.credentials ? `, ${c.credentials}` : ''}</option>
            ))}
          </select>
          <input
            value={value.authorName}
            onChange={(e) => set('authorName', e.target.value)}
            placeholder="Author name"
            className="rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-700"
          />
          <input
            value={value.authorCredentials}
            onChange={(e) => set('authorCredentials', e.target.value)}
            placeholder="Credentials, e.g. RN, BNSc"
            className="rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-700"
          />
          <ImagePicker value={value.authorPhotoUrl} onChange={(v) => set('authorPhotoUrl', v)} purpose="blog" label="Author photo" circularPreview />
        </div>
        <textarea
          value={value.authorBio}
          onChange={(e) => set('authorBio', e.target.value)}
          placeholder="Full bio shown on the author's profile card (optional)"
          rows={3}
          maxLength={1500}
          className="mt-2 w-full rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-700"
        />
      </div>

      <div>
        <p className="text-sm font-semibold text-ink-800">Medically reviewed by (optional)</p>
        <p className="mt-0.5 text-xs text-ink-400">Adds a second, independent reviewer line for clinical trust.</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <select
            value={value.reviewerContributorId}
            onChange={(e) => pickContributor('reviewer', e.target.value)}
            className="rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-700"
          >
            <option value="">— Pick a contributor (optional) —</option>
            {contributors.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.credentials ? `, ${c.credentials}` : ''}</option>
            ))}
          </select>
          <input
            value={value.reviewerName}
            onChange={(e) => set('reviewerName', e.target.value)}
            placeholder="Reviewer name"
            className="rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-700"
          />
          <input
            value={value.reviewerCredentials}
            onChange={(e) => set('reviewerCredentials', e.target.value)}
            placeholder="Credentials"
            className="rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-700"
          />
          <ImagePicker value={value.reviewerPhotoUrl} onChange={(v) => set('reviewerPhotoUrl', v)} purpose="blog" label="Reviewer photo" circularPreview />
        </div>
        <textarea
          value={value.reviewerBio}
          onChange={(e) => set('reviewerBio', e.target.value)}
          placeholder="Full bio shown on the reviewer's profile card (optional)"
          rows={3}
          maxLength={1500}
          className="mt-2 w-full rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-700"
        />
      </div>
    </div>
  );
}
