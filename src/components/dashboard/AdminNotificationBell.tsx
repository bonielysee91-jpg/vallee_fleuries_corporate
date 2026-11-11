import React, { useEffect, useRef, useState } from 'react';
import { Bell, BellRing, CalendarClock, CheckCheck, Phone, Wifi, WifiOff } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useAppStore } from '../../store/useAppStore.ts';
import { api } from '../../services/api.ts';
import { AdminNotification } from '../../types/index.ts';

/** Nombre maximal d'alertes conservées à l'écran. */
const MAX_ITEMS = 30;

function formatRelativeTime(iso: string): string {
  const deltaSeconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (deltaSeconds < 60) return "à l'instant";
  const minutes = Math.round(deltaSeconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return new Date(iso).toLocaleDateString('fr-FR');
}

/**
 * Cloche du Command Center : écoute le canal WebSocket réservé aux administrateurs
 * et affiche les demandes de visite en temps réel (badge de compteur + tiroir).
 */
export const AdminNotificationBell: React.FC = () => {
  const addNotification = useAppStore((state) => state.addNotification);

  const [items, setItems] = useState<AdminNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  // Historique persistant : la cloche affiche les alertes déjà enregistrées en base,
  // même si aucun administrateur n'était connecté au moment de la demande.
  useEffect(() => {
    let cancelled = false;
    api
      .adminGetNotifications()
      .then((rows) => {
        if (cancelled) return;
        setItems(rows.slice(0, MAX_ITEMS));
        setUnread(rows.filter((row) => !row.read).length);
      })
      .catch(() => {
        /* Best-effort : la cloche reste fonctionnelle en temps réel même si l'historique échoue. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Connexion à la même origine que l'application ; le cookie httpOnly de session
    // authentifie l'administrateur lors de la poignée de main.
    const socket = io({ path: '/socket.io', withCredentials: true });
    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('visit:new', (payload: AdminNotification) => {
      if (!payload) return;
      setItems((prev) => [{ ...payload, read: false }, ...prev].slice(0, MAX_ITEMS));
      setUnread((prev) => prev + 1);
      addNotification(payload.message || 'Nouvelle demande de visite', 'info');
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [addNotification]);

  /** Marque localement les alertes comme lues et persiste l'état en base. */
  const persistRead = () => {
    setUnread(0);
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    void api.adminMarkNotificationsRead().catch(() => {
      /* Échec silencieux : l'affichage reste correct, seule la persistance est différée. */
    });
  };

  const handleToggle = () => {
    if (!isOpen) persistRead();
    setIsOpen(!isOpen);
  };

  const handleMarkAllRead = () => {
    persistRead();
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Notifications du Command Center"
        className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 transition-all"
      >
        {unread > 0 ? (
          <BellRing className="w-4 h-4 text-amber-400" />
        ) : (
          <Bell className="w-4 h-4" />
        )}
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-emerald-950 text-[10px] font-black flex items-center justify-center border border-emerald-950">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Voile de fermeture au clic extérieur */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] z-50 rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-emerald-950">Alertes visites</span>
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold"
                  title={isConnected ? 'Cloche connectée en temps réel' : 'Cloche hors ligne'}
                >
                  {isConnected ? (
                    <Wifi className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <WifiOff className="w-3 h-3 text-slate-400" />
                  )}
                </span>
              </div>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 hover:text-emerald-950 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Tout lire
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-10 text-center text-xs text-slate-500">
                  Aucune alerte pour le moment.
                  <br />
                  Les demandes de visite apparaîtront ici en direct.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <li key={`${item.id}-${item.receivedAt}`} className="px-4 py-3 hover:bg-slate-50/70">
                      <p className="text-xs font-bold text-emerald-950">
                        {item.propertyTitle}
                        {item.commune ? ` · ${item.commune}` : ''}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-600 flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {item.clientName} — {item.clientPhone}
                      </p>
                      {item.scheduledDate && (
                        <p className="mt-1 text-[11px] text-slate-500 flex items-center gap-1.5">
                          <CalendarClock className="w-3 h-3 text-slate-400" />
                          {item.scheduledDate}
                          {item.scheduledTime ? ` à ${item.scheduledTime}` : ''}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
                        {formatRelativeTime(item.receivedAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
