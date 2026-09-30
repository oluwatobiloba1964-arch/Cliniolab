'use client';

import { useEffect, useState } from 'react';
import { usePublicConfig } from '@/lib/hooks/usePublicConfig';
import { countOfflineItems, getOfflineItem, removeOfflineItem, saveOfflineItem } from './offlineStore';

interface Props {
  kind: 'quiz' | 'flashcards';
  sourceId: string;
  title: string;
  pricing: 'free' | 'paid';
  /** Full payload to store: quiz+questions (with answers) or set+cards. Fetched lazily on save. */
  loadPayload: () => Promise<unknown>;
}

/** "Save for offline" / "Saved offline" toggle. Renders nothing if offline mode is off, or paid content isn't allowed. */
export function OfflineSaveButton({ kind, sourceId, title, pricing, loadPayload }: Props) {
  const { flags, offline } = usePublicConfig();
  const id = `${kind}:${sourceId}`;
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState(false);

  useEffect(() => {
    getOfflineItem(id).then((item) => setSaved(!!item));
    countOfflineItems().then((n) => setFull(n >= offline.maxItems));
  }, [id, offline.maxItems]);

  if (!flags.offlineMode) return null;
  if (pricing === 'paid' && !offline.allowPaid) return null;

  async function toggle() {
    setBusy(true);
    try {
      if (saved) {
        await removeOfflineItem(id);
        setSaved(false);
        setFull(false);
      } else {
        const payload = await loadPayload();
        const ok = await saveOfflineItem({ id, kind, sourceId, title, pricing, savedAt: new Date().toISOString(), payload });
        if (ok) setSaved(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy || (!saved && full)}
      title={!saved && full ? `Offline storage is full (max ${offline.maxItems} items). Remove one from /offline first.` : undefined}
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${
        saved ? 'border-pulse-400 bg-pulse-50 text-pulse-700' : 'border-ink-100 text-ink-600 hover:border-pulse-400'
      } disabled:opacity-40`}
    >
      {saved ? '✓ Saved offline' : busy ? 'Saving…' : '⬇ Save for offline'}
    </button>
  );
}
