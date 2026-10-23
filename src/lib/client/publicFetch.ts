// FILE: src/lib/client/publicFetch.ts
const cache = new Map<string, { expiresAt: number; data: unknown }>();
const pending = new Map<string, Promise<unknown>>();

/**
 * Small browser-side cache for public GET requests. It prevents duplicate
 * requests when several UI sections ask for the same public resource during
 * one navigation. No user data is cached here.
 */
export async function publicFetchJson<T>(url: string, ttlMs = 30_000): Promise<T> {
  const now = Date.now();
  const cached = cache.get(url);
  if (cached && cached.expiresAt > now) return cached.data as T;

  const active = pending.get(url);
  if (active) return active as Promise<T>;

  const request = fetch(url, { headers: { Accept: 'application/json' } })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      const data = (await response.json()) as T;
      cache.set(url, { expiresAt: Date.now() + ttlMs, data });
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

export function clearPublicFetchCache(urlPrefix?: string) {
  if (!urlPrefix) {
    cache.clear();
  } else {
    for (const key of cache.keys()) {
      if (key.startsWith(urlPrefix)) cache.delete(key);
    }
  }
  // Keep session-persisted public data coherent when a caller explicitly
  // invalidates the in-memory cache after an administrative edit.
  try {
    if (typeof window !== 'undefined') {
      const prefix = 'cliniolab:public-session-cache:';
      for (let i = window.sessionStorage.length - 1; i >= 0; i--) {
        const key = window.sessionStorage.key(i);
        if (!key?.startsWith(prefix)) continue;
        const cachedUrl = key.slice(prefix.length);
        if (!urlPrefix || cachedUrl.startsWith(urlPrefix)) window.sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Storage is an optional optimization and may be unavailable.
  }
}


/**
 * Session-persistent cache for explicitly public, non-personalized data that
 * is expensive to re-read after a hard refresh. Use only for public endpoints.
 */
export async function publicFetchJsonSessionCached<T>(url: string, ttlMs = 30_000): Promise<T> {
  const storageKey = `cliniolab:public-session-cache:${url}`;
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (raw) {
      const cached = JSON.parse(raw) as { expiresAt?: number; data?: T };
      if (typeof cached.expiresAt === 'number' && cached.expiresAt > Date.now() && cached.data !== undefined) {
        return cached.data;
      }
      window.sessionStorage.removeItem(storageKey);
    }
  } catch {
    // Fall through to the normal in-memory cache when storage is unavailable.
  }

  const data = await publicFetchJson<T>(url, ttlMs);
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify({ expiresAt: Date.now() + ttlMs, data }));
  } catch {
    // Storage is an optimization, never a requirement for loading navigation.
  }
  return data;
}
