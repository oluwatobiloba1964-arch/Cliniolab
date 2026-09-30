'use client';

/**
 * IndexedDB storage for "Save for offline". Each saved item is a full,
 * self-contained snapshot (quiz + questions with answers, or a flashcard
 * set + cards) so it can be opened and taken with no network at all.
 *
 * This is a device-local practice copy, not a sync queue: an offline
 * attempt is graded on-device and is not uploaded when the connection
 * returns. That keeps the feature simple and reliable on flaky
 * connections, which is the main problem it targets.
 */

const DB_NAME = 'cliniolab-offline';
const DB_VERSION = 1;
const STORE = 'items';

export interface OfflineItem {
  id: string; // `${kind}:${sourceId}`
  kind: 'quiz' | 'flashcards';
  sourceId: string;
  title: string;
  pricing: 'free' | 'paid';
  savedAt: string;
  payload: unknown; // quiz+questions or set+cards
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listOfflineItems(): Promise<OfflineItem[]> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as OfflineItem[]).sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1)));
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function getOfflineItem(id: string): Promise<OfflineItem | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve((req.result as OfflineItem) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function saveOfflineItem(item: OfflineItem): Promise<boolean> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch {
    return false;
  }
}

export async function removeOfflineItem(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

export async function countOfflineItems(): Promise<number> {
  return (await listOfflineItems()).length;
}
