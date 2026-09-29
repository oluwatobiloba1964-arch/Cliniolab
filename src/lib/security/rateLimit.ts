import { NextResponse } from 'next/server';
import { rateLimitService } from '@/lib/db';

export function getClientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

export interface RateLimitRule {
  /** Short bucket name, e.g. 'feedback'. */
  name: string;
  /** Who/what is being limited, e.g. an IP or user id (or several joined). */
  id: string;
  limit: number;
  windowSeconds: number;
}

/**
 * Returns a ready-to-return 429 response if ANY rule is exceeded,
 * otherwise null. Usage:
 *   const limited = await enforceRateLimit(rule1, rule2);
 *   if (limited) return limited;
 */
export async function enforceRateLimit(...rules: RateLimitRule[]): Promise<NextResponse | null> {
  for (const rule of rules) {
    const result = await rateLimitService.hit(`${rule.name}:${rule.id}`, rule.limit, rule.windowSeconds);
    if (!result.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down and try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds) } }
      );
    }
  }
  return null;
}
