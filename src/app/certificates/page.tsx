// src/app/certificates/page.tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { certificateService, featureFlagService } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/currentUser';

export const metadata: Metadata = {
  title: 'Your certificates',
  description: 'All quiz certificates you have earned on Cliniolab.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Index page for earned certificates. /certificates/[id] has existed since
 * the beginning, but there was no listing — certificates were only
 * reachable from dashboard links. This page is personal data, so it
 * requires a session and redirects anonymous visitors to login.
 */
export default async function CertificatesPage() {
  const certificatesEnabled = await featureFlagService.isFeatureEnabled('certificates');
  if (!certificatesEnabled) redirect('/dashboard');

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const certificates = await certificateService.listCertificatesForUser(user.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-pulse-600">Achievements</p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-ink-800">Your certificates</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500">
        Certificates are issued automatically when you pass a certificate-eligible quiz. Open one to
        view it full-size or print a copy.
      </p>

      {certificates.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-ink-200 bg-white px-6 py-12 text-center">
          <p className="font-display text-lg font-semibold text-ink-800">No certificates yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-500">
            Pass a certificate-eligible quiz to earn your first certificate. Look for the
            certificate badge on quiz pages.
          </p>
          <Link
            href="/quizzes"
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-pulse-700 px-5 text-sm font-semibold text-white transition hover:bg-pulse-800"
          >
            Browse quizzes
          </Link>
        </div>
      ) : (
        <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {certificates.map((cert) => (
            <li key={cert.id}>
              <Link
                href={`/certificates/${cert.id}`}
                className="block rounded-2xl border border-ink-100 bg-white p-5 shadow-sm transition hover:border-pulse-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-lg font-semibold leading-snug text-ink-800">
                    {cert.quizTitle}
                  </h2>
                  <span className="shrink-0 rounded-full bg-pulse-50 px-3 py-1 text-sm font-bold text-pulse-700">
                    {Math.round(cert.scorePercentage)}%
                  </span>
                </div>
                <p className="mt-2 text-xs text-ink-400">
                  Issued {new Date(cert.issuedAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
                <p className="mt-3 text-xs font-semibold text-pulse-600">View certificate →</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
