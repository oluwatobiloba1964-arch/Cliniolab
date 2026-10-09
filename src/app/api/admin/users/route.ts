import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { userService } from '@/lib/db';

const PAGE_SIZE = 100;

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canManageUsers(user.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const pageParam = Number(request.nextUrl.searchParams.get('page'));
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  // Over-fetch by the count of trailing placeholder rows we might need to
  // filter out, so a full page of 100 real users still comes back even if
  // the placeholder lands on this page. One placeholder account exists
  // today, so fetching one extra row is enough.
  const { users, total } = await userService.adminListUsersPage(page, PAGE_SIZE + 1);
  // The placeholder account that deleted users' content gets reassigned to
  // (see userService.deleteUserCompletely) is an internal implementation
  // detail, not a real person — hide it from the admin list so nobody
  // tries to edit its role or delete it by mistake.
  const visibleUsers = users
    .filter((u) => u.id !== userService.DELETED_USER_PLACEHOLDER_ID)
    .slice(0, PAGE_SIZE);
  const visibleTotal = total - 1; // minus the placeholder account

  return NextResponse.json({
    users: visibleUsers,
    page,
    pageSize: PAGE_SIZE,
    total: visibleTotal,
    totalPages: Math.max(1, Math.ceil(visibleTotal / PAGE_SIZE)),
  });
}
