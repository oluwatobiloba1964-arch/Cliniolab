'use client';

// FILE: src/app/dashboard/creator-settings/page.tsx

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth/AuthProvider';
import { resolveImageUrl } from '@/lib/storage/imageUrl';

export default function CreatorSettingsPage() {
  const { user, loading } = useAuth();
  const [contactPhone, setContactPhone] = useState('');
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Public profile fields (name/bio/avatar) - separate load + save state
  // from contact number above, since they're two different endpoints and
  // can be edited/saved independently.
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    fetch('/api/user/contact-phone')
      .then((res) => res.json())
      .then((data) => setContactPhone(data.contactPhone ?? ''));
    fetch('/api/user/profile')
      .then((res) => res.json())
      .then((data) => {
        setDisplayName(data.displayName ?? '');
        setBio(data.bio ?? '');
        setAvatarPath(data.avatarPath ?? null);
      });
  }, [user]);

  async function submit() {
    setSaved(false);
    setSubmitting(true);
    try {
      await fetch('/api/user/contact-phone', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactPhone }),
      });
      setSaved(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitProfile() {
    setProfileSaved(false);
    setProfileError(null);
    setProfileSubmitting(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, bio }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProfileError(data.error ?? 'Failed to save profile');
        return;
      }
      setProfileSaved(true);
    } finally {
      setProfileSubmitting(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileError(null);
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/user/avatar', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        setProfileError(data.error ?? 'Failed to upload avatar');
        return;
      }
      setAvatarPath(data.avatarPath);
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (loading) return null;
  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Login required</h1>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <h1 className="font-display text-2xl font-semibold text-ink-800">Creator settings</h1>

      <p className="mt-8 text-ink-500">
        This is what people see when they visit your public creator profile - your photo, name,
        and bio, alongside the quizzes you&apos;ve published and how many people have taken them.
      </p>

      <Card className="mt-6 space-y-4 p-5">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-ink-100">
            {avatarPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolveImageUrl(avatarPath)} alt="Your avatar" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-ink-400">
                {(displayName || user.email)[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleAvatarChange}
              className="hidden"
              id="avatar-upload"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={avatarUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {avatarUploading ? 'Uploading…' : avatarPath ? 'Change photo' : 'Upload photo'}
            </Button>
            <p className="mt-1 text-xs text-ink-400">JPEG, PNG, WEBP, or GIF. Up to 5MB.</p>
          </div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-wide text-ink-400">Display name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="mt-1 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-wide text-ink-400">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A short line about you or what you teach…"
            rows={3}
            maxLength={500}
            className="mt-1 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
          />
          <p className="mt-1 text-xs text-ink-400">{bio.length}/500</p>
        </div>

        {profileError && <p className="text-sm text-critical-500">{profileError}</p>}
        {profileSaved && <p className="text-sm text-pulse-600">Saved.</p>}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={submitProfile} disabled={profileSubmitting}>
            {profileSubmitting ? 'Saving…' : 'Save profile'}
          </Button>
          <Link
            href={`/creator/${user.id}`}
            target="_blank"
            className="text-sm font-medium text-pulse-600 hover:underline"
          >
            View public profile →
          </Link>
        </div>
      </Card>

      <h2 className="mt-10 font-display text-xl font-semibold text-ink-800">Contact number</h2>
      <p className="mt-2 text-ink-500">
        Add a contact number for people who take your quizzes. It appears as &quot;For inquiries
        or assistance, contact: …&quot; on the share text of every public quiz you create. Update
        it here any time and it applies to all of them immediately.
      </p>

      <Card className="mt-6 space-y-3 p-5">
        <input
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          placeholder="e.g. 08012345678"
          className="w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
        />
        <p className="text-xs text-ink-400">Leave blank to remove the contact line from your share text.</p>
        {saved && <p className="text-sm text-pulse-600">Saved.</p>}
        <Button onClick={submit} disabled={submitting}>
          {submitting ? 'Saving…' : 'Save contact number'}
        </Button>
      </Card>
    </div>
  );
}
