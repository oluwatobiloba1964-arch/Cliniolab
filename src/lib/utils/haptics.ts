// src/lib/utils/haptics.ts
'use client';

/**
 * Feature #13 - Vibration feedback for mobile.
 *
 * Pure utility module. Feature-detects navigator.vibrate and no-ops
 * on desktop / unsupported browsers. Always safe to call; the only
 * side effect on unsupported browsers is returning false.
 *
 * No DB, no API calls. Pure browser API.
 */

export type HapticPattern = 'light' | 'medium' | 'success' | 'error' | 'warning';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 15,
  medium: 30,
  success: [20, 40, 20],
  error: [40, 60, 40, 60, 40],
  warning: [30, 50, 30],
};

export function haptic(pattern: HapticPattern = 'light'): boolean {
  if (typeof navigator === 'undefined') return false;
  if (typeof navigator.vibrate !== 'function') return false;
  try {
    return navigator.vibrate(PATTERNS[pattern]);
  } catch {
    return false;
  }
}

export function isHapticSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}
