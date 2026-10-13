// src/lib/db/services/quiz/quizPasswordService.ts
// Password hashing, private-link access mode, expiry, and share-slug rotation.

import { getDb, nowIso } from '@/lib/db/client';
import type { LinkExpiryOption, QuizAccessMode, QuizStatus, QuizVisibility } from '@/types';

const PBKDF2_ITERATIONS = 100_000;

function bufToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return { hash: bufToHex(derived), salt: bufToHex(salt.buffer as ArrayBuffer) };
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBuf(salt).buffer as ArrayBuffer, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return bufToHex(derived) === hash;
}

export function computeExpiryDate(
  option: LinkExpiryOption | undefined,
  customDate?: string
): string | null {
  if (!option) return null;
  const now = new Date();
  switch (option) {
    case '1d': now.setDate(now.getDate() + 1); return now.toISOString();
    case '3d': now.setDate(now.getDate() + 3); return now.toISOString();
    case '7d': now.setDate(now.getDate() + 7); return now.toISOString();
    case 'custom':
      if (!customDate) throw new Error('customExpiryDate is required when linkExpiry is "custom"');
      return new Date(customDate).toISOString();
    default: return null;
  }
}

function generateShareSlug(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

export async function regenerateShareLink(
  quizId: string,
  linkExpiry?: LinkExpiryOption,
  customExpiryDate?: string
): Promise<{ shareSlug: string; linkExpiresAt: string | null }> {
  const db = getDb();
  const shareSlug = generateShareSlug();
  const linkExpiresAt = computeExpiryDate(linkExpiry, customExpiryDate);
  await db
    .prepare('UPDATE quizzes SET share_slug = ?, link_expires_at = ?, updated_at = ? WHERE id = ?')
    .bind(shareSlug, linkExpiresAt, nowIso(), quizId)
    .run();
  return { shareSlug, linkExpiresAt };
}

export async function setQuizVisibility(
  quizId: string,
  visibility: QuizVisibility,
  linkExpiry?: LinkExpiryOption,
  customExpiryDate?: string,
  accessMode?: QuizAccessMode,
  password?: string
): Promise<void> {
  const db = getDb();

  if (visibility === 'guest') {
    await db
      .prepare(
        `UPDATE quizzes
         SET visibility = 'guest', share_slug = NULL, link_expires_at = NULL,
             access_mode = 'link', password_hash = NULL, password_salt = NULL, updated_at = ?
         WHERE id = ?`
      )
      .bind(nowIso(), quizId)
      .run();
    return;
  }

  if (visibility === 'public') {
    await db
      .prepare(
        `UPDATE quizzes
         SET visibility = 'public', share_slug = NULL, link_expires_at = NULL,
             access_mode = 'link', password_hash = NULL, password_salt = NULL, updated_at = ?
         WHERE id = ?`
      )
      .bind(nowIso(), quizId)
      .run();
    return;
  }

  const shareSlug = generateShareSlug();
  const mode: QuizAccessMode = accessMode ?? 'link';

  if (mode === 'password') {
    if (!password) throw new Error('A password is required when accessMode is "password"');
    const { hash, salt } = await hashPassword(password);
    await db
      .prepare(
        `UPDATE quizzes
         SET visibility = 'private', share_slug = ?, link_expires_at = NULL,
             access_mode = 'password', password_hash = ?, password_salt = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(shareSlug, hash, salt, nowIso(), quizId)
      .run();
    return;
  }

  const linkExpiresAt = computeExpiryDate(linkExpiry, customExpiryDate);
  await db
    .prepare(
      `UPDATE quizzes
       SET visibility = 'private', share_slug = ?, link_expires_at = ?,
           access_mode = 'link', password_hash = NULL, password_salt = NULL, updated_at = ?
       WHERE id = ?`
    )
    .bind(shareSlug, linkExpiresAt, nowIso(), quizId)
    .run();
}

export async function setQuizPassword(quizId: string, password: string): Promise<void> {
  const db = getDb();
  const { hash, salt } = await hashPassword(password);
  await db
    .prepare(
      `UPDATE quizzes
       SET access_mode = 'password', password_hash = ?, password_salt = ?, updated_at = ?
       WHERE id = ? AND visibility = 'private'`
    )
    .bind(hash, salt, nowIso(), quizId)
    .run();
}

export async function checkQuizPassword(quizId: string, password: string): Promise<boolean> {
  const db = getDb();
  const row = await db
    .prepare(
      `SELECT password_hash, password_salt
       FROM quizzes
       WHERE id = ? AND visibility = 'private' AND access_mode = 'password'`
    )
    .bind(quizId)
    .first<{ password_hash: string | null; password_salt: string | null }>();
  if (!row?.password_hash || !row.password_salt) return false;
  return verifyPassword(password, row.password_hash, row.password_salt);
}

export async function updateQuizStatus(quizId: string, status: QuizStatus): Promise<void> {
  const db = getDb();
  await db
    .prepare('UPDATE quizzes SET status = ?, updated_at = ? WHERE id = ?')
    .bind(status, nowIso(), quizId)
    .run();
}
