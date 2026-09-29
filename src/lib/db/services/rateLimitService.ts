import { getDb } from '@/lib/db/client';

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  retryAfterSeconds: number;
}

/**
 * Atomically increments the counter for `key` in the current fixed window
 * and reports whether the caller is still within `limit`.
 * Fails OPEN on database errors so an outage never locks real users out.
 */
export async function hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const nowSec = Math.floor(Date.now() / 1000);
  const windowIndex = Math.floor(nowSec / windowSeconds);
  const bucketKey = `${key}:${windowIndex}`;
  const expiresAt = (windowIndex + 1) * windowSeconds;
  const retryAfterSeconds = Math.max(1, expiresAt - nowSec);

  try {
    const db = getDb();
    const row = await db
      .prepare(
        `INSERT INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?)
         ON CONFLICT(key) DO UPDATE SET count = count + 1
         RETURNING count`
      )
      .bind(bucketKey, expiresAt)
      .first<{ count: number }>();
    const count = row?.count ?? 1;

    // ~1% of calls: purge expired rows so the table stays tiny.
    if (Math.random() < 0.01) {
      db.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(nowSec).run().catch(() => {});
    }

    return { allowed: count <= limit, count, retryAfterSeconds };
  } catch (err) {
    console.error('rateLimitService.hit failed (failing open):', err);
    return { allowed: true, count: 0, retryAfterSeconds: 0 };
  }
}
