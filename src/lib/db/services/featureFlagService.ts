import { getDb } from '@/lib/db/client';
import type { FeatureFlag, FeatureFlagKey } from '@/types';

interface FlagRow {
  key: string;
  enabled: number;
  label: string | null;
}

const FLAG_CACHE_TTL_MS = 60_000;
let flagMapCache: { value: Record<FeatureFlagKey, boolean>; expiresAt: number } | null = null;
let flagMapPending: Promise<Record<FeatureFlagKey, boolean>> | null = null;
let flagMapVersion = 0;

function invalidateFlagCache(): void {
  flagMapCache = null;
  flagMapPending = null;
  flagMapVersion += 1;
}

function mapFlag(row: FlagRow): FeatureFlag {
  return { key: row.key as FeatureFlagKey, enabled: row.enabled === 1, label: row.label };
}

export async function listFeatureFlags(): Promise<FeatureFlag[]> {
  const db = getDb();
  const { results } = await db.prepare('SELECT * FROM feature_flags').all<FlagRow>();
  return results.map(mapFlag);
}

/**
 * Returns a lookup map so callers can do `flags.comments` style checks
 * without re-querying per flag.
 */
export async function getFeatureFlagMap(): Promise<Record<FeatureFlagKey, boolean>> {
  if (flagMapCache && flagMapCache.expiresAt > Date.now()) return { ...flagMapCache.value };
  if (flagMapPending) return { ...(await flagMapPending) };
  const version = flagMapVersion;
  const request = (async () => {
    const flags = await listFeatureFlags();
    const map = {} as Record<FeatureFlagKey, boolean>;
    for (const f of flags) map[f.key] = f.enabled;
    if (version === flagMapVersion) flagMapCache = { value: map, expiresAt: Date.now() + FLAG_CACHE_TTL_MS };
    return map;
  })();
  flagMapPending = request;
  try {
    return { ...(await request) };
  } finally {
    if (flagMapPending === request) flagMapPending = null;
  }
}

export async function isFeatureEnabled(key: FeatureFlagKey): Promise<boolean> {
  const flags = await getFeatureFlagMap();
  // Missing rows default to enabled, matching the existing behaviour.
  return flags[key] !== false;
}

export async function getFeatureFlag(key: FeatureFlagKey): Promise<FeatureFlag> {
  const db = getDb();
  const row = await db
    .prepare('SELECT key, enabled, label FROM feature_flags WHERE key = ?')
    .bind(key)
    .first<FlagRow>();
  if (!row) return { key, enabled: true, label: null };
  return mapFlag(row);
}

export async function setFeatureFlag(
  key: FeatureFlagKey,
  enabled: boolean,
  label?: string
): Promise<void> {
  const db = getDb();
  if (label !== undefined) {
    await db
      .prepare('UPDATE feature_flags SET enabled = ?, label = ? WHERE key = ?')
      .bind(enabled ? 1 : 0, label, key)
      .run();
  } else {
    await db
      .prepare('UPDATE feature_flags SET enabled = ? WHERE key = ?')
      .bind(enabled ? 1 : 0, key)
      .run();
  }
  invalidateFlagCache();
}
