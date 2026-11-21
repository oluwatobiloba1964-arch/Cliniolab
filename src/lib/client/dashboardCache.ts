// src/lib/client/dashboardCache.ts
//
// The dashboard keeps a user-scoped snapshot of its payload (stats, quizzes,
// flashcard sets, etc.) in localStorage for up to 5 minutes so a reload
// doesn't have to re-fetch /api/dashboard every time. Anything that changes
// what that payload should contain - creating/editing/deleting a quiz or
// flashcard set from a page other than the dashboard itself - needs to drop
// this cache, otherwise the dashboard keeps showing the stale snapshot (and
// a brand new quiz appears to "take time" to show up) until it expires.
const CACHE_PREFIX = 'cliniolab:dashboard-cache:v1:';

export function invalidateDashboardCache(userId?: string | null) {
  if (!userId) return;
  try {
    window.localStorage.removeItem(`${CACHE_PREFIX}${userId}`);
  } catch {
    /* Optional cache. */
  }
}
