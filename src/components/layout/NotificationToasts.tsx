import React from 'react';
import { useAppStore } from '../../store/useAppStore.ts';
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react';

/**
 * Premium Apple-inspired Liquid Glass notification toasts.
 * Mounted at root shell level so all views, guards, and modals can trigger toasts.
 */
export const NotificationToasts: React.FC = () => {
  const notifications = useAppStore((state) => state.notifications);
  const removeNotification = useAppStore((state) => state.removeNotification);

  if (notifications.length === 0) return null;

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Notifications système"
      className="fixed bottom-24 sm:bottom-6 right-4 sm:right-6 z-[90] flex flex-col gap-2.5 max-w-sm w-[calc(100%-2rem)] sm:w-full pointer-events-none"
    >
      {notifications.map((n) => {
        const isSuccess = n.type === 'success';
        const isError = n.type === 'error';
        const isWarning = n.type === 'warning';
        const isInfo = n.type === 'info';

        return (
          <div
            key={n.id}
            className={`pointer-events-auto backdrop-blur-2xl rounded-2xl p-4 shadow-xl border flex items-start justify-between gap-3 animate-in slide-in-from-bottom-3 fade-in duration-300 transition-all ${
              isSuccess
                ? 'bg-emerald-950/90 text-white border-emerald-500/30 shadow-[0_8px_30px_rgba(6,78,59,0.3)]'
                : isError
                ? 'bg-rose-950/90 text-white border-rose-500/30 shadow-[0_8px_30px_rgba(159,18,57,0.3)]'
                : isWarning
                ? 'bg-amber-950/90 text-white border-amber-500/30 shadow-[0_8px_30px_rgba(180,83,9,0.3)]'
                : 'bg-slate-900/90 text-white border-white/20 shadow-[0_8px_30px_rgba(15,23,42,0.3)]'
            }`}
          >
            <div className="flex items-start gap-3 min-w-0">
              <span
                className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  isSuccess
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : isError
                    ? 'bg-rose-500/20 text-rose-400'
                    : isWarning
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-cyan-500/20 text-cyan-400'
                }`}
              >
                {isSuccess && <CheckCircle2 className="w-4 h-4" />}
                {isError && <XCircle className="w-4 h-4" />}
                {isWarning && <AlertTriangle className="w-4 h-4" />}
                {isInfo && <Info className="w-4 h-4" />}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold leading-relaxed break-words">{n.message}</p>
                {isError && (
                  <span className="inline-block mt-1 text-[10px] text-rose-300/80 uppercase font-mono tracking-wider font-bold">
                    Action requise · Cliquez pour fermer
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => removeNotification(n.id)}
              className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors shrink-0 -mr-1 -mt-1 cursor-pointer"
              aria-label="Fermer la notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
