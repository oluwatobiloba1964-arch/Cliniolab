import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { quizService } from '@/lib/db';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canAccessAdminPanel(user.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? 20) || 20));

  try {
    const result = await quizService.adminListAllQuizzes(page, pageSize);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Admin quiz list failed:', err);
    return NextResponse.json(
      { error: 'Something went wrong while loading quizzes. Please try again.' },
      { status: 500 }
    );
  }
}
