// File: src/app/api/admin/users/[userId]/route.ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { getSupabaseServiceRoleClient } from '@/lib/auth/supabaseServiceRoleClient';
import { permissions } from '@/lib/auth/permissions';
import { userService } from '@/lib/db';

interface RouteParams {
  params: Promise<{ userId: string }>;
}

/**
 * Permanently deletes a user from D1 (see userService.deleteUserCompletely
 * for exactly what's deleted vs. reassigned) AND from Supabase Auth, so the
 * person can no longer log in at all. This cannot be undone.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { userId } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canManageUsers(currentUser.role)) {
    return NextResponse.json({ error: 'Only admins can delete users' }, { status: 403 });
  }

  if (userId === currentUser.id) {
    return NextResponse.json({ error: "You can't delete your own account from here" }, { status: 400 });
  }
  if (userId === userService.DELETED_USER_PLACEHOLDER_ID) {
    return NextResponse.json({ error: 'This is the internal placeholder account and cannot be deleted' }, { status: 400 });
  }

  const targetUser = await userService.getUserById(userId);
  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (currentUser.role !== 'admin' && targetUser.role === 'admin') {
    return NextResponse.json({ error: 'Only admins can delete an admin account' }, { status: 403 });
  }

  // D1 first: this is where the money-owed / pending-payout guard lives,
  // so if it throws, nothing has happened to Supabase Auth yet and the
  // account is fully intact.
  try {
    await userService.deleteUserCompletely(userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete user data';
    return NextResponse.json({ error: message }, { status: 409 });
  }

  // Supabase Auth deletion happens after the D1 cleanup succeeds. If this
  // fails, the D1 side is already gone (the app-facing account is
  // effectively dead - they can't do anything even if they can still log
  // in), so we report a partial-failure warning rather than a hard error.
  try {
    const supabase = await getSupabaseServiceRoleClient();
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      return NextResponse.json(
        {
          success: true,
          warning: `User data was deleted from the database, but removing their login account failed: ${error.message}. They will no longer have any data or access, but may still be able to authenticate — check the Supabase dashboard.`,
        },
        { status: 200 }
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      {
        success: true,
        warning: `User data was deleted from the database, but removing their login account failed: ${message}. Check the Supabase dashboard.`,
      },
      { status: 200 }
    );
  }

  return NextResponse.json({ success: true });
}
