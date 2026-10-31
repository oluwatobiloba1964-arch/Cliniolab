// src/app/api/admin/platform-settings/route.ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { platformSettingsService } from '@/lib/db';
import type { AuthorBoxSetting, EmailSetting, GuestPracticeSetting, OfflineSetting, ThemeSetting } from '@/types';

/**
 * One admin endpoint for the four small setting groups added with Guest
 * Practice: guest carousel + access, theme default, offline limits, and the
 * author/reviewer box. Admin only.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const [guest, theme, offline, authorBox, email] = await Promise.all([
    platformSettingsService.getGuestPracticeSetting(),
    platformSettingsService.getThemeSetting(),
    platformSettingsService.getOfflineSetting(),
    platformSettingsService.getAuthorBoxSetting(),
    platformSettingsService.getEmailSetting(),
  ]);
  // Never expose the raw API key to the client — mask all but last 4 chars.
  const emailForClient = {
    ...email,
    resendApiKey: email.resendApiKey
      ? email.resendApiKey.slice(0, 7) + '…' + email.resendApiKey.slice(-4)
      : '',
  };
  return NextResponse.json({ guest, theme, offline, authorBox, email: emailForClient });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Only admins can change these settings' }, { status: 403 });

  let body: {
    guest?: GuestPracticeSetting;
    theme?: ThemeSetting;
    offline?: OfflineSetting;
    authorBox?: AuthorBoxSetting;
    email?: EmailSetting;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const out: Record<string, unknown> = {};
  if (body.guest) out.guest = await platformSettingsService.setGuestPracticeSetting(body.guest);
  if (body.theme) out.theme = await platformSettingsService.setThemeSetting(body.theme);
  if (body.offline) out.offline = await platformSettingsService.setOfflineSetting(body.offline);
  if (body.authorBox) out.authorBox = await platformSettingsService.setAuthorBoxSetting(body.authorBox);
  if (body.email) {
    // If the client sends back the masked key (contains '…'), skip updating
    // the key so the real value in the DB is preserved.
    const incoming = body.email;
    if (incoming.resendApiKey.includes('…')) {
      const current = await platformSettingsService.getEmailSetting();
      incoming.resendApiKey = current.resendApiKey;
    }
    out.email = await platformSettingsService.setEmailSetting(incoming);
  }
  return NextResponse.json(out);
}
