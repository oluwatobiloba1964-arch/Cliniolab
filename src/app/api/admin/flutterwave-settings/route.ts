import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import {
  getFlutterwaveCredentialStatus,
  saveFlutterwaveCredentials,
} from '@/lib/payments/flutterwaveClient';

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  if (user.role !== 'admin') return { error: NextResponse.json({ error: 'Admin only' }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  return NextResponse.json(await getFlutterwaveCredentialStatus());
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  let body: {
    secretKey?: unknown;
    webhookHash?: unknown;
    clearSecretKey?: unknown;
    clearWebhookHash?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.secretKey !== undefined && typeof body.secretKey !== 'string') {
    return NextResponse.json({ error: 'Secret key must be text' }, { status: 400 });
  }
  if (body.webhookHash !== undefined && typeof body.webhookHash !== 'string') {
    return NextResponse.json({ error: 'Webhook hash must be text' }, { status: 400 });
  }

  try {
    await saveFlutterwaveCredentials({
      secretKey: body.secretKey as string | undefined,
      webhookHash: body.webhookHash as string | undefined,
      clearSecretKey: body.clearSecretKey === true,
      clearWebhookHash: body.clearWebhookHash === true,
    });
    return NextResponse.json({ saved: true, ...(await getFlutterwaveCredentialStatus()) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not save Flutterwave credentials' },
      { status: 400 },
    );
  }
}
