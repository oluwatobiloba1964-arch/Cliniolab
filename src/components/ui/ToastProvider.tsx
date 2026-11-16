// src/components/ui/ToastProvider.tsx
'use client';

/**
 * App-wide toast + confirm system.
 *
 * Before this, success/error feedback was inline paragraph text and every
 * destructive action used window.confirm() — 13 native browser dialogs that
 * ignore the app's design system and dark mode. This provider exposes:
 *
 *   const { toast } = useToast();          // toast.success('Saved'), toast.error(...)
 *   const { confirm } = useConfirm();      // await confirm('Delete this?') -> boolean
 *
 * Mount <ToastProvider> once near the app root (see providers.tsx).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
  };
}

interface ConfirmOptions {
  title?: string;
  /** Body text shown under the title. */
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red destructive styling for the confirm button (deletes etc.). */
  destructive?: boolean;
}

interface ConfirmRequest extends ConfirmOptions {
  id: number;
  resolve: (ok: boolean) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
const ConfirmContext = createContext<{ confirm: (options: ConfirmOptions) => Promise<boolean> } | null>(null);

const TOAST_LIMIT = 4;
const TOAST_MS = 4500;

function ToastIcon({ kind }: { kind: ToastKind }) {
  if (kind === 'success') return <CheckCircle2 className="h-5 w-5 shrink-0 text-pulse-600" aria-hidden />;
  if (kind === 'error') return <XCircle className="h-5 w-5 shrink-0 text-critical-600" aria-hidden />;
  return <Info className="h-5 w-5 shrink-0 text-ink-500" aria-hidden />;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  const nextId = useRef(1);
  const confirmResolverRef = useRef<((ok: boolean) => void) | null>(null);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-(TOAST_LIMIT - 1)), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), TOAST_MS);
    },
    [dismiss]
  );

  const toast = useMemo<ToastContextValue['toast']>(
    () => ({
      success: (m: string) => push('success', m),
      error: (m: string) => push('error', m),
      info: (m: string) => push('info', m),
    }),
    [push]
  );

  const confirm = useCallback((options: ConfirmOptions) => {
    // Only one dialog at a time; a second request auto-cancels the first.
    confirmResolverRef.current?.(false);
    return new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmReq({ ...options, id: nextId.current++, resolve });
    });
  }, []);

  const settle = useCallback((ok: boolean) => {
    confirmResolverRef.current?.(ok);
    confirmResolverRef.current = null;
    setConfirmReq(null);
  }, []);

  // Escape closes the confirm dialog as a cancel.
  useEffect(() => {
    if (!confirmReq) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') settle(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmReq, settle]);

  return (
    <ToastContext.Provider value={{ toast }}>
      <ConfirmContext.Provider value={{ confirm }}>
        {children}

        {/* Toast stack */}
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4 sm:bottom-6"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border border-ink-200 bg-white/95 p-3.5 shadow-lg backdrop-blur dark:bg-ink-900/95"
            >
              <ToastIcon kind={t.kind} />
              <p className="min-w-0 flex-1 text-sm leading-snug text-ink-700">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="rounded-md p-0.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-600"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ))}
        </div>

        {/* Confirm dialog */}
        {confirmReq && (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={confirmReq.title ?? 'Confirm action'}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-ink-900/60 p-4"
            onClick={() => settle(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-ink-200 bg-white p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="font-display text-lg font-semibold text-ink-800">
                {confirmReq.title ?? (confirmReq.destructive ? 'Are you sure?' : 'Please confirm')}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{confirmReq.message}</p>
              <div className="mt-5 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => settle(false)}
                  className="min-h-11 rounded-xl border border-ink-200 bg-white px-4 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
                >
                  {confirmReq.cancelLabel ?? 'Cancel'}
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={() => settle(true)}
                  className={
                    confirmReq.destructive
                      ? 'min-h-11 rounded-xl bg-critical-500 px-4 text-sm font-semibold text-white transition hover:bg-critical-600'
                      : 'min-h-11 rounded-xl bg-pulse-700 px-4 text-sm font-semibold text-white transition hover:bg-pulse-800'
                  }
                >
                  {confirmReq.confirmLabel ?? 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ToastProvider>');
  return ctx;
}
