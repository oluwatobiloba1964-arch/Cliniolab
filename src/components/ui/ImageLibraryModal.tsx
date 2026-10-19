'use client';

// FILE: src/components/ui/ImageLibraryModal.tsx

import { useEffect, useState } from 'react';
import { resolveImageUrl } from '@/lib/storage/imageUrl';

interface StoredImage {
  path: string;
  key: string;
  purpose: string;
  size: number;
  uploadedAt: string;
}

interface ImageLibraryModalProps {
  onSelect: (path: string) => void;
  onClose: () => void;
}

/**
 * Browsable grid of every image previously uploaded (across blog,
 * resources, banners, scholars), so a diagram or photo used in one post
 * can be reused in another without re-uploading it. Purely a picker —
 * selecting an image just hands its existing /api/images/... path back
 * to the caller, the same shape a fresh upload would produce, so callers
 * (ImagePicker, InlineImageManager) don't need to know the difference.
 */
export function ImageLibraryModal({ onSelect, onClose }: ImageLibraryModalProps) {
  const [images, setImages] = useState<StoredImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purposeFilter, setPurposeFilter] = useState<'all' | 'blog' | 'resources' | 'banners' | 'scholars'>('all');
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);

  function load(reset: boolean) {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (purposeFilter !== 'all') params.set('purpose', purposeFilter);
    if (!reset && nextCursor) params.set('cursor', nextCursor);
    fetch(`/api/uploads/image/list?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setImages((current) => (reset ? data.images : [...current, ...data.images]));
        setNextCursor(data.nextCursor);
      })
      .catch(() => setError('Failed to load images — check your connection.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purposeFilter]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-ink-100 p-4">
          <h2 className="text-sm font-semibold text-ink-800">Choose from previously uploaded images</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-ink-400 hover:bg-ink-100" title="Close">
            ✕
          </button>
        </div>

        <div className="flex gap-1 border-b border-ink-100 p-2">
          {(['all', 'blog', 'resources', 'banners', 'scholars'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPurposeFilter(p)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize ${
                purposeFilter === p ? 'bg-pulse-100 text-pulse-700' : 'text-ink-500 hover:bg-ink-50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {error && <p className="p-2 text-xs text-critical-500">{error}</p>}
          {!error && images.length === 0 && !loading && (
            <p className="p-4 text-center text-xs text-ink-400">No images uploaded yet.</p>
          )}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {images.map((img) => (
              <button
                key={img.key}
                type="button"
                onClick={() => onSelect(img.path)}
                className="group relative aspect-square overflow-hidden rounded-md border border-ink-100 hover:border-pulse-400"
                title={img.key}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resolveImageUrl(img.path)} alt="" className="h-full w-full object-cover" />
                <span className="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-1 py-0.5 text-[9px] text-white opacity-0 group-hover:opacity-100">
                  {img.purpose}
                </span>
              </button>
            ))}
          </div>
          {loading && <p className="mt-3 text-center text-xs text-ink-400">Loading…</p>}
          {!loading && nextCursor && (
            <button
              type="button"
              onClick={() => load(false)}
              className="mt-3 w-full rounded-md border border-ink-100 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-50"
            >
              Load more
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
