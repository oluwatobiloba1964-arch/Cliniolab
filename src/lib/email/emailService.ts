import { sendEmailViaResend } from '@/lib/email/resendClient';
import { welcomeEmail } from '@/lib/email/templates/welcomeEmail';
import { leaderboardRecognitionEmail } from '@/lib/email/templates/leaderboardRecognitionEmail';
import { newsletterEmail } from '@/lib/email/templates/newsletterEmail';
import { quizResultEmail } from '@/lib/email/templates/quizResultEmail';
import { commentReplyEmail } from '@/lib/email/templates/commentReplyEmail';
import { inactivityNudgeEmail } from '@/lib/email/templates/inactivityNudgeEmail';
import { certificateIssuedEmail } from '@/lib/email/templates/certificateIssuedEmail';
import { emailLogService, featureFlagService, userService } from '@/lib/db';
import type { AppUser } from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cliniolab.com';

function unsubscribeUrl(userId: string): string {
  return `${BASE_URL}/dashboard/email-preferences?u=${userId}`;
}

/**
 * Every email send in the app goes through one of these functions rather
 * than calling sendEmailViaResend directly, so the feature-flag check,
 * user-preference check, and email_log write are never accidentally
 * skipped by a call site.
 */

export async function sendWelcomeEmail(user: AppUser): Promise<void> {
  const enabled = await featureFlagService.isFeatureEnabled('email_welcome');
  if (!enabled) return;
  if (await emailLogService.hasEmailBeenSent(user.id, 'welcome')) return;

  const { subject, html } = welcomeEmail(user.displayName ?? user.email);
  await sendEmailViaResend({ to: user.email, subject, html });
  await emailLogService.logEmailSent(user.id, 'welcome');
}

export async function sendLeaderboardRecognitionEmail(
  user: AppUser,
  rank: number,
  leaderboardLabel: string
): Promise<void> {
  const enabled = await featureFlagService.isFeatureEnabled('email_leaderboard_recognition');
  if (!enabled) return;

  const { subject, html } = leaderboardRecognitionEmail(
    user.displayName ?? user.email,
    rank,
    leaderboardLabel
  );
  await sendEmailViaResend({ to: user.email, subject, html });
  await emailLogService.logEmailSent(user.id, 'leaderboard_recognition');
}

export async function sendNewsletterForPost(
  postId: string,
  postTitle: string,
  postSlug: string,
  excerpt: string,
  recipients: AppUser[]
): Promise<{ sent: number; failed: number }> {
  const enabled = await featureFlagService.isFeatureEnabled('email_newsletter');
  if (!enabled) return { sent: 0, failed: 0 };

  // FIX (Vercel Hobby duration budget) — src/lib/email/emailService.ts
  // Was: a for-loop sending one recipient at a time, fully sequential.
  // For any real subscriber list this is the single worst offender in
  // the app — a 500-recipient newsletter at ~300-500ms per Resend call
  // is 2.5-4+ minutes sequential, which blows past Hobby's function
  // duration limit on its own even before counting anything else.
  // Now: recipients are sent in concurrent chunks (CHUNK_SIZE at a time)
  // instead of one at a time. Not all-at-once, on purpose — firing
  // hundreds/thousands of simultaneous requests at Resend in one go
  // risks tripping Resend's own rate limit and still ties up a lot of
  // sockets/memory in a single invocation; chunking keeps a bounded
  // number in flight.
  //
  // Separately, worth flagging even though it's not this function's bug:
  // both call sites (src/app/api/admin/blog/[id]/route.ts and
  // src/app/api/blog/route.ts) invoke this fire-and-forget — they call
  // it without awaiting it, as `sendNewsletterForPost(...).then(...)`
  // inside the route handler. On Vercel, a serverless function's
  // execution can be frozen/torn down the moment the HTTP response is
  // sent, so that background work isn't guaranteed to finish (and if
  // the runtime does keep it alive briefly to flush it, that time is
  // still billed against the function). For a real send you'd want the
  // route to `await` this (accepting the longer response time, which is
  // now much shorter thanks to chunking) or move the work out of the
  // request/response lifecycle entirely (a queue, a webhook-triggered
  // route, Vercel's `waitUntil`, etc.) rather than firing it after
  // the response and hoping it completes. I've left the call sites
  // alone since that's a behavior decision, not a drop-in fix.
  const CHUNK_SIZE = 25;
  let sent = 0;
  let failed = 0;
  const eligible = recipients.filter((user) => user.emailNewsletter);

  for (let i = 0; i < eligible.length; i += CHUNK_SIZE) {
    const chunk = eligible.slice(i, i + CHUNK_SIZE);
    const results = await Promise.allSettled(
      chunk.map(async (user) => {
        const { subject, html } = newsletterEmail(postTitle, postSlug, excerpt, unsubscribeUrl(user.id));
        await sendEmailViaResend({ to: user.email, subject, html });
        await emailLogService.logEmailSent(user.id, 'newsletter', postId);
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled') sent++;
      else failed++; // one recipient failing shouldn't abort the whole batch
    }
  }
  return { sent, failed };
}

export async function sendQuizResultEmail(
  user: AppUser,
  quizTitle: string,
  percentage: number
): Promise<void> {
  const enabled = await featureFlagService.isFeatureEnabled('email_quiz_results');
  if (!enabled || !user.emailQuizResults) return;

  const { subject, html } = quizResultEmail(
    user.displayName ?? user.email,
    quizTitle,
    percentage,
    unsubscribeUrl(user.id)
  );
  await sendEmailViaResend({ to: user.email, subject, html });
  await emailLogService.logEmailSent(user.id, 'quiz_result');
}

export async function sendCommentReplyEmail(
  recipientUserId: string,
  replierName: string,
  contentTitle: string,
  contentPath: string,
  replyBody: string
): Promise<void> {
  const enabled = await featureFlagService.isFeatureEnabled('email_comment_reply');
  if (!enabled) return;

  const recipient = await userService.getUserById(recipientUserId);
  if (!recipient) return;

  const { subject, html } = commentReplyEmail(
    recipient.displayName ?? recipient.email,
    replierName,
    contentTitle,
    contentPath,
    replyBody
  );
  await sendEmailViaResend({ to: recipient.email, subject, html });
  await emailLogService.logEmailSent(recipient.id, 'comment_reply');
}

export async function sendCertificateIssuedEmail(
  user: AppUser,
  quizTitle: string,
  certificateId: string
): Promise<void> {
  const enabled = await featureFlagService.isFeatureEnabled('email_certificate_issued');
  if (!enabled) return;
  if (await emailLogService.hasEmailBeenSent(user.id, 'certificate_issued', certificateId)) return;

  const { subject, html } = certificateIssuedEmail(
    user.displayName ?? user.email,
    quizTitle,
    certificateId,
    unsubscribeUrl(user.id)
  );
  await sendEmailViaResend({ to: user.email, subject, html });
  await emailLogService.logEmailSent(user.id, 'certificate_issued', certificateId);
}

export async function sendInactivityNudgeEmail(user: AppUser, daysInactive: number): Promise<void> {
  const enabled = await featureFlagService.isFeatureEnabled('email_inactivity_nudge');
  if (!enabled) return;

  const { subject, html } = inactivityNudgeEmail(
    user.displayName ?? user.email,
    daysInactive,
    unsubscribeUrl(user.id)
  );
  await sendEmailViaResend({ to: user.email, subject, html });
  await emailLogService.logEmailSent(user.id, 'inactivity_nudge');
}
