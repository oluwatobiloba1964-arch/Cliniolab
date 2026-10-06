// File: src/app/api/push/vapid-public-key/route.ts
import { NextResponse } from 'next/server';

const CC = 'public, max-age=300, s-maxage=300, stale-while-revalidate=600';
import { getVapidPublicKey } from '@/lib/push/vapidConfig';

/**
 * VAPID public keys are, by design, safe to expose to any client — the
 * push subscribe flow needs this to call pushManager.subscribe(). Only
 * the private key (never returned by this route) can sign notifications.
 */
export async function GET() {
  const publicKey = await getVapidPublicKey();
  return NextResponse.json({ publicKey }, { headers: { 'Cache-Control': CC } });
}
