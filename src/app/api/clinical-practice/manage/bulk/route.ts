// File: src/app/api/clinical-practice/manage/bulk/route.ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { clinicalPracticeService } from '@/lib/db';

/** Bulk-deletes Clinical Practice bank items by id in one request. */
export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canManageLearningContent(user.role)) {
    return NextResponse.json({ error: 'Only admins/moderators can delete Clinical Practice items' }, { status: 403 });
  }

  let body: { ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string' && id.length > 0) : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: '"ids" must be a non-empty array of strings' }, { status: 400 });
  }

  const deletedCount = await clinicalPracticeService.deleteItems(ids);
  return NextResponse.json({ success: true, deletedCount });
}
