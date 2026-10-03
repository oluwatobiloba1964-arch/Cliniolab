// src/lib/security/guestPracticeCookie.ts

/**
 * Marks a browser that has already seen a Guest Practice quiz's graded
 * answers. If that person later logs in and takes the same quiz, their
 * result is graded but NOT saved, so they can't top the leaderboard or earn
 * a certificate off answers they already saw. Per quiz, per browser.
 */
export const GUEST_PRACTICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function guestPracticeCookieName(quizId: string): string | null {
  // Quiz ids are generated as prefix_hex; refuse anything that isn't a safe cookie-name token.
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(quizId)) return null;
  return `cl_gp_${quizId}`;
}
