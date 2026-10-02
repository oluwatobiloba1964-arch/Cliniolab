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

const FLUTTERWAVE_API_URL = 'https://api.flutterwave.com/v3';

// FIX (Vercel Hobby duration budget): no timeout existed on this call at
// all — a hung Flutterwave response (e.g. during a checkout or a payout
// transfer) would hang the invoking function for its full max duration.
// 15s here rather than 10s since this covers payment/transfer calls where
// an overly aggressive timeout risks aborting a request that actually
// succeeded on Flutterwave's end, which is worse than waiting a bit longer.
const FLUTTERWAVE_TIMEOUT_MS = 15_000;

export class FlutterwaveError extends Error {}

function getSecretKey(): string {
  const key = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!key) throw new FlutterwaveError('Missing FLUTTERWAVE_SECRET_KEY environment variable.');
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
        Authorization: `Bearer ${getSecretKey()}`,
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
