// FILE: src/lib/client/publicFetch.ts
const MAX_PUBLIC_CACHE_ENTRIES = 100;
const cache = new Map<string, { expiresAt: number; data: unknown }>();
const pending = new Map<string, Promise<unknown>>();

const SESSION_PREFIX = 'cliniolab:public-session-cache:';
const LOCAL_PREFIX = 'cliniolab:public-local-cache:';

function rememberPublicValue(url: string, data: unknown, ttlMs: number) {
  // Map insertion order gives us a small FIFO/LRU-like bound for long sessions.
  cache.delete(url);
  cache.set(url, { expiresAt: Date.now() + Math.max(0, ttlMs), data });
  while (cache.size > MAX_PUBLIC_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
}

/**
 * Small browser-side cache for public GET requests. It prevents duplicate
 * requests when several UI sections ask for the same public resource during
 * one navigation. No user data is cached here.
 */
export async function publicFetchJson<T>(url: string, ttlMs = 30_000): Promise<T> {
  const now = Date.now();
  const cached = cache.get(url);
  if (cached && cached.expiresAt > now) {
    // Refresh insertion order so frequently used entries survive the bound.
    cache.delete(url);
    cache.set(url, cached);
    return cached.data as T;
  }
  if (cached) cache.delete(url);

  const active = pending.get(url);
  if (active) return active as Promise<T>;

  const request = fetch(url, { headers: { Accept: 'application/json' } })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      const data = (await response.json()) as T;
      rememberPublicValue(url, data, ttlMs);
      return data;
    })
    .finally(() => {
      pending.delete(url);
    });

  pending.set(url, request);
  return request;
}

/**
 * Fetches data that may vary by signed-in user without retaining it after the
 * request completes. Concurrent callers share the same in-flight request,
 * but a later user/session can never receive a previous user's cached result.
 */
const pendingNoStore = new Map<string, Promise<unknown>>();

export async function fetchJsonNoStore<T>(url: string): Promise<T> {
  const active = pendingNoStore.get(url);
  if (active) return active as Promise<T>;

  const request = fetch(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    credentials: 'same-origin',
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      return (await response.json()) as T;
    })
    .finally(() => {
      pendingNoStore.delete(url);
    });

  pendingNoStore.set(url, request);
  return request;
}

function clearStorageByPrefix(storage: Storage | undefined, prefix: string, urlPrefix?: string) {
  if (!storage) return;
  try {
    for (let i = storage.length - 1; i >= 0; i--) {
      const key = storage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const cachedUrl = key.slice(prefix.length);
      if (!urlPrefix || cachedUrl.startsWith(urlPrefix)) storage.removeItem(key);
    }
  } catch {
    // Storage is optional.
  }
}

/**
 * Invalidate in-memory, sessionStorage, and localStorage public caches.
 * Call after admin content edits so the next page load hits D1 for fresh data.
 * Pass a URL prefix (e.g. "/api/blog") to clear only matching endpoints.
 */
export function clearPublicFetchCache(urlPrefix?: string) {
  if (!urlPrefix) {
    cache.clear();
  } else {
    for (const key of cache.keys()) {
      if (key.startsWith(urlPrefix)) cache.delete(key);
    }
  }

  if (typeof window === 'undefined') return;

  try {
    clearStorageByPrefix(window.sessionStorage, SESSION_PREFIX, urlPrefix);
    clearStorageByPrefix(window.localStorage, LOCAL_PREFIX, urlPrefix);
    // Legacy list caches written directly by some listing pages.
    const legacyPrefixes = [
      'cliniolab:flashcard-list:',
      'cliniolab:quiz-list:',
      'cliniolab:resource-list:',
      'cliniolab:guest-items:',
      'cliniolab:abbreviations:',
    ];
    for (const leg of legacyPrefixes) {
      for (let i = window.localStorage.length - 1; i >= 0; i--) {
        const key = window.localStorage.key(i);
        if (!key?.startsWith(leg)) continue;
        if (!urlPrefix) {
          window.localStorage.removeItem(key);
          continue;
        }
        // Best-effort: clear legacy keys when any related API prefix is invalidated.
        if (
          (leg.includes('flashcard') && urlPrefix.includes('flashcard')) ||
          (leg.includes('quiz') && urlPrefix.includes('quiz')) ||
          (leg.includes('resource') && urlPrefix.includes('resource')) ||
          (leg.includes('guest') && urlPrefix.includes('guest')) ||
          (leg.includes('abbreviation') && urlPrefix.includes('abbreviation')) ||
          urlPrefix === '/'
        ) {
          window.localStorage.removeItem(key);
        }
      }
    }
  } catch {
    // Storage is an optional optimization and may be unavailable.
  }
}

function readStorageCache<T>(
  storage: Storage | undefined,
  prefix: string,
  url: string,
): T | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(prefix + url);
    if (!raw) return null;
    const cached = JSON.parse(raw) as { expiresAt?: number; data?: T };
    if (typeof cached.expiresAt === 'number' && cached.expiresAt > Date.now() && cached.data !== undefined) {
      return cached.data;
    }
    storage.removeItem(prefix + url);
  } catch {
    // Corrupt or unavailable storage — fall through.
  }
  return null;
}

function writeStorageCache(storage: Storage | undefined, prefix: string, url: string, data: unknown, ttlMs: number) {
  if (!storage) return;
  try {
    storage.setItem(prefix + url, JSON.stringify({ expiresAt: Date.now() + ttlMs, data }));
  } catch {
    // Quota / private mode — caching is optional.
  }
}

/**
 * Session-persistent cache for explicitly public, non-personalized data that
 * is expensive to re-read after a hard refresh. Use only for public endpoints.
 * Also mirrors into localStorage so a later visit in a new tab/session can
 * still avoid a D1 round-trip until the TTL expires.
 */
export async function publicFetchJsonSessionCached<T>(url: string, ttlMs = 30_000): Promise<T> {
  // Prefer sessionStorage (tab-scoped), then localStorage (cross-session).
  const fromSession = readStorageCache<T>(
    typeof window !== 'undefined' ? window.sessionStorage : undefined,
    SESSION_PREFIX,
    url,
  );
  if (fromSession !== null) return fromSession;

  const fromLocal = readStorageCache<T>(
    typeof window !== 'undefined' ? window.localStorage : undefined,
    LOCAL_PREFIX,
    url,
  );
  if (fromLocal !== null) {
    // Rehydrate sessionStorage so subsequent navigations in this tab stay fast.
    writeStorageCache(
      typeof window !== 'undefined' ? window.sessionStorage : undefined,
      SESSION_PREFIX,
      url,
      fromLocal,
      ttlMs,
    );
    rememberPublicValue(url, fromLocal, ttlMs);
    return fromLocal;
  }

  const data = await publicFetchJson<T>(url, ttlMs);
  writeStorageCache(
    typeof window !== 'undefined' ? window.sessionStorage : undefined,
    SESSION_PREFIX,
    url,
    data,
    ttlMs,
  );
  writeStorageCache(
    typeof window !== 'undefined' ? window.localStorage : undefined,
    LOCAL_PREFIX,
    url,
    data,
    ttlMs,
  );
  return data;
}

/**
 * LocalStorage-first public cache. On first load hits the network (D1), stores
 * the response locally, and on later loads returns local data until TTL expiry
 * or until clearPublicFetchCache() runs (e.g. after an admin edit).
 * Falls back to the network when storage is missing, corrupt, or expired.
 */
export async function publicFetchJsonLocalCached<T>(url: string, ttlMs = 5 * 60_000): Promise<T> {
  const fromLocal = readStorageCache<T>(
    typeof window !== 'undefined' ? window.localStorage : undefined,
    LOCAL_PREFIX,
    url,
  );
  if (fromLocal !== null) {
    rememberPublicValue(url, fromLocal, ttlMs);
    return fromLocal;
  }

  // Session hit is still useful within the same tab before local is written.
  const fromSession = readStorageCache<T>(
    typeof window !== 'undefined' ? window.sessionStorage : undefined,
    SESSION_PREFIX,
    url,
  );
  if (fromSession !== null) {
    writeStorageCache(
      typeof window !== 'undefined' ? window.localStorage : undefined,
      LOCAL_PREFIX,
      url,
      fromSession,
      ttlMs,
    );
    rememberPublicValue(url, fromSession, ttlMs);
    return fromSession;
  }

  const data = await publicFetchJson<T>(url, ttlMs);
  writeStorageCache(
    typeof window !== 'undefined' ? window.localStorage : undefined,
    LOCAL_PREFIX,
    url,
    data,
    ttlMs,
  );
  writeStorageCache(
    typeof window !== 'undefined' ? window.sessionStorage : undefined,
    SESSION_PREFIX,
    url,
    data,
    ttlMs,
  );
  return data;
}

/** Default TTL for public listing pages (5 minutes). */
export const PUBLIC_LIST_TTL_MS = 5 * 60_000;

/** Longer TTL for rarely changing config / flags (15 minutes). */
export const PUBLIC_CONFIG_TTL_MS = 15 * 60_000;
