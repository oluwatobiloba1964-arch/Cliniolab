import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { contributorService } from '@/lib/db';
import type { ContributorInput } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canManageBlog(user.role)) {
    return NextResponse.json({ error: 'Admin/moderator access required' }, { status: 403 });
  }
  const { id } = await params;
  let body: ContributorInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  try {
    const contributor = await contributorService.updateContributor(id, body);
    return NextResponse.json({ contributor });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update contributor' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can delete contributors' }, { status: 403 });
  }
  const { id } = await params;
  await contributorService.deleteContributor(id);
  return NextResponse.json({ success: true });
}
