/**
 * Minimal Web Push sender built on native Web Crypto (crypto.subtle),
 * so it runs reliably in the Cloudflare Workers runtime without relying
 * on the `web-push` npm package (which leans on Node's `crypto` module
 * in ways that don't always behave correctly under `nodejs_compat`).
 *
 * Implements:
 *  - VAPID JWT signing (ES256) for the Authorization header
 *  - aes128gcm payload encryption per RFC 8291 (Web Push Encryption)
 *  - POSTing the encrypted payload to the subscription's push service
 *
 * Only dependency: the subscription's endpoint/p256dh/auth (from
 * PushSubscription.toJSON() on the client) and a VAPID key pair.
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

