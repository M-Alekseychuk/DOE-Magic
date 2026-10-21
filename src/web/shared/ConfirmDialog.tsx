import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  // Red confirm button and a warning icon, for actions that delete or overwrite data
  destructive?: boolean;
  // Disables both buttons while the confirmed action runs
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Asks before a destructive action (design spec §5.5). Cancel has the initial focus, and Escape or a click
// outside the dialog cancels, so a stray Enter or click never confirms. It renders into document.body, so the
// caller's layout (spacing, overflow, transforms) cannot shift or clip it.
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  busy = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onCancelRef.current = onCancel;
  });

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || busy) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancelRef.current();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, busy]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={() => { if (!busy) onCancel(); }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xl p-5 text-slate-800 dark:text-slate-100"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          {destructive && (
            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <AlertTriangle size={16} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 id="confirm-dialog-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h3>
            <div id="confirm-dialog-message" className="mt-1.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">{message}</div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-50 dark:hover:bg-slate-800 font-medium text-[11px] disabled:opacity-60"
          >
            {cancelLabel ?? t('cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`px-3 py-1.5 rounded text-white font-medium text-[11px] disabled:opacity-60 ${destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'}`}
          >
            {confirmLabel ?? t('confirm', 'Confirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
