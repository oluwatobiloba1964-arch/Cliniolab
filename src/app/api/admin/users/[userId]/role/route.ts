// File: src/app/api/admin/users/[userId]/role/route.ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { userService } from '@/lib/db';
import type { UserRole } from '@/types';

interface RouteParams {
  params: Promise<{ userId: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { userId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canManageUsers(user.role)) {
    return NextResponse.json({ error: 'Only admins can change user roles' }, { status: 403 });
  }

  let body: { role: UserRole };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!['user', 'moderator', 'admin'].includes(body.role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  // Moderators can manage ordinary users but must not be able to grant admin,
  // change another admin's role, or touch their own role (self-escalation).
  if (user.role !== 'admin') {
    if (body.role === 'admin') {
      return NextResponse.json({ error: 'Only admins can grant the admin role' }, { status: 403 });
    }
    if (userId === user.id) {
      return NextResponse.json({ error: 'You cannot change your own role' }, { status: 403 });
    }
    const target = await userService.getUserById(userId);
    if (target?.role === 'admin') {
      return NextResponse.json({ error: 'Only admins can change another admin\'s role' }, { status: 403 });
    }
  }

  await userService.setUserRole(userId, body.role);
  const updated = await userService.getUserById(userId);
  return NextResponse.json({ user: updated });
}
