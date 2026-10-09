/**
 * Flutterwave API wrapper. This is the ONLY file allowed to call
 * Flutterwave directly - mirrors the Resend/D1/R2 abstraction pattern so
 * the payment provider stays swappable and nothing else in the codebase
 * hardcodes provider details.
 *
 * Payment model ("Model B" — platform-collects):
 * - Every purchase (quizzes and Flutterwave-mode resources) is a plain
 *   checkout into the platform's own Flutterwave account. No per-creator
 *   subaccounts, no checkout-time splitting.
 * - Creators accrue a balance (tracked in quizPurchaseService) and request
 *   a payout. Admin then either triggers a real bank transfer via
 *   initiateTransfer() (Flutterwave mode) or marks the request paid by
 *   hand after sending the money themselves outside the system (manual
 *   mode). Either way, admin always sees and acts on the request.
 */

// File: src/lib/payments/flutterwaveClient.ts
import { getDb, nowIso } from '@/lib/db/client';

const FLUTTERWAVE_API_URL = 'https://api.flutterwave.com/v3';

interface FlutterwaveCredentialRow {
  value: string;
}
type CredentialPayload = { secretKey?: unknown; webhookHash?: unknown };
type EncryptedCredentialPayload = { encrypted: true; iv: string; payload: string };

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getCredentialEncryptionKey(): Promise<CryptoKey> {
  const secret = process.env.FLUTTERWAVE_CREDENTIALS_ENCRYPTION_KEY;
  if (!secret || secret.trim().length < 32) {
    throw new FlutterwaveError('Set FLUTTERWAVE_CREDENTIALS_ENCRYPTION_KEY to a random secret of at least 32 characters before saving Flutterwave credentials in Admin.');
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptAdminCredentials(credentials: CredentialPayload): Promise<string> {
  const key = await getCredentialEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cleartext = new TextEncoder().encode(JSON.stringify(credentials));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, cleartext);
  const payload: EncryptedCredentialPayload = {
    encrypted: true,
    iv: bytesToBase64(iv),
    payload: bytesToBase64(new Uint8Array(encrypted)),
  };
  return JSON.stringify(payload);
}

async function decodeAdminCredentials(value: string): Promise<CredentialPayload> {
  const parsed = JSON.parse(value) as CredentialPayload | EncryptedCredentialPayload;
  if ('encrypted' in parsed && parsed.encrypted === true) {
    const key = await getCredentialEncryptionKey();
    const cleartext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(parsed.iv) },
      key,
      base64ToBytes(parsed.payload),
    );
    return JSON.parse(new TextDecoder().decode(cleartext)) as CredentialPayload;
  }
  // Backward compatibility for values saved by earlier versions. New writes
  // are encrypted, and re-saving an old value encrypts it at rest.
  return parsed as CredentialPayload;
}

async function getAdminCredentials(): Promise<{ secretKey?: string; webhookHash?: string }> {
  try {
    const row = await getDb()
      .prepare('SELECT value FROM site_settings WHERE key = ?')
      .bind('flutterwave_credentials')
      .first<FlutterwaveCredentialRow>();
    if (row?.value) {
      const parsed = await decodeAdminCredentials(row.value);
      return {
        secretKey: typeof parsed.secretKey === 'string' && parsed.secretKey.trim() ? parsed.secretKey.trim() : undefined,
        webhookHash: typeof parsed.webhookHash === 'string' && parsed.webhookHash.trim() ? parsed.webhookHash.trim() : undefined,
      };
    }
  } catch {
    // Keep env-based deployment working if the settings row/table is unavailable.
  }
  return {};
}

/** Admin-saved credentials take precedence; environment variables are the fallback. */
export async function getFlutterwaveWebhookHash(): Promise<string | undefined> {
  const admin = await getAdminCredentials();
  return admin.webhookHash || process.env.FLUTTERWAVE_WEBHOOK_HASH || undefined;
}

export async function getFlutterwaveCredentialStatus(): Promise<{
  secretKeyConfigured: boolean;
  secretKeySource: 'admin' | 'environment' | 'missing';
  webhookHashConfigured: boolean;
  webhookHashSource: 'admin' | 'environment' | 'missing';
}> {
  const admin = await getAdminCredentials();
  const secretKeySource = admin.secretKey ? 'admin' : process.env.FLUTTERWAVE_SECRET_KEY ? 'environment' : 'missing';
  const webhookHashSource = admin.webhookHash ? 'admin' : process.env.FLUTTERWAVE_WEBHOOK_HASH ? 'environment' : 'missing';
  return {
    secretKeyConfigured: secretKeySource !== 'missing',
    secretKeySource,
    webhookHashConfigured: webhookHashSource !== 'missing',
    webhookHashSource,
  };
}

/** Save or clear admin-managed credentials. Never return these secret values to the browser. */
export async function saveFlutterwaveCredentials(input: {
  secretKey?: string;
  webhookHash?: string;
  clearSecretKey?: boolean;
  clearWebhookHash?: boolean;
}): Promise<void> {
  const db = getDb();
  const row = await db.prepare('SELECT value FROM site_settings WHERE key = ?')
    .bind('flutterwave_credentials').first<FlutterwaveCredentialRow>();
  let current: { secretKey?: string; webhookHash?: string } = {};
  try { if (row?.value) current = await decodeAdminCredentials(row.value) as typeof current; } catch { current = {}; }

  const next = { ...current };
  if (input.clearSecretKey) delete next.secretKey;
  else if (typeof input.secretKey === 'string' && input.secretKey.trim()) next.secretKey = input.secretKey.trim();
  if (input.clearWebhookHash) delete next.webhookHash;
  else if (typeof input.webhookHash === 'string' && input.webhookHash.trim()) next.webhookHash = input.webhookHash.trim();

  if (!next.secretKey && !next.webhookHash) {
    await db.prepare('DELETE FROM site_settings WHERE key = ?').bind('flutterwave_credentials').run();
    return;
  }
  const encryptedValue = await encryptAdminCredentials(next);
  await db.prepare(
    `INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).bind('flutterwave_credentials', encryptedValue, nowIso()).run();
}

// FIX (Vercel Hobby duration budget): no timeout existed on this call at
// all — a hung Flutterwave response (e.g. during a checkout or a payout
// transfer) would hang the invoking function for its full max duration.
// 15s here rather than 10s since this covers payment/transfer calls where
// an overly aggressive timeout risks aborting a request that actually
// succeeded on Flutterwave's end, which is worse than waiting a bit longer.
const FLUTTERWAVE_TIMEOUT_MS = 15_000;

export class FlutterwaveError extends Error {}

async function getSecretKey(): Promise<string> {
  const admin = await getAdminCredentials();
  const key = admin.secretKey || process.env.FLUTTERWAVE_SECRET_KEY;
  if (!key) throw new FlutterwaveError('Flutterwave secret key is not configured. Add it in Admin > Payments or set FLUTTERWAVE_SECRET_KEY.');
  return key;
}

async function flutterwaveRequest<T>(
  path: string,
  method: 'GET' | 'POST' | 'DELETE',
  body?: Record<string, unknown>
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FLUTTERWAVE_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${FLUTTERWAVE_API_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${await getSecretKey()}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new FlutterwaveError(`Flutterwave API request timed out after ${FLUTTERWAVE_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  const json = (await res.json()) as { status: string; message: string; data: T };
  if (!res.ok || json.status !== 'success') {
    throw new FlutterwaveError(json.message || `Flutterwave API error (${res.status})`);
  }
  return json.data;
}

export interface ListBank {
  name: string;
  code: string;
}

/** Lists supported Nigerian banks for the payout-details form's dropdown. */
export async function listBanks(): Promise<ListBank[]> {
  const banks = await flutterwaveRequest<{ name: string; code: string }[]>('/banks/NG', 'GET');
  return banks.map((b) => ({ name: b.name, code: b.code }));
}

/** Verifies an account number resolves to a real bank account before saving it. */
export async function resolveAccountNumber(
  accountNumber: string,
  bankCode: string
): Promise<{ accountName: string }> {
  const data = await flutterwaveRequest<{ account_name: string }>('/accounts/resolve', 'POST', {
    account_number: accountNumber,
    account_bank: bankCode,
  });
  return { accountName: data.account_name };
}

export interface InitializeCheckoutInput {
  email: string;
  name: string;
  amountKobo: number;
  currency?: string; // defaults to NGN
  txRef: string;
  redirectUrl: string;
  title: string;
  meta?: Record<string, unknown>;
}

export interface InitializeCheckoutResult {
  link: string;
}

/**
 * Starts a hosted checkout session for either a quiz purchase or a
 * Flutterwave-mode resource purchase. Plain platform-collects checkout —
 * no subaccount/split involved, matching Model B.
 */
export async function initializeCheckout(input: InitializeCheckoutInput): Promise<InitializeCheckoutResult> {
  // Flutterwave expects amount in the currency's major unit (Naira), not
  // kobo, unlike Paystack. Convert at the boundary so the rest of the app
  // can keep storing/reasoning in kobo consistently.
  const amountNaira = input.amountKobo / 100;
  const data = await flutterwaveRequest<{ link: string }>('/payments', 'POST', {
    tx_ref: input.txRef,
    amount: amountNaira,
    currency: input.currency ?? 'NGN',
    redirect_url: input.redirectUrl,
    customer: { email: input.email, name: input.name },
    customizations: { title: input.title },
    meta: input.meta,
  });
  return { link: data.link };
}

export interface VerifyTransactionResult {
  status: 'successful' | 'failed' | 'pending';
  txRef: string;
  amountKobo: number;
  currency: string;
  meta: Record<string, unknown> | null;
}

/**
 * Confirms a transaction actually succeeded before granting access - never
 * trust the client redirect alone. Flutterwave verifies by transaction_id
 * (returned as a query param on redirect), not by tx_ref directly.
 */
export async function verifyTransaction(transactionId: string): Promise<VerifyTransactionResult> {
  const data = await flutterwaveRequest<{
    status: string;
    tx_ref: string;
    amount: number;
    currency: string;
    meta: Record<string, unknown> | null;
  }>(`/transactions/${transactionId}/verify`, 'GET');

  return {
    status: data.status === 'successful' ? 'successful' : data.status === 'failed' ? 'failed' : 'pending',
    txRef: data.tx_ref,
    amountKobo: Math.round(data.amount * 100),
    currency: data.currency,
    meta: data.meta,
  };
}

export interface InitiateTransferInput {
  accountBankCode: string;
  accountNumber: string;
  amountKobo: number;
  narration: string;
  reference: string;
}

export interface InitiateTransferResult {
  transferId: number;
  status: string;
}

/**
 * Sends money out to a creator's bank account — used for the Flutterwave
 * (automatic) branch of a creator payout request. Admin triggers this
 * directly; there is no subaccount involved.
 */
export async function initiateTransfer(input: InitiateTransferInput): Promise<InitiateTransferResult> {
  const data = await flutterwaveRequest<{ id: number; status: string }>('/transfers', 'POST', {
    account_bank: input.accountBankCode,
    account_number: input.accountNumber,
    amount: input.amountKobo / 100,
    currency: 'NGN',
    narration: input.narration,
    reference: input.reference,
  });
  return { transferId: data.id, status: data.status };
}

export interface VerifyTransferResult {
  status: 'NEW' | 'SUCCESSFUL' | 'FAILED';
}

/** Checks the current status of a previously-initiated transfer. */
export async function verifyTransfer(transferId: number): Promise<VerifyTransferResult> {
  const data = await flutterwaveRequest<{ status: string }>(`/transfers/${transferId}`, 'GET');
  return { status: data.status as VerifyTransferResult['status'] };
}
