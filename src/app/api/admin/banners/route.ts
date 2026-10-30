import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { bannerService } from '@/lib/db';
import type { BannerPlacement } from '@/types';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canAccessAdminPanel(user.role)) {
    return NextResponse.json({ error: 'Admin/moderator access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const placement = searchParams.get('placement') as BannerPlacement | null;
  const [banners, stats] = await Promise.all([
    bannerService.listAllBanners(placement ?? undefined),
    bannerService.getStatsForAllBanners(),
  ]);
  return NextResponse.json({ banners, stats });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canAccessAdminPanel(user.role)) {
    return NextResponse.json({ error: 'Admin/moderator access required' }, { status: 403 });
  }

  let body: {
    placement?: string;
    title?: string;
    imagePath?: string;
    linkUrl?: string | null;
    isActive?: boolean;
    sortOrder?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.placement !== 'header' && body.placement !== 'footer') {
    return NextResponse.json({ error: 'placement must be "header" or "footer"' }, { status: 400 });
  }
  if (!body.title || typeof body.title !== 'string') {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }
  if (!body.imagePath || typeof body.imagePath !== 'string') {
    return NextResponse.json({ error: 'imagePath is required. Upload the image first' }, { status: 400 });
  }

  const banner = await bannerService.createBanner({
    placement: body.placement,
    title: body.title,
    imagePath: body.imagePath,
    linkUrl: body.linkUrl ?? null,
    isActive: body.isActive,
    sortOrder: body.sortOrder,
  });
  return NextResponse.json({ banner }, { status: 201 });
}
