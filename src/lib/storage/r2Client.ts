/**
 * Storage bucket wrapper, mirroring the D1 client pattern: this is the
 * only file allowed to touch storage bindings directly. Everything else
 * goes through uploadImage()/deleteImage() below.
 *
 * R2 is accessed two ways behind the same R2Bucket interface:
 *  - Workers binding (Cloudflare Pages production)
 *  - S3-compatible API (Vercel testing) — hits the SAME R2 bucket as
 *    production, just over R2's S3-compatible HTTPS endpoint instead of
 *    a binding.
 *
 * Selected the same way as the DB driver: STORAGE_DRIVER env var, or
 * inferred from R2_ACCESS_KEY_ID presence when unset.
 */
export interface R2Bucket {
  put(key: string, value: ArrayBuffer | ArrayBufferView | ReadableStream, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  delete(key: string): Promise<void>;
  get(key: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string } } | null>;
  list(options?: { prefix?: string; cursor?: string; limit?: number }): Promise<{
    objects: { key: string; size: number; uploaded: Date }[];
    cursor?: string;
    truncated: boolean;
  }>;
}

type StorageDriver = 'binding' | 's3';

function resolveStorageDriver(): StorageDriver {
  const explicit = process.env.STORAGE_DRIVER as StorageDriver | undefined;
  if (explicit === 'binding' || explicit === 's3') return explicit;
  return process.env.R2_ACCESS_KEY_ID ? 's3' : 'binding';
}

function getR2BindingBucket(): R2Bucket {
  // Loaded via indirect eval, not a literal require(...), so Turbopack's
  // bundler and the TypeScript checker never try to resolve this module
  // on Vercel, where @cloudflare/next-on-pages is never installed (no
  // package, no type declarations).
  let getRequestContext: () => { env: Record<string, unknown> };
  try {
    // eslint-disable-next-line no-eval
    const dynamicRequire = eval('require') as NodeRequire;
    ({ getRequestContext } = dynamicRequire('@cloudflare/next-on-pages'));
  } catch {
    throw new Error(
      "@cloudflare/next-on-pages is not installed. This code path only runs on Cloudflare Pages; " +
        'set STORAGE_DRIVER=s3 (or R2_ACCESS_KEY_ID) to use the R2 S3-compatible API instead.'
    );
  }
  const env = getRequestContext().env as { IMAGES?: R2Bucket };
  if (!env.IMAGES) {
    throw new Error("R2 binding 'IMAGES' is not configured. Add an [[r2_buckets]] binding named IMAGES in wrangler.toml.");
  }
  return env.IMAGES;
}

let r2S3Singleton: R2Bucket | undefined;

function getR2S3Bucket(): R2Bucket {
  if (!r2S3Singleton) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createR2S3Adapter } = require('@/lib/storage/r2S3Adapter') as typeof import('@/lib/storage/r2S3Adapter');
    r2S3Singleton = createR2S3Adapter();
  }
  return r2S3Singleton;
}

function getBucket(): R2Bucket {
  return resolveStorageDriver() === 's3' ? getR2S3Bucket() : getR2BindingBucket();
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
// Uploads are downscaled and re-encoded before storage (see watermark.ts),
// so this only guards what the server has to decode, not what gets stored.
const MAX_BYTES = 3 * 1024 * 1024; // 3MB
// Animated GIFs can't be processed by Photon (it flattens to frame 1), so
// they are stored as-is. Keep them small since they bypass compression.
const MAX_GIF_BYTES = 1 * 1024 * 1024; // 1MB

export class ImageUploadError extends Error {}

/**
 * Uploads an image file to R2 and returns a public-servable path
 * (served back out via /api/images/[key], not a direct R2 URL, so we
 * control caching/headers centrally).
 *
 * Every upload is downscaled, compressed to JPEG, and (except avatars)
 * watermarked with the Cliniolab logo before it's stored - see
 * watermark.ts. GIFs are the one exception: Photon only reads/writes
 * static frames and would flatten an animated GIF to its first frame, so
 * they're stored as-is under a tighter size cap. 'avatars' skips the
 * watermark only: a user's own profile photo shouldn't be stamped with
 * the platform logo the way promotional content is, but it is still
 * resized (256px) so avatars can't quietly eat the bucket.
 */
export async function uploadImage(
  file: File,
  keyPrefix: 'blog' | 'resources' | 'banners' | 'scholars' | 'avatars'
): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new ImageUploadError('Only JPEG, PNG, WEBP, or GIF images are allowed.');
  }
  if (file.size > MAX_BYTES) {
    throw new ImageUploadError('Image must be smaller than 3MB.');
  }
  if (file.type === 'image/gif' && file.size > MAX_GIF_BYTES) {
    throw new ImageUploadError('GIFs must be smaller than 1MB. Use a JPEG or PNG for still images.');
  }

  const bucket = getBucket();
  const originalBuffer = await file.arrayBuffer();

  let outBytes: ArrayBuffer | Uint8Array = originalBuffer;
  let ext = file.type.split('/')[1];
  let contentType = file.type;

  if (file.type !== 'image/gif') {
    try {
      const { processImage } = await import('@/lib/storage/watermark');
      const processed = await processImage(new Uint8Array(originalBuffer), keyPrefix, {
        // Avatars are a user's own photo - resized/compressed like the rest
        // but never stamped with the platform logo.
        applyWatermark: keyPrefix !== 'avatars',
      });
      outBytes = processed.bytes;
      ext = processed.ext;
      contentType = processed.contentType;
    } catch (err) {
      // Processing is layered on top of a working upload path; a WASM init
      // failure or decode edge case shouldn't block an admin from
      // publishing. Fall back to the original bytes - but the stricter
      // size cap below still applies so a fallback can't sneak in a huge file.
      console.error('Image processing failed, storing original instead:', err);
      if (originalBuffer.byteLength > 1024 * 1024) {
        throw new ImageUploadError(
          'Could not process this image. Try a smaller file (under 1MB) or a different format.'
        );
      }
      outBytes = originalBuffer;
      ext = file.type.split('/')[1];
      contentType = file.type;
    }
  }

  const key = `${keyPrefix}/${crypto.randomUUID()}.${ext}`;
  await bucket.put(key, outBytes, { httpMetadata: { contentType } });

  return `/api/images/${key}`;
}

export async function deleteImageByPath(imagePath: string): Promise<void> {
  // imagePath looks like /api/images/blog/uuid.png - strip the API prefix
  // to get back the raw R2 key.
  const key = imagePath.replace(/^\/api\/images\//, '');
  if (!key) return;
  const bucket = getBucket();
  await bucket.delete(key);
}

export async function getImageObject(key: string) {
  const bucket = getBucket();
  return bucket.get(key);
}

export interface StoredImage {
  path: string; // /api/images/<key>, ready to use as an <img src>
  key: string;
  purpose: string; // the keyPrefix folder, e.g. "blog"
  size: number;
  uploadedAt: string; // ISO timestamp
}

/**
 * Lists previously uploaded images so the admin can reuse one instead of
 * uploading the same file again — e.g. a diagram already used in one
 * post that fits a later post too. Scoped by purpose/folder (blog,
 * resources, banners, scholars) since that's how uploadImage() already
 * organizes keys; pass no purpose to list across all of them.
 */
export async function listImages(purpose?: 'blog' | 'resources' | 'banners' | 'scholars', cursor?: string): Promise<{
  images: StoredImage[];
  nextCursor?: string;
}> {
  const bucket = getBucket();
  const result = await bucket.list({ prefix: purpose ? `${purpose}/` : undefined, cursor, limit: 60 });
  const images: StoredImage[] = result.objects
    .filter((obj) => !obj.key.endsWith('/')) // skip any folder placeholder entries
    .map((obj) => ({
      path: `/api/images/${obj.key}`,
      key: obj.key,
      purpose: obj.key.split('/')[0] ?? 'unknown',
      size: obj.size,
      uploadedAt: new Date(obj.uploaded).toISOString(),
    }))
    // Newest first — mirrors how the admin thinks about "the image I just used".
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

  return { images, nextCursor: result.truncated ? result.cursor : undefined };
}

// ---------------------------------------------------------------------------
// Orphan cleanup
// ---------------------------------------------------------------------------

const IMAGE_PATH_PATTERN = /\/api\/images\/((?:blog|resources|banners|scholars|avatars)\/[A-Za-z0-9._-]+)/g;

/**
 * Pulls every /api/images/... reference out of arbitrary text (blog HTML or
 * markdown, a single URL column, etc.) and returns the R2 keys. Only keys
 * under our own upload prefixes match, so an external image URL is never
 * mistaken for something we own and try to delete.
 */
export function extractImageKeys(text: string | null | undefined): string[] {
  if (!text) return [];
  const keys = new Set<string>();
  for (const match of text.matchAll(IMAGE_PATH_PATTERN)) {
    keys.add(match[1]);
  }
  return [...keys];
}

/**
 * Deletes the given R2 keys, skipping any that `isStillReferenced` reports
 * as used elsewhere. The admin image library deliberately lets one upload
 * be reused across several posts/resources, so a blind delete when one post
 * is removed would break the others' images.
 *
 * Best-effort by design: this runs AFTER the database row is already gone,
 * and a failed R2 delete just leaves an orphan for the weekly sweep to pick
 * up. It must never make a successful content deletion look like a failure.
 * Returns how many objects were actually deleted.
 */
export async function deleteImageKeysIfUnreferenced(
  keys: string[],
  isStillReferenced: (key: string) => Promise<boolean>
): Promise<number> {
  // FIX (Vercel Hobby duration budget) — src/lib/storage/r2Client.ts
  // Was: one isStillReferenced check + one R2 delete per key, fully
  // sequential — a post/resource with many embedded images meant that
  // many round trips, one after another, in the request that deletes it.
  // Now: all keys are processed concurrently. Each key's own try/catch is
  // preserved so one failing delete still can't abort the others (same
  // "best-effort, never fail the caller" contract as before).
  const bucket = getBucket();
  const results = await Promise.all(
    keys.map(async (key) => {
      try {
        if (await isStillReferenced(key)) return false;
        await bucket.delete(key);
        return true;
      } catch (err) {
        console.error(`Failed to delete orphaned image ${key} (non-fatal):`, err);
        return false;
      }
    })
  );
  return results.filter(Boolean).length;
}

export interface StoredObjectInfo {
  key: string;
  size: number;
  uploaded: Date;
}

/**
 * Walks the whole bucket (paginated) for the orphan sweep. Returns object
 * metadata only, never bodies.
 */
export async function listAllObjects(maxObjects = 5000): Promise<StoredObjectInfo[]> {
  const bucket = getBucket();
  const all: StoredObjectInfo[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ cursor, limit: 1000 });
    for (const obj of page.objects) {
      if (!obj.key.endsWith('/')) all.push({ key: obj.key, size: obj.size, uploaded: obj.uploaded });
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor && all.length < maxObjects);
  return all;
}

export async function deleteObjectsByKey(keys: string[]): Promise<number> {
  // FIX (Vercel Hobby duration budget) — src/lib/storage/r2Client.ts
  // Was: one R2 delete per key, fully sequential. This backs the orphan
  // sweep over listAllObjects (up to thousands of keys) — sequential
  // deletes there could easily run the sweep past Hobby's function
  // duration limit. Now: chunked concurrency (CHUNK_SIZE at a time)
  // rather than one at a time or all-at-once, since firing thousands of
  // simultaneous R2 deletes in one invocation risks its own connection
  // limits.
  const CHUNK_SIZE = 50;
  const bucket = getBucket();
  let deleted = 0;
  for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
    const chunk = keys.slice(i, i + CHUNK_SIZE);
    const results = await Promise.all(
      chunk.map(async (key) => {
        try {
          await bucket.delete(key);
          return true;
        } catch (err) {
          console.error(`Failed to delete object ${key} (non-fatal):`, err);
          return false;
        }
      })
    );
    deleted += results.filter(Boolean).length;
  }
  return deleted;
}
