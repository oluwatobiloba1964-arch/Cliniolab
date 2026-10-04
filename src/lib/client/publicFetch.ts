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

export function clearPublicFetchCache(urlPrefix?: string) {
  if (!urlPrefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(urlPrefix)) cache.delete(key);
  }
}
