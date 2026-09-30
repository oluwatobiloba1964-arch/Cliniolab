import { getDb, nowIso } from '@/lib/db/client';
import type {
  AuthorBoxSetting,
  GuestCreatorAccess,
  GuestPracticeSetting,
  OfflineSetting,
  ThemeDefault,
  ThemeSetting,
} from '@/types';

/**
 * Admin-editable settings for Guest Practice, theme, offline downloads and
 * the author/reviewer box. All stored as JSON rows in site_settings (same
 * table the other admin settings use), so no schema change is needed and
 * nothing here is hardcoded: defaults only apply until an admin saves.
 */

interface SettingRow {
  key: string;
  value: string;
  updated_at: string;
}

export const DEFAULT_GUEST_PRACTICE: GuestPracticeSetting = {
  homepageCount: 15,
  autoplay: true,
  intervalSeconds: 5,
  creatorAccess: 'all',
  sectionTitle: 'Guest Practice',
  sectionSubtitle: 'Try quizzes, study mode and flashcards right now. No account needed.',
  includeInSitemap: true,
};

export const DEFAULT_THEME: ThemeSetting = { defaultTheme: 'system' };

export const DEFAULT_OFFLINE: OfflineSetting = { maxItems: 20, allowPaid: true, refreshDays: 7 };

export const DEFAULT_AUTHOR_BOX: AuthorBoxSetting = {
  showAuthorBox: true,
  showReviewer: true,
  reviewerLabel: 'Medically reviewed by',
  editorialPolicyUrl: '/editorial-policy',
  medicalReviewPolicyUrl: '/medical-review-policy',
};

async function readSetting<T extends object>(key: string, defaults: T): Promise<T> {
  const db = getDb();
  const row = await db.prepare('SELECT * FROM site_settings WHERE key = ?').bind(key).first<SettingRow>();
  if (!row) return defaults;
  try {
    return { ...defaults, ...(JSON.parse(row.value) as Partial<T>) };
  } catch {
    return defaults;
  }
}

async function writeSetting(key: string, value: unknown): Promise<void> {
  const db = getDb();
  await db
    .prepare(
      `INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .bind(key, JSON.stringify(value), nowIso())
    .run();
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function cleanText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

// ---- Guest Practice ----

export async function getGuestPracticeSetting(): Promise<GuestPracticeSetting> {
  const s = await readSetting('guest_practice', DEFAULT_GUEST_PRACTICE);
  return normalizeGuest(s);
}

function normalizeGuest(s: GuestPracticeSetting): GuestPracticeSetting {
  const access: GuestCreatorAccess =
    s.creatorAccess === 'admin_only' || s.creatorAccess === 'admin_moderator' ? s.creatorAccess : 'all';
  return {
    homepageCount: clampInt(s.homepageCount, 3, 30, DEFAULT_GUEST_PRACTICE.homepageCount),
    autoplay: !!s.autoplay,
    intervalSeconds: clampInt(s.intervalSeconds, 2, 30, DEFAULT_GUEST_PRACTICE.intervalSeconds),
    creatorAccess: access,
    sectionTitle: cleanText(s.sectionTitle, DEFAULT_GUEST_PRACTICE.sectionTitle, 60),
    sectionSubtitle: cleanText(s.sectionSubtitle, DEFAULT_GUEST_PRACTICE.sectionSubtitle, 160),
    includeInSitemap: !!s.includeInSitemap,
  };
}

export async function setGuestPracticeSetting(setting: GuestPracticeSetting): Promise<GuestPracticeSetting> {
  const clean = normalizeGuest({ ...DEFAULT_GUEST_PRACTICE, ...setting });
  await writeSetting('guest_practice', clean);
  return clean;
}

// ---- Theme ----

export async function getThemeSetting(): Promise<ThemeSetting> {
  const s = await readSetting('theme', DEFAULT_THEME);
  const allowed: ThemeDefault[] = ['system', 'light', 'dark'];
  return { defaultTheme: allowed.includes(s.defaultTheme) ? s.defaultTheme : 'system' };
}

export async function setThemeSetting(setting: ThemeSetting): Promise<ThemeSetting> {
  const allowed: ThemeDefault[] = ['system', 'light', 'dark'];
  const clean: ThemeSetting = { defaultTheme: allowed.includes(setting.defaultTheme) ? setting.defaultTheme : 'system' };
  await writeSetting('theme', clean);
  return clean;
}

// ---- Offline ----

export async function getOfflineSetting(): Promise<OfflineSetting> {
  const s = await readSetting('offline', DEFAULT_OFFLINE);
  return {
    maxItems: clampInt(s.maxItems, 1, 100, DEFAULT_OFFLINE.maxItems),
    allowPaid: !!s.allowPaid,
    refreshDays: clampInt(s.refreshDays, 1, 90, DEFAULT_OFFLINE.refreshDays),
  };
}

export async function setOfflineSetting(setting: OfflineSetting): Promise<OfflineSetting> {
  const clean: OfflineSetting = {
    maxItems: clampInt(setting.maxItems, 1, 100, DEFAULT_OFFLINE.maxItems),
    allowPaid: !!setting.allowPaid,
    refreshDays: clampInt(setting.refreshDays, 1, 90, DEFAULT_OFFLINE.refreshDays),
  };
  await writeSetting('offline', clean);
  return clean;
}

// ---- Author / reviewer box ----

export async function getAuthorBoxSetting(): Promise<AuthorBoxSetting> {
  const s = await readSetting('author_box', DEFAULT_AUTHOR_BOX);
  return {
    showAuthorBox: !!s.showAuthorBox,
    showReviewer: !!s.showReviewer,
    reviewerLabel: cleanText(s.reviewerLabel, DEFAULT_AUTHOR_BOX.reviewerLabel, 60),
    editorialPolicyUrl: cleanText(s.editorialPolicyUrl, DEFAULT_AUTHOR_BOX.editorialPolicyUrl, 200),
    medicalReviewPolicyUrl: cleanText(s.medicalReviewPolicyUrl, DEFAULT_AUTHOR_BOX.medicalReviewPolicyUrl, 200),
  };
}

export async function setAuthorBoxSetting(setting: AuthorBoxSetting): Promise<AuthorBoxSetting> {
  const clean: AuthorBoxSetting = {
    showAuthorBox: !!setting.showAuthorBox,
    showReviewer: !!setting.showReviewer,
    reviewerLabel: cleanText(setting.reviewerLabel, DEFAULT_AUTHOR_BOX.reviewerLabel, 60),
    editorialPolicyUrl: cleanText(setting.editorialPolicyUrl, DEFAULT_AUTHOR_BOX.editorialPolicyUrl, 200),
    medicalReviewPolicyUrl: cleanText(setting.medicalReviewPolicyUrl, DEFAULT_AUTHOR_BOX.medicalReviewPolicyUrl, 200),
  };
  await writeSetting('author_box', clean);
  return clean;
}
