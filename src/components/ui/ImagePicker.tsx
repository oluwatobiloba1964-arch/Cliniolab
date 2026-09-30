// src/components/ui/ImagePicker.tsx
'use client';

import { useRef, useState } from 'react';
import { ImageLibraryModal } from './ImageLibraryModal';

interface ImagePickerProps {
  value: string;
  onChange: (url: string) => void;
  purpose: 'blog' | 'resources' | 'banners' | 'scholars';
  label?: string;
  /** Preview as a circle instead of a wide rectangle, for avatar-style photos (contributors, scholars, reviewers) that get displayed in a circular frame elsewhere. Also shows sizing guidance so the upload isn't cropped awkwardly. */
  circularPreview?: boolean;
}

export function ImagePicker({ value, onChange, purpose, label, circularPreview }: ImagePickerProps) {
  const [mode, setMode] = useState<'url' | 'upload'>('url');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('purpose', purpose);
      const res = await fetch('/api/uploads/image', { method: 'POST', body: formData });
      let data: { path?: string; error?: string };
      try {
        data = await res.json();
      } catch {
        setError('Upload failed — the server returned an unexpected response.');
        return;
      }
      if (!res.ok || !data.path) {
        setError(data.error ?? 'Upload failed');
        return;
      }
      onChange(data.path);
    } catch {
      setError('Upload failed — check your connection and try again.');
    } finally {
      setUploading(false);
      // Reset so selecting the same file again (e.g. retry after an
      // error) still fires onChange instead of being a no-op.
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div>
      {label && <label className="text-sm font-medium text-ink-700">{label}</label>}
      {circularPreview && (
        <p className="mt-0.5 text-xs text-ink-400">
          Square photo works best (about 400×400px), with the face centered — it's shown cropped into a circle.
        </p>
      )}
      <div className="mt-1 flex gap-2">
        <button
          type="button"
          onClick={() => setMode('url')}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium ${mode === 'url' ? 'border-pulse-400 bg-pulse-50 text-pulse-700' : 'border-ink-100 text-ink-600'}`}
        >
          Paste link
        </button>
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium ${mode === 'upload' ? 'border-pulse-400 bg-pulse-50 text-pulse-700' : 'border-ink-100 text-ink-600'}`}
        >
          Upload image
        </button>
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          className="rounded-md border border-ink-100 px-3 py-1.5 text-xs font-medium text-ink-600"
        >
          Choose existing
        </button>
      </div>

      {libraryOpen && (
        <ImageLibraryModal
          onSelect={(path) => {
            onChange(path);
            setLibraryOpen(false);
          }}
          onClose={() => setLibraryOpen(false)}
        />
      )}

      {mode === 'url' ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://... (image URL)"
          className="mt-2 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
        />
      ) : (
        <div className="mt-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileSelected}
            className="text-sm text-ink-600"
          />
          {uploading && <p className="mt-1 text-xs text-ink-400">Uploading…</p>}
        </div>
      )}

      {error && <p className="mt-1 text-xs text-critical-500">{error}</p>}

      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt=""
          className={
            circularPreview
              ? 'mx-auto mt-3 h-24 w-24 rounded-full object-cover'
              : 'mt-3 h-32 w-full rounded-md object-cover'
          }
        />
      )}
    </div>
  );
}
