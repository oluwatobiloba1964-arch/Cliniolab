import { featureFlagService, platformSettingsService } from '@/lib/db';
import type { UserRole } from '@/types';

/**
 * Whether the given user may set an item's visibility to Guest, and whether
 * the item itself is eligible. Returns an error message, or null when OK.
 * Called by every route that can write a visibility value.
 */
export async function checkGuestVisibilityAllowed(opts: {
  role: UserRole | null;
  pricing: 'free' | 'paid' | undefined;
}): Promise<string | null> {
  const enabled = await featureFlagService.isFeatureEnabled('guest_practice');
  if (!enabled) return 'Guest Practice is currently turned off.';
  if (opts.pricing === 'paid') return 'Paid items cannot be set to Guest. Guest items must be free.';
  const setting = await platformSettingsService.getGuestPracticeSetting();
  const isAdmin = opts.role === 'admin';
  const isStaff = isAdmin || opts.role === 'moderator';
  if (setting.creatorAccess === 'admin_only' && !isAdmin) {
    return 'Only admins can publish items to Guest Practice.';
  }
  if (setting.creatorAccess === 'admin_moderator' && !isStaff) {
    return 'Only admins and moderators can publish items to Guest Practice.';
  }
  return null;
}
