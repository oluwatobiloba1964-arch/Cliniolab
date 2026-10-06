// File: src/app/api/pages/[pageId]/route.ts
import { NextResponse } from 'next/server';

const CC = 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { cmsService } from '@/lib/db';

interface RouteParams {
  params: Promise<{ pageId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { pageId } = await params;
  const page = await cmsService.getStaticPage(pageId);
  if (!page) return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  return NextResponse.json({ page }, { headers: { 'Cache-Control': CC } });
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { pageId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canEditStaticPages(user.role)) {
    return NextResponse.json({ error: 'Only admins can edit site pages' }, { status: 403 });
  }

  let body: { title: string; content: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.title || !body.content) {
    return NextResponse.json({ error: 'title and content are required' }, { status: 400 });
  }

  await cmsService.upsertStaticPage(pageId, body.title, body.content);
  const page = await cmsService.getStaticPage(pageId);
  return NextResponse.json({ page });
}
