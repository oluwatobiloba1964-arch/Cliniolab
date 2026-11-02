import { getDb, generateId, nowIso } from '@/lib/db/client';
import { getOrCreateResourceCategory } from '@/lib/db/services/resourceCategoryService';
import type {
  PurchaseStatus,
  Resource,
  ResourceAccessState,
  ResourceKind,
  ResourcePricing,
  ResourcePurchase,
} from '@/types';

interface ResourceRow {
  id: string;
  kind: string;
  category_id: string | null;
  category_name: string | null;
  category_slug: string | null;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  institution_name: string | null;
  subject_tag: string | null;
  pricing: string;
  price_kobo: number | null;
  drive_link: string;
  uploaded_by: string;
  status: string;
  created_at: string;
}

// Joins in the category name/slug for display without a second round trip.
// `status` on resources is unrelated to `resources.status`, so it's aliased
// away in mapResource below rather than colliding on the row shape.
const RESOURCE_SELECT = `
  SELECT r.*, rc.name AS category_name, rc.slug AS category_slug
  FROM resources r
  LEFT JOIN resource_categories rc ON rc.id = r.category_id
`;

interface PurchaseRow {
  id: string;
  resource_id: string;
  user_id: string;
  proof_image_url: string | null;
  tx_ref: string | null;
  flw_transaction_id: string | null;
  status: string;
  confirmed_by: string | null;
  created_at: string;
  confirmed_at: string | null;
}

/** Public-safe mapping - never includes drive_link. */
function mapResource(row: ResourceRow): Resource {
  return {
    id: row.id,
    kind: row.kind as ResourceKind,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categorySlug: row.category_slug,
    title: row.title,
    description: row.description,
    coverImageUrl: row.cover_image_url,
    institutionName: row.institution_name,
    subjectTag: row.subject_tag,
    pricing: row.pricing as ResourcePricing,
    priceKobo: row.price_kobo,
    uploadedBy: row.uploaded_by,
    status: row.status as Resource['status'],
    createdAt: row.created_at,
  };
}

function mapPurchase(row: PurchaseRow): ResourcePurchase {
  return {
    id: row.id,
    resourceId: row.resource_id,
    userId: row.user_id,
    proofImageUrl: row.proof_image_url,
    txRef: row.tx_ref,
    flwTransactionId: row.flw_transaction_id,
    status: row.status as PurchaseStatus,
    confirmedBy: row.confirmed_by,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
  };
}

export async function listResources(limit?: number): Promise<Resource[]> {
  const db = getDb();
  const query = `${RESOURCE_SELECT} WHERE r.status = 'published' ORDER BY r.created_at DESC${
    limit ? ' LIMIT ?' : ''
  }`;
  const stmt = limit ? db.prepare(query).bind(limit) : db.prepare(query);
  const { results } = await stmt.all<ResourceRow>();
  return results.map(mapResource);
}

export async function adminListAllResources(): Promise<Resource[]> {
  const db = getDb();
  const { results } = await db
    .prepare(`${RESOURCE_SELECT} ORDER BY r.created_at DESC`)
    .all<ResourceRow>();
  return results.map(mapResource);
}

export async function getResourceById(id: string): Promise<Resource | null> {
  const db = getDb();
  const row = await db
    .prepare(`${RESOURCE_SELECT} WHERE r.id = ?`)
    .bind(id)
    .first<ResourceRow>();
  return row ? mapResource(row) : null;
}

/** Fetches specific resources by id — used by the bookmarks page. */
export async function getResourcesByIds(ids: string[]): Promise<Resource[]> {
  if (ids.length === 0) return [];
  const db = getDb();
  const placeholders = ids.map(() => '?').join(',');
  const { results } = await db
    .prepare(`${RESOURCE_SELECT} WHERE r.id IN (${placeholders})`)
    .bind(...ids)
    .all<ResourceRow>();
  return results.map(mapResource);
}

export async function createResource(
  uploadedBy: string,
  input: {
    kind: ResourceKind;
    categoryId?: string | null;
    newCategoryName?: string; // if set, get-or-create a category by this name under `kind` and use it
    title: string;
    description?: string;
    coverImageUrl?: string;
    institutionName?: string;
    subjectTag?: string;
    pricing: ResourcePricing;
    priceKobo?: number;
    driveLink: string;
  }
): Promise<Resource> {
  const db = getDb();
  const id = generateId('resource');
  const createdAt = nowIso();

  let categoryId = input.categoryId ?? null;
  if (input.newCategoryName?.trim()) {
    const category = await getOrCreateResourceCategory(input.kind, input.newCategoryName.trim());
    categoryId = category.id;
  }

  await db
    .prepare(
      `INSERT INTO resources
        (id, kind, category_id, title, description, cover_image_url, institution_name, subject_tag, pricing, price_kobo, drive_link, uploaded_by, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?)`
    )
    .bind(
      id,
      input.kind,
      categoryId,
      input.title,
      input.description ?? null,
      input.coverImageUrl ?? null,
      input.institutionName ?? null,
      input.subjectTag ?? null,
      input.pricing,
      input.pricing === 'paid' ? input.priceKobo ?? null : null,
      input.driveLink,
      uploadedBy,
      createdAt
    )
    .run();

  const created = await getResourceById(id);
  if (!created) throw new Error('Failed to load resource after creation');
  return created;
}

export async function updateResource(
  id: string,
  input: {
    kind?: ResourceKind;
    categoryId?: string | null; // pass null explicitly to clear
    newCategoryName?: string; // if set, get-or-create a category by this name under the resolved kind and use it
    title?: string;
    description?: string | null;
    coverImageUrl?: string | null;
    institutionName?: string | null;
    subjectTag?: string | null;
    pricing?: ResourcePricing;
    priceKobo?: number | null;
    driveLink?: string;
  }
): Promise<Resource | null> {
  const db = getDb();
  const existing = await db.prepare('SELECT * FROM resources WHERE id = ?').bind(id).first<ResourceRow>();
  if (!existing) return null;

  const kind = input.kind ?? (existing.kind as ResourceKind);
  const pricing = input.pricing ?? (existing.pricing as ResourcePricing);
  const priceKobo =
    pricing === 'paid'
      ? input.priceKobo !== undefined
        ? input.priceKobo
        : existing.price_kobo
      : null;

  let categoryId = input.categoryId !== undefined ? input.categoryId : existing.category_id;
  if (input.newCategoryName?.trim()) {
    const category = await getOrCreateResourceCategory(kind, input.newCategoryName.trim());
    categoryId = category.id;
  }

  await db
    .prepare(
      `UPDATE resources SET
        kind = ?, category_id = ?, title = ?, description = ?, cover_image_url = ?,
        institution_name = ?, subject_tag = ?, pricing = ?, price_kobo = ?, drive_link = ?
       WHERE id = ?`
    )
    .bind(
      kind,
      categoryId,
      input.title ?? existing.title,
      input.description !== undefined ? input.description : existing.description,
      input.coverImageUrl !== undefined ? input.coverImageUrl : existing.cover_image_url,
      input.institutionName !== undefined ? input.institutionName : existing.institution_name,
      input.subjectTag !== undefined ? input.subjectTag : existing.subject_tag,
      pricing,
      priceKobo,
      input.driveLink ?? existing.drive_link,
      id
    )
    .run();

  return getResourceById(id);
}

export async function deleteResource(id: string): Promise<void> {
  const db = getDb();
  // Delete child rows first (resource_purchases) before the parent row
  // (resources) to satisfy FK constraints on D1 Workers where
  // PRAGMA foreign_keys is ON by default.
  //
  // Wrapped in try/catch: if the resource_purchases table hasn't been
  // created yet in this D1 database (migration not yet run), SQLite
  // throws SQLITE_ERROR on the first statement. We swallow that specific
  // case so the parent row can still be deleted — purchases are empty
  // by definition when the table doesn't exist yet.
  try {
    await db.prepare('DELETE FROM resource_purchases WHERE resource_id = ?').bind(id).run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Only swallow "table not found" style errors; re-throw everything else.
    if (!msg.includes('no such table') && !msg.includes('SQLITE_ERROR')) {
      throw err;
    }
    // Table doesn't exist yet — safe to continue, no purchases to delete.
    console.warn('[deleteResource] resource_purchases table missing — run migration. Skipping child delete.');
  }
  await db.prepare('DELETE FROM resources WHERE id = ?').bind(id).run();
}

/**
 * Determines what button/state a specific user should see for a resource,
 * WITHOUT ever including the real drive_link. Use resolveDownloadLink
 * separately, at the moment of an actual click, to get the real URL.
 */
export async function getAccessState(resourceId: string, userId: string): Promise<ResourceAccessState> {
  const resource = await getResourceById(resourceId);
  if (!resource) throw new Error('Resource not found');

  if (resource.pricing === 'free') {
    return { resource, access: 'download' };
  }

  const db = getDb();
  const purchase = await db
    .prepare('SELECT * FROM resource_purchases WHERE resource_id = ? AND user_id = ?')
    .bind(resourceId, userId)
    .first<PurchaseRow>();

  if (!purchase) return { resource, access: 'pay_to_unlock' };
  if (purchase.status === 'confirmed') return { resource, access: 'download' };
  if (purchase.status === 'rejected') return { resource, access: 'payment_rejected' };
  return { resource, access: 'payment_pending' };
}

/**
 * Resolves the real Drive link for a download click, re-checking access
 * server-side rather than trusting any client-provided state. Returns
 * null if the user isn't entitled (caller should respond 403).
 */
export async function resolveDownloadLink(resourceId: string, userId: string): Promise<string | null> {
  const state = await getAccessState(resourceId, userId);
  if (state.access !== 'download') return null;

  const db = getDb();
  const row = await db
    .prepare('SELECT drive_link FROM resources WHERE id = ?')
    .bind(resourceId)
    .first<{ drive_link: string }>();
  return row?.drive_link ?? null;
}

/** Admin/moderator always gets the real link, regardless of purchase state. */
export async function getDriveLinkForManagement(resourceId: string): Promise<string | null> {
  const db = getDb();
  const row = await db
    .prepare('SELECT drive_link FROM resources WHERE id = ?')
    .bind(resourceId)
    .first<{ drive_link: string }>();
  return row?.drive_link ?? null;
}

/** User submits proof of payment (a screenshot/receipt URL) for a paid resource. */
export async function submitPurchaseProof(
  resourceId: string,
  userId: string,
  proofImageUrl: string
): Promise<ResourcePurchase> {
  const db = getDb();
  const existing = await db
    .prepare('SELECT * FROM resource_purchases WHERE resource_id = ? AND user_id = ?')
    .bind(resourceId, userId)
    .first<PurchaseRow>();

  if (existing) {
    // Re-submitting (e.g. after a rejection) resets to pending with the new proof.
    await db
      .prepare(
        "UPDATE resource_purchases SET proof_image_url = ?, status = 'pending', confirmed_by = NULL, confirmed_at = NULL WHERE id = ?"
      )
      .bind(proofImageUrl, existing.id)
      .run();
    return mapPurchase({ ...existing, proof_image_url: proofImageUrl, status: 'pending', confirmed_by: null, confirmed_at: null });
  }

  const id = generateId('purchase');
  const createdAt = nowIso();
  await db
    .prepare(
      `INSERT INTO resource_purchases (id, resource_id, user_id, proof_image_url, status, created_at)
       VALUES (?, ?, ?, ?, 'pending', ?)`
    )
    .bind(id, resourceId, userId, proofImageUrl, createdAt)
    .run();

  return {
    id,
    resourceId,
    userId,
    proofImageUrl,
    txRef: null,
    flwTransactionId: null,
    status: 'pending',
    confirmedBy: null,
    createdAt,
    confirmedAt: null,
  };
}

/**
 * Creates a pending purchase record right before redirecting to
 * Flutterwave checkout (flutterwave payment mode only). Distinct from
 * submitPurchaseProof, which is the manual-mode entry point.
 */
export async function createPendingFlutterwavePurchase(
  resourceId: string,
  userId: string,
  txRef: string
): Promise<ResourcePurchase> {
  const db = getDb();
  const existing = await db
    .prepare('SELECT * FROM resource_purchases WHERE resource_id = ? AND user_id = ?')
    .bind(resourceId, userId)
    .first<PurchaseRow>();

  if (existing) {
    await db
      .prepare("UPDATE resource_purchases SET tx_ref = ?, status = 'pending' WHERE id = ?")
      .bind(txRef, existing.id)
      .run();
    return mapPurchase({ ...existing, tx_ref: txRef, status: 'pending' });
  }

  const id = generateId('purchase');
  const createdAt = nowIso();
  await db
    .prepare(
      `INSERT INTO resource_purchases (id, resource_id, user_id, tx_ref, status, created_at)
       VALUES (?, ?, ?, ?, 'pending', ?)`
    )
    .bind(id, resourceId, userId, txRef, createdAt)
    .run();

  return {
    id,
    resourceId,
    userId,
    proofImageUrl: null,
    txRef,
    flwTransactionId: null,
    status: 'pending',
    confirmedBy: null,
    createdAt,
    confirmedAt: null,
  };
}

/**
 * Auto-confirms a Flutterwave-mode purchase once payment is verified —
 * no admin step, unlike the manual-mode confirm/reject flow.
 */
export async function markFlutterwavePurchaseConfirmed(txRef: string, flwTransactionId: string): Promise<void> {
  const db = getDb();
  await db
    .prepare(
      "UPDATE resource_purchases SET status = 'confirmed', flw_transaction_id = ?, confirmed_at = ? WHERE tx_ref = ?"
    )
    .bind(flwTransactionId, nowIso(), txRef)
    .run();
}

export async function getPurchaseByTxRef(txRef: string): Promise<ResourcePurchase | null> {
  const db = getDb();
  const row = await db
    .prepare('SELECT * FROM resource_purchases WHERE tx_ref = ?')
    .bind(txRef)
    .first<PurchaseRow>();
  return row ? mapPurchase(row) : null;
}

/** Admin-only: confirm or reject a pending purchase. */
export async function updatePurchaseStatus(
  purchaseId: string,
  adminId: string,
  status: 'confirmed' | 'rejected'
): Promise<void> {
  const db = getDb();
  const confirmedAt = status === 'confirmed' ? nowIso() : null;
  await db
    .prepare(
      'UPDATE resource_purchases SET status = ?, confirmed_by = ?, confirmed_at = ? WHERE id = ?'
    )
    .bind(status, adminId, confirmedAt, purchaseId)
    .run();
}

export async function listPendingPurchases(): Promise<(ResourcePurchase & { resourceTitle: string })[]> {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT p.*, r.title as resource_title FROM resource_purchases p
       JOIN resources r ON r.id = p.resource_id
       WHERE p.status = 'pending'
       ORDER BY p.created_at ASC`
    )
    .all<PurchaseRow & { resource_title: string }>();
  return results.map((row) => ({ ...mapPurchase(row), resourceTitle: row.resource_title }));
}
