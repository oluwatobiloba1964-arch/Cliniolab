'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

/**
 * Only redirect back to same-origin, relative paths - and never back into
 * an auth page itself, or a returned `next` could loop register <-> login.
 */
function sanitizeNextPath(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/dashboard';
  if (next.startsWith('/login') || next.startsWith('/register')) return '/dashboard';
  return next;
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c6.5 0 10 7 10 7a17.4 17.4 0 0 1-3.4 4.6M6.6 6.6C3.5 8.5 2 12 2 12s3.5 7 10 7a10.8 10.8 0 0 0 4.2-.85" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  );
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = sanitizeNextPath(searchParams.get('next'));
  const { register } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      const { needsEmailConfirmation } = await register(email, password, displayName);
      if (needsEmailConfirmation) {
        setNeedsEmailConfirmation(true);
      } else {
        router.push(nextPath);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up');
    } finally {
      setSubmitting(false);
    }
  }

  if (needsEmailConfirmation) {
    return (
      <div className="mx-auto max-w-sm px-6 py-24">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Check your email</h1>
        <Card className="mt-6 p-6">
          <p className="text-sm text-ink-700">
            We&apos;ve sent a confirmation link to <span className="font-medium">{email}</span>.
            Please confirm your email address before logging in.
          </p>
          <p className="mt-3 text-sm text-ink-500">
            Didn&apos;t get it? Check your spam folder, or try logging in again once confirmed.
          </p>
        </Card>
        <p className="mt-4 text-sm text-ink-500">
          <Link
            href={nextPath !== '/dashboard' ? `/login?next=${encodeURIComponent(nextPath)}` : '/login'}
            className="font-medium text-pulse-600"
          >
            Go to login
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-24">
      <h1 className="font-display text-2xl font-semibold text-ink-800">Create your account</h1>
      <Card className="mt-6 p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="reg-name" className="text-sm font-medium text-ink-700">Display name</label>
            <input
              id="reg-name"
              name="name"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="reg-email" className="text-sm font-medium text-ink-700">Email</label>
            <input
              id="reg-email"
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="reg-password" className="text-sm font-medium text-ink-700">Password</label>
            <div className="relative mt-1">
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-md border border-ink-100 px-4 py-2 pr-11 text-sm focus:border-pulse-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-400 hover:text-ink-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="reg-confirm" className="text-sm font-medium text-ink-700">Confirm password</label>
            <div className="relative mt-1">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="reg-confirm"
                name="confirm-password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-md border border-ink-100 px-4 py-2 pr-11 text-sm focus:border-pulse-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-400 hover:text-ink-600"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                <EyeIcon open={showConfirmPassword} />
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-critical-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Sign up'}
          </Button>
        </form>
      </Card>
      <p className="mt-4 text-sm text-ink-500">
        Already have an account?{' '}
        <Link
          href={nextPath !== '/dashboard' ? `/login?next=${encodeURIComponent(nextPath)}` : '/login'}
          className="font-medium text-pulse-600"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-sm px-6 py-24">
          <p className="text-sm text-ink-500">Loading…</p>
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
