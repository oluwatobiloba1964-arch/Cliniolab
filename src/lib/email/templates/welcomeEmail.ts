import { emailShell } from './shell';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cliniolab.com';

export function welcomeEmail(displayName: string): { subject: string; html: string } {
  const body = `
    <h1 style="font-family: Georgia, serif; font-size: 22px; color: #0B1F2E; margin: 0 0 12px;">Welcome, ${displayName}!</h1>
    <p style="font-size: 14px; color: #1E3A4C; line-height: 1.6;">
      You're in. Cliniolab has quizzes and CBT-style exams across core sciences, clinical practice,
      clinical specialties, and board exam prep — built by students like you.
    </p>
    <p style="font-size: 14px; color: #1E3A4C; line-height: 1.6;">
      Start with a quick quiz in Study Mode to see how it works, no pressure, answers explained
      as you go.
    </p>
    <a href="${BASE_URL}/categories" style="display:inline-block; margin-top: 16px; background:#2F8F7A; color:#fff; padding: 10px 20px; border-radius: 6px; text-decoration:none; font-size: 14px; font-weight:600;">
      Browse categories
    </a>
  `;
  return { subject: 'Welcome to Cliniolab', html: emailShell(body) };
}
