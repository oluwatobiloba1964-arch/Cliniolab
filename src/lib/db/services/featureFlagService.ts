import { getDb } from '@/lib/db/client';
import type { FeatureFlag, FeatureFlagKey } from '@/types';

interface FlagRow {
  key: string;
  enabled: number;
  label: string | null;
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
  const flags = await listFeatureFlags();
  const map = {} as Record<FeatureFlagKey, boolean>;
  for (const f of flags) map[f.key] = f.enabled;
  return map;
}

export async function isFeatureEnabled(key: FeatureFlagKey): Promise<boolean> {
  const db = getDb();
  const row = await db
    .prepare('SELECT enabled FROM feature_flags WHERE key = ?')
    .bind(key)
    .first<{ enabled: number }>();
  // Default to enabled if the flag row is missing, so a forgotten flag
  // doesn't silently hide a feature.
  return row ? row.enabled === 1 : true;
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
}
