import React, { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore.ts';
import { AuditLogEntry, api } from '../../services/api.ts';
import { UserRole } from '../../types/index.ts';
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Loader2,
  ScrollText,
  ShieldCheck,
  Trash,
  Trash2
} from 'lucide-react';

const PAGE_SIZE = 25;

const rolePillClass = (role: UserRole): string => {
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') return 'bg-amber-100 text-amber-800';
  if (role === 'OWNER' || role === 'AGENT') return 'bg-emerald-100 text-emerald-800';
  return 'bg-slate-100 text-slate-600';
};

/** `/admin/audit-logs` — system activity logs with a traced purge capability. */
export const AdminAuditLogsPage: React.FC = () => {
  const addNotification = useAppStore((state) => state.addNotification);
  const openConfirmation = useAppStore((state) => state.openConfirmation);

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.adminGetAuditLogs({ page, pageSize: PAGE_SIZE });
      const pagination = result?.pagination ?? undefined;
      setLogs(result?.data ?? []);
      setTotal(pagination?.total ?? result?.data?.length ?? 0);
      setTotalPages(pagination?.totalPages ?? 1);
      setError(null);
    } catch (err: any) {
      const message = err?.message || 'Chargement des journaux d\'audit impossible';
      setError(message);
      addNotification(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [page, addNotification]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Suppression d'une entrée ; l'effacement est lui-même journalisé côté serveur. */
  const handleDelete = (log: AuditLogEntry) => {
    openConfirmation({
      title: 'Supprimer une entrée d\'audit',
      message: `Supprimer définitivement l'entrée « ${log.action} » du ${new Date(log.createdAt).toLocaleString('fr-FR')} ?\n\nCette action est irréversible et sera elle-même inscrite au journal d'audit.`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
      onConfirm: async () => {
        setBusyId(log.id);
        try {
          await api.adminDeleteAuditLog(log.id);
          addNotification('Entrée d\'audit supprimée.', 'success');
          if (logs.length === 1 && page > 1) setPage((prev) => prev - 1);
          else await load();
        } catch (err: any) {
          addNotification(err?.message || 'Suppression impossible', 'error');
        } finally {
          setBusyId(null);
        }
      }
    });
  };

  /** Purge complète du journal (opération de maintenance journalisée en retour). */
  const handlePurge = () => {
    openConfirmation({
      title: 'Purger l\'intégralité du journal d\'audit',
      message: `Êtes-vous certain de vouloir purger le journal d'audit ?\n\n${total.toLocaleString('fr-FR')} entrée${total > 1 ? 's' : ''} seront définitivement effacées. Une entrée certifiée de traçabilité de la purge sera créée pour le registre légal.`,
      confirmLabel: 'Purger tout le journal',
      variant: 'danger',
      onConfirm: async () => {
        setPurging(true);
        try {
          const deleted = await api.adminPurgeAuditLogs();
          addNotification(`Journal d'audit purgé : ${deleted} entrée(s) supprimée(s).`, 'success');
          if (page !== 1) setPage(1);
          else await load();
        } catch (err: any) {
          addNotification(err?.message || 'Purge du journal impossible', 'error');
        } finally {
          setPurging(false);
        }
      }
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-800 block">
            Traçabilité &amp; conformité
          </span>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-emerald-950 mt-1">
            Journaux d'audit du système
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            {total.toLocaleString('fr-FR')} entrée{total > 1 ? 's' : ''} archivée
            {total > 1 ? 's' : ''} — historique horodaté des actions administrateurs.
          </p>
        </div>
        <button
          type="button"
          onClick={handlePurge}
          disabled={purging || total === 0}
          className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-rose-200 text-rose-700 text-xs font-bold shadow-sm hover:bg-rose-50 transition-colors disabled:opacity-50"
        >
          {purging ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash className="w-4 h-4" />
          )}
          Purger le journal
        </button>
      </header>

      <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
        <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
        <p className="text-[11px] text-emerald-950 leading-relaxed">
          Historique horodaté des actions administrateurs. La Direction peut supprimer une
          entrée ou purger le journal ; chaque effacement est <strong>lui-même journalisé</strong>
          {' '}(actions <span className="font-mono">AUDIT_LOG_DELETED</span> et{' '}
          <span className="font-mono">AUDIT_LOG_PURGED</span>) afin de préserver la traçabilité.
        </p>
      </div>

      {loading ? (
        <div className="py-16 flex flex-col items-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-800" />
          <p className="mt-3 text-xs">Chargement des journaux d'audit…</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-white border border-amber-200 shadow-sm p-8 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-700">{error}</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-4 border border-emerald-100">
            <ScrollText className="w-7 h-7" />
          </div>
          <h2 className="font-serif text-lg font-bold text-emerald-950">Aucune entrée d'audit</h2>
          <p className="text-xs text-slate-600 mt-2">
            Aucune activité n'a encore été journalisée pour cette page.
          </p>
        </div>
      ) : (
        <>
          <ol className="space-y-3">
            {logs.map((log) => {
              const expanded = expandedId === log.id;
              return (
                <li
                  key={log.id}
                  className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[10px] font-mono font-bold tracking-wide">
                          {log.action}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {log.entity}
                          {log.entityId ? (
                            <span className="font-mono tabular-nums"> · {log.entityId}</span>
                          ) : null}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        {log.actor ? (
                          <>
                            <span className="font-bold text-emerald-950">{log.actor.fullName}</span>
                            <span className="text-slate-500">{log.actor.email}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${rolePillClass(log.actor.role)}`}
                            >
                              {log.actor.role}
                            </span>
                          </>
                        ) : (
                          <span className="font-semibold text-slate-500">Système</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                        <span>{new Date(log.createdAt).toLocaleString('fr-FR')}</span>
                        <span className="font-mono tabular-nums">
                          IP : {log.ipAddress || '—'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : log.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        {expanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                        Détails
                      </button>
                      <button
                        type="button"
                        disabled={busyId === log.id}
                        onClick={() => handleDelete(log)}
                        title="Supprimer définitivement cette entrée"
                        aria-label={`Supprimer l'entrée d'audit ${log.action}`}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-50"
                      >
                        {busyId === log.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        Supprimer
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                      <pre className="text-[11px] whitespace-pre-wrap break-all text-slate-700 font-mono">
                        {log.details === null || log.details === undefined
                          ? 'Aucun détail pour cette entrée.'
                          : JSON.stringify(log.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-500">
              Page {page} sur {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Précédent
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                Suivant
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
