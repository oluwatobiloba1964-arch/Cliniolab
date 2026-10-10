// File: src/app/api/clinical-practice/manage/route.ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { clinicalPracticeService } from '@/lib/db';
import type { ClinicalPracticeKind } from '@/lib/db/services/clinicalPracticeService';

const KINDS: ClinicalPracticeKind[] = ['case', 'calculation', 'osce'];

/** Admin list of bank items for one kind, for the manage/delete view. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canManageLearningContent(user.role)) {
    return NextResponse.json({ error: 'Only admins/moderators can view Clinical Practice items' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const kind = searchParams.get('kind') as ClinicalPracticeKind;
  if (!KINDS.includes(kind)) {
    return NextResponse.json({ error: `kind must be one of: ${KINDS.join(', ')}` }, { status: 400 });
  }

  const items = await clinicalPracticeService.listItemsByKind(kind);
  return NextResponse.json({ items });
}
