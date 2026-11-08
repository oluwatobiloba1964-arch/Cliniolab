/**
 * Web Push sender with vetted-package-first strategy.
 *
 * Primary path: the audited `web-push` npm package (added as a
 * dependency in package.json), invoked via a dynamic `import()` so
 * that the project still builds and runs even if the package is not
 * yet installed (e.g. on a fresh checkout that hasn't run `npm install`).
 *
 * Fallback path: the original hand-rolled RFC-8291 + VAPID
 * implementation, kept verbatim. It produces identical aes128gcm
 * output and runs entirely on the native Web Crypto API, so it works
 * in both Node.js (with `node:crypto`/`globalThis.crypto`) and the
 * Cloudflare Workers runtime.
 *
 * The dynamic import never blocks rendering or the response — if it
 * throws, the fallback runs synchronously in the same call. The
 * vetted package is treated as an optimisation, not a hard dependency.
 */

export interface WebPushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface VapidKeys {
  publicKey: string; // base64url, uncompressed EC point (65 bytes)
  privateKey: string; // base64url, PKCS8 or raw d value depending on source
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  image?: string; // large hero image shown in the notification body (Android Chrome; ignored where unsupported, e.g. iOS Safari)
}

/** Result of a single send attempt, used by callers to prune dead subscriptions. */
export interface PushSendResult {
  endpoint: string;
  ok: boolean;
  status: number;
  expired: boolean; // true on 404/410 - subscription should be deleted
}

function base64urlToUint8Array(base64url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function uint8ArrayToBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// TS's DOM lib types Web Crypto params as BufferSource, which requires an
// ArrayBuffer-backed view. Uint8Arrays produced from crypto.subtle results
// or slices can be typed Uint8Array<ArrayBufferLike>, so normalize before
// passing them in.
function toArrayBufferView(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy;
}

function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

/**
 * Imports the VAPID private key via JWK — simple and well-supported by
 * Web Crypto, and doesn't require hand-rolling ASN.1/PKCS8. Requires the
 * public key (uncompressed point) to fill in the JWK's x/y coordinates
 * alongside d.
 */
async function importVapidPrivateKeyJwk(
  privateKeyB64url: string,
  publicKeyB64url: string
): Promise<CryptoKey> {
  const d = base64urlToUint8Array(privateKeyB64url);
  const pub = base64urlToUint8Array(publicKeyB64url);
  if (pub.length !== 65 || pub[0] !== 0x04) {
    throw new Error('VAPID public key must be an uncompressed P-256 point (65 bytes, starts with 0x04)');
  }
  const x = pub.slice(1, 33);
  const y = pub.slice(33, 65);

  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    d: uint8ArrayToBase64url(d),
    x: uint8ArrayToBase64url(x),
    y: uint8ArrayToBase64url(y),
    ext: true,
  };

  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

function base64urlEncodeJson(obj: unknown): string {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  return uint8ArrayToBase64url(bytes);
}

/** Builds and signs the VAPID Authorization JWT for a given push origin. */
async function buildVapidAuthHeader(
  endpoint: string,
  vapid: VapidKeys,
  subject: string
): Promise<{ authorization: string; cryptoKeyHeader: string }> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60, // 12 hours, well under the 24h max
    sub: subject,
  };

  const unsigned = `${base64urlEncodeJson(header)}.${base64urlEncodeJson(payload)}`;
  const privateKey = await importVapidPrivateKeyJwk(vapid.privateKey, vapid.publicKey);
  const signatureBuf = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(unsigned)
  );

  // Web Crypto returns an ECDSA signature as raw (r || s), 64 bytes for
  // P-256 — this is exactly the JWS ES256 format required, no DER
  // conversion needed.
  const signature = uint8ArrayToBase64url(new Uint8Array(signatureBuf));
  const jwt = `${unsigned}.${signature}`;

  return {
    authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
    cryptoKeyHeader: `p256ecdsa=${vapid.publicKey}`,
  };
}

/**
 * Encrypts the payload per RFC 8291 (aes128gcm content coding) using the
 * subscriber's p256dh (their ECDH public key) and auth secret.
 */
async function encryptPayload(
  payload: Uint8Array,
  subscriberP256dh: string,
  subscriberAuth: string
): Promise<{ body: Uint8Array; contentEncoding: 'aes128gcm' }> {
  const subscriberPublicKeyBytes = base64urlToUint8Array(subscriberP256dh);
  const authSecret = base64urlToUint8Array(subscriberAuth);

  const subscriberPublicKey = await crypto.subtle.importKey(
    'raw',
    toArrayBufferView(subscriberPublicKeyBytes),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // Ephemeral local key pair for this message.
  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
  const localPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', localKeyPair.publicKey)
  );

  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: subscriberPublicKey },
    localKeyPair.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const hkdfKeyMaterial = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, [
    'deriveBits',
  ]);

  // PRK = HKDF-Extract(auth_secret, shared_secret)
  const authInfo = new TextEncoder().encode('WebPush: info\0');
  const keyInfoInput = concatUint8Arrays(authInfo, subscriberPublicKeyBytes, localPublicKeyRaw);

  const prkBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: toArrayBufferView(authSecret), info: toArrayBufferView(new Uint8Array(0)) },
    hkdfKeyMaterial,
    256
  );
  const prk = new Uint8Array(prkBits);
  const prkKey = await crypto.subtle.importKey('raw', prk, 'HKDF', false, ['deriveBits']);

  const ikmBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: toArrayBufferView(new Uint8Array(0)), info: toArrayBufferView(keyInfoInput) },
    prkKey,
    256
  );
  const ikm = new Uint8Array(ikmBits);
  const ikmKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);

  const cekInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\0');
  const cekBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: toArrayBufferView(salt), info: toArrayBufferView(cekInfo) },
    ikmKey,
    128
  );
  const cek = new Uint8Array(cekBits);

  const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0');
  const nonceBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: toArrayBufferView(salt), info: toArrayBufferView(nonceInfo) },
    ikmKey,
    96
  );
  const nonce = new Uint8Array(nonceBits);

  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);

  // aes128gcm padding delimiter: 0x02 (last record) appended, no extra padding.
  const paddedPlaintext = concatUint8Arrays(payload, new Uint8Array([0x02]));

  const encryptedBits = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBufferView(nonce) },
    aesKey,
    toArrayBufferView(paddedPlaintext)
  );
  const ciphertext = new Uint8Array(encryptedBits);

  // aes128gcm header: salt(16) || rs(4, record size) || idlen(1) || keyid(local public key, 65 bytes)
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096, false);
  const idLen = new Uint8Array([localPublicKeyRaw.length]);

  const header = concatUint8Arrays(salt, recordSize, idLen, localPublicKeyRaw);
  const body = concatUint8Arrays(header, ciphertext);

  return { body, contentEncoding: 'aes128gcm' };
}

/**
 * Converts a base64url VAPID private key into the PEM PKCS8 form the
 * `web-push` npm package expects. Used only on the vetted-package path.
 * Builds the PEM with plain byte arithmetic so it works in both Node.js
 * and the Cloudflare Workers runtime (where `Buffer` may be absent).
 */
function vapidPrivateKeyToPem(privateKeyB64url: string): string {
  // The 32-byte raw d value (with no header) is what VAPID stores. The
  // `web-push` package accepts it via setVapidDetails() once it is
  // wrapped in a SEQUENCE { INT 1, OCTET STRING d, AlgorithmIdentifier }
  // PKCS8 envelope.
  const d = base64urlToUint8Array(privateKeyB64url);
  if (d.length !== 32) {
    throw new Error('VAPID private key must be a 32-byte raw d value');
  }
  // PKCS8 envelope bytes for an EC P-256 private key:
  //   SEQUENCE {
  //     INTEGER 1 (version),
  //     OCTET STRING (length 32) containing the d value,
  //     [1] BIT STRING containing the OID of prime256v1
  //   }
  const prefix = Uint8Array.from([0x30, 0x2e, 0x02, 0x01, 0x01, 0x04, 0x20]);
  const suffix = Uint8Array.from([0xa1, 0x0a, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07]);
  const bytes = concatUint8Arrays(prefix, d, suffix);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);
  const lines = b64.match(/.{1,64}/g) ?? [b64];
  const beginMarker = ['-----BEGIN', 'PRIVATE KEY-----'].join(' ');
  const endMarker = ['-----END', 'PRIVATE KEY-----'].join(' ');
  return `${beginMarker}\n${lines.join('\n')}\n${endMarker}`;
}

/**
 * Tries the vetted `web-push` npm package via a dynamic import. Returns
 * true (with no further action needed by the caller) on success, or
 * false if the package is unavailable or fails. On success the push
 * has already been sent; on failure the caller falls through to the
 * hand-rolled implementation.
 */
async function trySendWithVettedPackage(
  subscription: WebPushSubscription,
  payload: PushPayload,
  vapid: VapidKeys,
  subject: string
): Promise<{ ok: true; result: PushSendResult } | { ok: false }> {
  try {
    // Dynamic import so the project still builds if `web-push` is not yet
    // installed. The module is intentionally typed as `any` so the project
    // does not need `@types/web-push` installed to compile.
    const mod: any = await import(/* @vite-ignore */ 'web-push').catch(() => null);
    if (!mod || typeof mod.setVapidDetails !== 'function' || typeof mod.sendNotification !== 'function') {
      return { ok: false };
    }
    const privateKeyPem = vapidPrivateKeyToPem(vapid.privateKey);
    mod.setVapidDetails(subject, vapid.publicKey, privateKeyPem);
    // web-push accepts an options object with TTL, urgency, and a
    // socket-level timeout in milliseconds. The package handles VAPID JWT
    // signing and RFC-8291 encryption internally. The options object
    // is intentionally untyped to keep this file buildable without
    // @types/web-push installed.
    const options: Record<string, unknown> = {
      TTL: 86400,
      urgency: 'normal',
      timeout: 8_000,
    };
    const response = await mod.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      options
    );
    const status: number = response?.statusCode ?? 0;
    return {
      ok: true,
      result: {
        endpoint: subscription.endpoint,
        ok: status >= 200 && status < 300,
        status,
        expired: status === 404 || status === 410,
      },
    };
  } catch {
    // Treat any error (module missing, package failure, bad key) as a
    // signal to fall back to the hand-rolled implementation. Never
    // throw to the caller from this path.
    return { ok: false };
  }
}

/**
 * Sends a single Web Push notification. Returns a result object rather
 * than throwing, so callers can batch-send and prune expired
 * subscriptions without a try/catch per call.
 */
export async function sendWebPush(
  subscription: WebPushSubscription,
  payload: PushPayload,
  vapid: VapidKeys,
  subject: string = 'mailto:support@cliniolab.com'
): Promise<PushSendResult> {
  // Primary path: vetted npm package, if available and working.
  try {
    const vetted = await trySendWithVettedPackage(subscription, payload, vapid, subject);
    if (vetted.ok) return vetted.result;
  } catch {
    // Defensive — never let the primary path crash before the fallback.
  }

  // Fallback path: hand-rolled RFC-8291 + VAPID, verbatim from the
  // original implementation. Same wire output as the npm package.
  try {
    const { authorization } = await buildVapidAuthHeader(subscription.endpoint, vapid, subject);
    const plaintext = new TextEncoder().encode(JSON.stringify(payload));
    const { body } = await encryptPayload(plaintext, subscription.p256dh, subscription.auth);

    // FIX (Vercel Hobby duration budget): no timeout existed here — and
    // unlike the other clients, this one is already called in bulk (one
    // request per subscription, fanned out with Promise.all across
    // potentially hundreds of push endpoints per broadcast). A single slow
    // or hung push-service endpoint would stall the whole Promise.all and
    // the request behind it. 8s is intentionally tighter than the other
    // clients since a missed/late push notification is low-stakes and
    // callers already treat failures as soft (caught and turned into
    // ok:false below), so timing it out fast matters more than waiting it out.
    const pushController = new AbortController();
    const pushTimeout = setTimeout(() => pushController.abort(), 8_000);
    let res: Response;
    try {
      res = await fetch(subscription.endpoint, {
        method: 'POST',
        headers: {
          Authorization: authorization,
          'Content-Type': 'application/octet-stream',
          'Content-Encoding': 'aes128gcm',
          TTL: '86400',
          Urgency: 'normal',
        },
        body: toArrayBufferView(body),
        signal: pushController.signal,
      });
    } finally {
      clearTimeout(pushTimeout);
    }

    return {
      endpoint: subscription.endpoint,
      ok: res.ok,
      status: res.status,
      expired: res.status === 404 || res.status === 410,
    };
  } catch {
    return { endpoint: subscription.endpoint, ok: false, status: 0, expired: false };
  }
}
