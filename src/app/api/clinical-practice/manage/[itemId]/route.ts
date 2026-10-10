// File: src/app/api/clinical-practice/manage/[itemId]/route.ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { clinicalPracticeService } from '@/lib/db';

interface RouteParams {
  params: Promise<{ itemId: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { itemId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canManageLearningContent(user.role)) {
    return NextResponse.json({ error: 'Only admins/moderators can delete Clinical Practice items' }, { status: 403 });
  }

  await clinicalPracticeService.deleteItem(itemId);
  return NextResponse.json({ success: true });
}
