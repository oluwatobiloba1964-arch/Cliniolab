'use client';

import React from 'react';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { ToastProvider } from '@/components/ui/ToastProvider';

/**
 * NOTE: @tanstack/react-query was previously wired up here with a
 * QueryClient, but no component ever used useQuery/useMutation — the
 * library only added dead weight to every client bundle. It has been
 * removed. If server-state caching is needed later, re-add the provider
 * here (the package is still in package.json).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>{children}</ToastProvider>
    </AuthProvider>
  );
}
