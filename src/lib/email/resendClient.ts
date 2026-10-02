/**
 * Resend API wrapper. This is the ONLY file allowed to call Resend
 * directly - mirrors the D1/R2 abstraction pattern so the email provider
 * stays swappable and nothing else in the codebase hardcodes provider
 * details.
 */

const RESEND_API_URL = 'https://api.resend.com/emails';

// FIX (Vercel Hobby duration budget): no timeout existed on this call at
// all — a hung Resend response would hang the invoking function for its
// full max duration (and on sendNewsletterForPost's per-recipient loop,
// a single stalled request could stall the whole chunk). 10s is generous
// for a transactional-email API but still well under Hobby's limit.
const RESEND_TIMEOUT_MS = 10_000;

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export class EmailSendError extends Error {}

export async function sendEmailViaResend(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM_ADDRESS;
  if (!apiKey || !fromAddress) {
    throw new EmailSendError(
      'Missing RESEND_API_KEY or RESEND_FROM_ADDRESS environment variables.'
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RESEND_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: input.to,
        subject: input.subject,
        html: input.html,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new EmailSendError(`Resend API request timed out after ${RESEND_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new EmailSendError(`Resend API error (${res.status}): ${body}`);
  }
}
