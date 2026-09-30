import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { platformSettingsService } from '@/lib/db';
import type { AuthorBoxSetting, GuestPracticeSetting, OfflineSetting, ThemeSetting } from '@/types';

/**
 * One admin endpoint for the four small setting groups added with Guest
 * Practice: guest carousel + access, theme default, offline limits, and the
 * author/reviewer box. Admin only.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const [guest, theme, offline, authorBox] = await Promise.all([
    platformSettingsService.getGuestPracticeSetting(),
    platformSettingsService.getThemeSetting(),
    platformSettingsService.getOfflineSetting(),
    platformSettingsService.getAuthorBoxSetting(),
  ]);
  return NextResponse.json({ guest, theme, offline, authorBox });
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
  return NextResponse.json(out);
}
