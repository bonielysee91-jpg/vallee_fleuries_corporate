import React from 'react';
import { useAppStore } from '../../store/useAppStore.ts';
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react';

/**
 * Fluid "liquid glass" toast surface. Mounted once at the app shell level so
 * alerts raised by route guards remain visible on every route.
 */
export const NotificationToasts: React.FC = () => {
  const notifications = useAppStore((state) => state.notifications);
  const removeNotification = useAppStore((state) => state.removeNotification);

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-[60] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] sm:w-full pointer-events-none">
      {notifications.map((n) => (
        <div
          key={n.id}
          className="pointer-events-auto backdrop-blur-2xl bg-white/90 dark:bg-emerald-950/70 rounded-2xl p-3.5 shadow-2xl border border-white/60 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-2 fade-in duration-200"
        >
          <div className="flex items-center gap-2.5">
            {n.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {n.type === 'info' && <Info className="w-4 h-4 text-cyan-600 shrink-0" />}
            {n.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
            {n.type === 'error' && <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
            <span className="text-xs font-semibold text-slate-800 leading-snug">{n.message}</span>
          </div>
          <button
            onClick={() => removeNotification(n.id)}
            className="p-1 text-slate-400 hover:text-slate-700"
            aria-label="Fermer la notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
