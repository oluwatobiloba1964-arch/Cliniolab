// File: src/app/api/scholars/route.ts
import { NextResponse } from 'next/server';

const CC = 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { scholarService } from '@/lib/db';

export async function GET() {
  const scholars = await scholarService.listScholars();
  return NextResponse.json({ scholars }, { headers: { 'Cache-Control': CC } });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canManageLearningContent(user.role)) {
    return NextResponse.json({ error: 'Only admins/moderators can add a scholar' }, { status: 403 });
  }

  let body: {
    studentUserId?: string;
    name: string;
    photoUrl?: string;
    bio?: string;
    achievement?: string;
    quote?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const scholar = await scholarService.createScholar(user.id, body);
  return NextResponse.json({ scholar }, { status: 201 });
}
