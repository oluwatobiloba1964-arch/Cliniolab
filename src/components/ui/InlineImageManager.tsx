'use client';

// FILE: src/components/ui/InlineImageManager.tsx

import { useRef, useState } from 'react';
import { ImageLibraryModal } from './ImageLibraryModal';
import { resolveImageUrl } from '@/lib/storage/imageUrl';

interface InlineImageManagerProps {
  purpose: 'blog' | 'resources' | 'banners' | 'scholars';
  /** Current post content — read to check/count existing placement markers. */
  content: string;
  /** Insert a placement marker at the caller's current cursor position. */
  onInsertMarker: (marker: string) => void;
  /** Replace a specific marker with the finished image HTML once uploaded. */
  onReplaceMarker: (marker: string, html: string) => void;
}

let markerCounter = 0;

/**
 * Upload-then-insert flow for images placed mid-post, built as a
 * standalone component deliberately isolated from the live Tiptap editor
 * instance — modeled on ImagePicker (the featured-image control), which
 * has never had the reliability problems the in-editor image button did.
 *
 * Why this exists instead of the toolbar/slash-menu image button: on
 * mobile, tapping those opens the OS file picker as a separate
 * activity/overlay, and Android will sometimes reclaim the WebView while
 * it's in the background. When that happens mid-upload, the live
 * ProseMirror editor instance the old flow depended on (to run
 * `editor.chain().insertFigure(...)`) is gone, and the whole admin page
 * can come back as a blank/crashed reload — losing whatever the admin
 * hadn't saved yet.
 *
 * Placement without reintroducing that risk: tapping "Mark this spot"
 * drops a plain-text marker (e.g. [[IMG:3]]) into the editor at the
 * current cursor, via the same editor.chain() the admin was already
 * using to type — that's instant and never touches the picker, so
 * there's nothing here for a WebView reload to interrupt. Only *after*
 * that does the file picker open; when the upload finishes, the marker
 * text is swapped for the real <figure> HTML via a plain string replace
 * on the `content` state (crash-safe, same as the old append-only
 * flow). If the picker reload does happen, the marker is still sitting
 * in the autosaved draft content exactly where it was left — nothing
 * is lost, and the image can be retried into the same spot.
 */
export function InlineImageManager({ purpose, content, onInsertMarker, onReplaceMarker }: InlineImageManagerProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMarker, setActiveMarker] = useState<string | null>(null);
  const [lastPath, setLastPath] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function markSpot() {
    markerCounter += 1;
    const marker = `[[IMG:${markerCounter}]]`;
    onInsertMarker(marker);
    setActiveMarker(marker);
    setLastPath(null);
    setError(null);
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const MAX_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      setError(`That image is ${(file.size / (1024 * 1024)).toFixed(1)}MB — the limit is 5MB. Resize or compress it first.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

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
        setError(`Upload failed — server returned status ${res.status} with a non-JSON response.`);
        return;
      }
      if (!res.ok || !data.path) {
        setError(`Upload failed (status ${res.status}): ${data.error ?? 'no error detail returned'}`);
        return;
      }
      setLastPath(data.path);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setError(`Upload failed — network/connection error: ${detail}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function finishInsert() {
    if (!lastPath || !activeMarker) return;
    const safeCaption = caption.trim();
    const html = safeCaption
      ? `<figure style="text-align: center"><img src="${lastPath}" alt="${safeCaption.replace(/"/g, '&quot;')}" style="width: 60%; max-width: 100%" /><figcaption>${safeCaption}</figcaption></figure>`
      : `<figure style="text-align: center"><img src="${lastPath}" alt="" style="width: 60%; max-width: 100%" /><figcaption></figcaption></figure>`;
    onReplaceMarker(activeMarker, html);
    setActiveMarker(null);
    setLastPath(null);
    setCaption('');
  }

  const markerStillPresent = activeMarker ? content.includes(activeMarker) : false;

  return (
    <div className="rounded-md border border-ink-100 bg-ink-50/40 p-3">
      <p className="mb-2 text-xs font-medium text-ink-600">
        Insert image into post body
      </p>

      {!activeMarker && (
        <>
          <p className="mb-2 text-[11px] text-ink-400">
            Tap your cursor into the spot in the content above where the image should go, then tap
            below to drop a placeholder there — that happens instantly and never touches the file
            picker, so it&apos;s safe even if the picker causes a reload afterward.
          </p>
          <button
            type="button"
            onClick={markSpot}
            className="w-full rounded-md border border-pulse-300 bg-white px-3 py-1.5 text-xs font-medium text-pulse-700 hover:bg-pulse-50"
          >
            Mark this spot for an image
          </button>
        </>
      )}

      {activeMarker && !lastPath && (
        <>
          <p className="mb-2 text-[11px] text-ink-400">
            {markerStillPresent
              ? <>Placeholder <code className="rounded bg-ink-100 px-1">{activeMarker}</code> is in the content below. Now choose the file to fill it with.</>
              : <>Couldn&apos;t find the placeholder in the content anymore — it may have been edited or deleted. Mark a spot again below.</>}
          </p>
          {markerStillPresent ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileSelected}
                className="text-sm text-ink-600"
              />
              <button
                type="button"
                onClick={() => setLibraryOpen(true)}
                className="rounded-md border border-ink-100 px-2.5 py-1 text-xs font-medium text-ink-600 hover:bg-ink-50"
              >
                Choose existing
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={markSpot}
              className="w-full rounded-md border border-pulse-300 bg-white px-3 py-1.5 text-xs font-medium text-pulse-700 hover:bg-pulse-50"
            >
              Mark this spot for an image
            </button>
          )}
          {uploading && <p className="mt-1 text-xs text-ink-400">Uploading…</p>}
          {error && <p className="mt-1 text-xs text-critical-500">{error}</p>}
          <button
            type="button"
            onClick={() => setActiveMarker(null)}
            className="mt-2 text-[11px] text-ink-400 underline"
          >
            Cancel — leave placeholder text as-is
          </button>
        </>
      )}

      {libraryOpen && (
        <ImageLibraryModal
          onSelect={(path) => {
            setLastPath(path);
            setLibraryOpen(false);
          }}
          onClose={() => setLibraryOpen(false)}
        />
      )}

      {activeMarker && lastPath && (
        <div className="mt-1 rounded-md border border-pulse-200 bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resolveImageUrl(lastPath)} alt="" className="h-28 w-full rounded object-cover" />
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Caption (optional)"
            className="mt-2 w-full rounded-md border border-ink-100 px-2 py-1 text-xs focus:border-pulse-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={finishInsert}
            className="mt-2 w-full rounded-md bg-pulse-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-pulse-700"
          >
            Place image at marked spot
          </button>
        </div>
      )}
    </div>
  );
}
