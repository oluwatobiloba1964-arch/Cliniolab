// File: src/lib/auth/permissions.ts
import type { UserRole } from '@/types';

/** Central place for role-based permission checks used across API routes and pages. */
export const permissions = {
  canAttemptQuizzes: (role: UserRole | null) => role !== null, // any logged-in user
  canCreateQuizzes: (role: UserRole | null) => role !== null, // any logged-in user
  canCreateFlashcards: (role: UserRole | null) => role !== null, // any logged-in user
  canManageBlog: (role: UserRole | null) => role === 'admin' || role === 'moderator',
  canManageLearningContent: (role: UserRole | null) => role === 'admin' || role === 'moderator',
  canAccessAdminPanel: (role: UserRole | null) => role === 'admin' || role === 'moderator',
  canManageFeatureFlags: (role: UserRole | null) => role === 'admin' || role === 'moderator',
  canManageUsers: (role: UserRole | null) => role === 'admin' || role === 'moderator',
  canDeleteAnyQuiz: (role: UserRole | null) => role === 'admin' || role === 'moderator',
  canEditStaticPages: (role: UserRole | null) => role === 'admin' || role === 'moderator',
};

/** True if the user owns the resource, or is an admin/moderator (full control over any user's content). */
export function isOwnerOrStaff(role: UserRole | null, resourceOwnerId: string, userId: string | null): boolean {
  if (role === 'admin' || role === 'moderator') return true;
  return userId !== null && userId === resourceOwnerId;
}
