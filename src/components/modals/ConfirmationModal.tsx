import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore.ts';
import { AlertTriangle, AlertCircle, Info, X, Check, Loader2 } from 'lucide-react';

export const ConfirmationModal: React.FC = () => {
  const confirmationDialog = useAppStore((state) => state.confirmationDialog);
  const closeConfirmation = useAppStore((state) => state.closeConfirmation);

  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (confirmationDialog) {
      setInputValue(confirmationDialog.defaultValue || '');
      setIsSubmitting(false);
    }
  }, [confirmationDialog]);

  if (!confirmationDialog) return null;

  const {
    title,
    message,
    confirmLabel = 'Confirmer',
    cancelLabel = 'Annuler',
    variant = 'danger',
    inputPlaceholder,
    onConfirm
  } = confirmationDialog;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(inputPlaceholder !== undefined ? inputValue : undefined);
      closeConfirmation();
    } catch {
      // Notification will be displayed by the caller
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDanger = variant === 'danger';
  const isWarning = variant === 'warning';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-white/80 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <span
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                isDanger
                  ? 'bg-rose-50 text-rose-600 border border-rose-100'
                  : isWarning
                  ? 'bg-amber-50 text-amber-600 border border-amber-100'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-100'
              }`}
            >
              {isDanger ? (
                <AlertTriangle className="w-5 h-5" />
              ) : isWarning ? (
                <AlertCircle className="w-5 h-5" />
              ) : (
                <Info className="w-5 h-5" />
              )}
            </span>

            <div className="flex-1 min-w-0">
              <h3 className="font-serif text-lg font-bold text-slate-900 leading-snug">{title}</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed whitespace-pre-line">{message}</p>
            </div>

            <button
              onClick={closeConfirmation}
              aria-label="Fermer"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {inputPlaceholder !== undefined && (
            <div className="mt-4 pt-2">
              <input
                type="text"
                autoFocus
                placeholder={inputPlaceholder}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirm();
                  }
                }}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-500 transition-all"
              />
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={closeConfirmation}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
            >
              {cancelLabel}
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleConfirm}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-60 ${
                isDanger
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : isWarning
                  ? 'bg-amber-600 hover:bg-amber-700 text-slate-950 font-bold'
                  : 'bg-emerald-900 hover:bg-emerald-800'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Traitement…</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{confirmLabel}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
