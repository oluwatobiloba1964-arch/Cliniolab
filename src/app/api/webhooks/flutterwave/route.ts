import { NextResponse } from 'next/server';
import { flashcardPurchaseService, payoutRequestService, quizPurchaseService, resourceService } from '@/lib/db';
import { getFlutterwaveWebhookHash, verifyTransaction, verifyTransfer } from '@/lib/payments/flutterwaveClient';

/**
 * Flutterwave signs every webhook with a plain secret-hash string (not
 * HMAC) delivered in the `verif-hash` header — this must match exactly
 * what's configured in the Flutterwave dashboard under Settings >
 * Webhooks. This is the safety net for the whole payment system: it's
 * what completes a purchase or payout if the buyer/admin closes their
 * browser tab right after the redirect, instead of relying purely on the
 * client calling /verify.
 *
 * Security: per Flutterwave's own best-practices guidance, this handler
 * NEVER trusts the webhook payload directly for the fields that matter
 * (status, amount, tx_ref) — it always re-queries the Verify API using
 * the payload's id, and only acts on what that trusted response says.
 * This defends against a forged webhook claiming a payment succeeded
 * when it didn't.
 *
 * Idempotency: Flutterwave may deliver the same event more than once.
 * Every handler here is safe to call twice — quizPurchaseService and
 * resourceService both check `status === 'completed'/'confirmed'` before
 * doing anything, and payoutRequestService's mark-paid/mark-failed
 * functions no-op if already in that terminal state.
 */
export async function POST(request: Request) {
  const secretHash = await getFlutterwaveWebhookHash();
  const signature = request.headers.get('verif-hash');

  if (!secretHash || !signature || signature !== secretHash) {
    // Not a genuine Flutterwave request - discard without processing.
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: { event: string; data: { id: number | string; status?: string } };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Always acknowledge quickly with 200 once the signature checks out -
  // Flutterwave retries on non-2xx responses, and slow/complex handling
  // here risks a timeout being mistaken for a failed delivery. The actual
  // work below is a handful of D1 queries, well within a safe margin.
  try {
    if (payload.event === 'charge.completed') {
      await handleChargeCompleted(String(payload.data.id));
    } else if (payload.event === 'transfer.completed') {
      await handleTransferCompleted(String(payload.data.id));
    }
    // Unrecognized event types are acknowledged and ignored - Flutterwave
    // sends other event types (refund, chargeback, etc.) that this
    // platform doesn't act on yet.
  } catch (err) {
    // Log-and-acknowledge rather than error: a transient failure here
    // shouldn't cause Flutterwave to endlessly retry. The client-side
    // /verify call on the redirect page is the fallback if this drops.
    console.error('Flutterwave webhook processing error:', err);
  }

  return NextResponse.json({ received: true });
}

/** charge.completed covers both quiz purchases and Flutterwave-mode resource purchases. */
async function handleChargeCompleted(transactionId: string): Promise<void> {
  const result = await verifyTransaction(transactionId);
  if (result.status !== 'successful') return;

  // tx_ref is prefixed at creation time (quiz_... vs resource_... vs
  // flashcard_...) so the webhook can route to the right service without
  // needing extra lookups.
  if (result.txRef.startsWith('quiz_')) {
    const purchase = await quizPurchaseService.getPurchaseByTxRef(result.txRef);
    if (!purchase || purchase.status === 'completed') return;
    if (result.amountKobo !== purchase.amountKobo) {
      console.error(`Flutterwave webhook amount mismatch for ${result.txRef}: expected ${purchase.amountKobo}, got ${result.amountKobo}`);
      return;
    }
    await quizPurchaseService.markPurchaseCompleted(result.txRef, transactionId);
  } else if (result.txRef.startsWith('flashcard_')) {
    const purchase = await flashcardPurchaseService.getPurchaseByTxRef(result.txRef);
    if (!purchase || purchase.status === 'completed') return;
    if (result.amountKobo !== purchase.amountKobo) {
      console.error(`Flutterwave webhook amount mismatch for ${result.txRef}: expected ${purchase.amountKobo}, got ${result.amountKobo}`);
      return;
    }
    await flashcardPurchaseService.markPurchaseCompleted(result.txRef, transactionId);
  } else if (result.txRef.startsWith('resource_')) {
    const purchase = await resourceService.getPurchaseByTxRef(result.txRef);
    if (!purchase || purchase.status === 'confirmed') return;
    await resourceService.markFlutterwavePurchaseConfirmed(result.txRef, transactionId);
  }
}

/** transfer.completed covers creator payouts sent via the Flutterwave-automatic branch. */
async function handleTransferCompleted(transferId: string): Promise<void> {
  const payoutRequest = await payoutRequestService.getPayoutRequestByTransferId(transferId);
  if (!payoutRequest || payoutRequest.status === 'paid' || payoutRequest.status === 'failed') return;

  const result = await verifyTransfer(Number(transferId));
  if (result.status === 'SUCCESSFUL') {
    await payoutRequestService.markPayoutPaid(payoutRequest.id);
  } else if (result.status === 'FAILED') {
    // adminId is null here since this is a system-triggered failure, not
    // an admin action - markPayoutFailed accepts null and refunds the
    // creator's balance the same way either path would.
    await payoutRequestService.markPayoutFailed(payoutRequest.id, null, 'Flutterwave transfer failed (via webhook)');
  }
  // status === 'NEW' means still in flight - nothing to do yet, a later
  // webhook delivery will resolve it.
}
