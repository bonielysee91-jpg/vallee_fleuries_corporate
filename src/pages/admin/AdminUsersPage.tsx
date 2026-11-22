import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore.ts';
import { api } from '../../services/api.ts';
import { User, UserRole } from '../../types/index.ts';
import {
  AlertTriangle,
  Ban,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  ShieldCheck,
  ShieldOff,
  Users
} from 'lucide-react';

type AdminUser = User & { isBanned?: boolean; banReason?: string | null };

const PAGE_SIZE = 20;

const ROLE_OPTIONS: UserRole[] = ['TENANT', 'OWNER', 'AGENT', 'ADMIN', 'SUPER_ADMIN'];

const ROLE_LABELS: Record<UserRole, string> = {
  TENANT: 'Locataire',
  OWNER: 'Propriétaire',
  AGENT: 'Agent',
  ADMIN: 'Administrateur',
  SUPER_ADMIN: 'Super-Admin'
};

const rolePillClass = (role: UserRole): string => {
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') return 'bg-amber-100 text-amber-800';
  if (role === 'OWNER' || role === 'AGENT') return 'bg-emerald-100 text-emerald-800';
  return 'bg-slate-100 text-slate-600';
};

const initialsOf = (fullName: string): string =>
  fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';

/** `/admin/users` — account management, role assignment and bans. */
export const AdminUsersPage: React.FC = () => {
  const addNotification = useAppStore((state) => state.addNotification);
  const openConfirmation = useAppStore((state) => state.openConfirmation);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .adminGetUsers({ page, pageSize: PAGE_SIZE, q: debouncedQuery })
      .then((result) => {
        if (cancelled) return;
        const pagination = result?.pagination ?? undefined;
        setUsers((result?.data ?? []) as AdminUser[]);
        setTotal(pagination?.total ?? result?.data?.length ?? 0);
        setTotalPages(pagination?.totalPages ?? 1);
        setError(null);
      })
      .catch((err: any) => {
        if (cancelled) return;
        const message = err?.message || 'Chargement des comptes impossible';
        setError(message);
        addNotification(message, 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, debouncedQuery, addNotification]);

  const handleRoleChange = async (user: AdminUser, role: UserRole) => {
    if (role === user.role) return;
    setBusyId(user.id);
    try {
      const updated = await api.adminUpdateUserRole(user.id, role);
      setUsers((prev) => prev.map((item) => (item.id === user.id ? { ...item, ...updated } : item)));
      addNotification(`Rôle de ${updated.fullName} mis à jour : ${ROLE_LABELS[role]}`, 'success');
    } catch (err: any) {
      addNotification(err?.message || 'Mise à jour du rôle impossible', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleBan = (user: AdminUser) => {
    const isBanned = Boolean(user.isBanned);

    if (isBanned) {
      openConfirmation({
        title: 'Réactiver le compte',
        message: `Voulez-vous réactiver le compte de « ${user.fullName} » (${user.phoneNumber}) ?\nL'utilisateur pourra à nouveau se connecter et accéder à ses services.`,
        confirmLabel: 'Réactiver le compte',
        variant: 'info',
        onConfirm: async () => {
          setBusyId(user.id);
          try {
            const updated = await api.adminSetUserBan(user.id, false);
            setUsers((prev) =>
              prev.map((item) => (item.id === user.id ? { ...item, ...updated, isBanned: false } : item))
            );
            addNotification(`${updated.fullName} a été réactivé avec succès`, 'success');
          } catch (err: any) {
            addNotification(err?.message || 'Réactivation impossible', 'error');
          } finally {
            setBusyId(null);
          }
        }
      });
    } else {
      openConfirmation({
        title: 'Suspendre le compte',
        message: `Voulez-vous suspendre l'accès de « ${user.fullName} » ?\nCette sanction déconnectera ses sessions en cours. Vous pouvez spécifier un motif :`,
        confirmLabel: 'Suspendre le compte',
        variant: 'danger',
        inputPlaceholder: 'Motif de la suspension (ex: Signalement abus, impayé)',
        onConfirm: async (reason) => {
          setBusyId(user.id);
          try {
            const updated = await api.adminSetUserBan(user.id, true, reason?.trim() || undefined);
            setUsers((prev) =>
              prev.map((item) => (item.id === user.id ? { ...item, ...updated, isBanned: true } : item))
            );
            addNotification(`${updated.fullName} a été suspendu`, 'success');
          } catch (err: any) {
            addNotification(err?.message || 'Suspension impossible', 'error');
          } finally {
            setBusyId(null);
          }
        }
      });
    }
  };

  const renderRoleSelect = (user: AdminUser) => (
    <select
      value={user.role}
      disabled={busyId === user.id}
      onChange={(e) => handleRoleChange(user, e.target.value as UserRole)}
      className="w-full md:w-auto px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#D97706] disabled:opacity-50"
    >
      {ROLE_OPTIONS.map((role) => (
        <option key={role} value={role}>
          {ROLE_LABELS[role]}
        </option>
      ))}
    </select>
  );

  const renderBanButton = (user: AdminUser) => (
    <button
      type="button"
      disabled={busyId === user.id}
      onClick={() => handleToggleBan(user)}
      className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-md transition-colors disabled:opacity-50 ${
        user.isBanned
          ? 'bg-emerald-900 hover:bg-emerald-800 text-white'
          : 'bg-rose-600 hover:bg-rose-700 text-white'
      }`}
    >
      {busyId === user.id ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : user.isBanned ? (
        <ShieldCheck className="w-3.5 h-3.5" />
      ) : (
        <Ban className="w-3.5 h-3.5" />
      )}
      {user.isBanned ? 'Réactiver' : 'Bannir'}
    </button>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-800 block">
            Gouvernance des accès
          </span>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-emerald-950 mt-1">
            Comptes & attributions de rôles
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            {total.toLocaleString('fr-FR')} compte{total > 1 ? 's' : ''} enregistré
            {total > 1 ? 's' : ''} sur la plateforme.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un nom, un e-mail…"
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#D97706]"
          />
        </div>
      </header>

      {loading ? (
        <div className="py-16 flex flex-col items-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-800" />
          <p className="mt-3 text-xs">Chargement des comptes…</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-white border border-amber-200 shadow-sm p-8 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-700">{error}</p>
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-4 border border-emerald-100">
            <Users className="w-7 h-7" />
          </div>
          <h2 className="font-serif text-lg font-bold text-emerald-950">Aucun compte trouvé</h2>
          <p className="text-xs text-slate-600 mt-2">
            {debouncedQuery
              ? `Aucun résultat pour « ${debouncedQuery} ».`
              : 'Aucun utilisateur n\'est enregistré pour le moment.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="overflow-x-auto rounded-2xl bg-white border border-slate-200 shadow-sm">
            <table className="hidden md:table w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5">Utilisateur</th>
                  <th className="p-3.5">Téléphone</th>
                  <th className="p-3.5">Rôle</th>
                  <th className="p-3.5">KYC</th>
                  <th className="p-3.5">Inscrit le</th>
                  <th className="p-3.5">Statut</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/60">
                    <td className="p-3.5">
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-xl bg-emerald-900 text-amber-400 flex items-center justify-center text-[11px] font-black shrink-0">
                          {initialsOf(user.fullName)}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-emerald-950 truncate">{user.fullName}</div>
                          <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 font-mono tabular-nums text-slate-700">
                      {user.phoneNumber}
                    </td>
                    <td className="p-3.5">{renderRoleSelect(user)}</td>
                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${
                          user.isKycVerified
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {user.isKycVerified ? 'Vérifié' : 'Non vérifié'}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-500 whitespace-nowrap">
                      {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="p-3.5">
                      {user.isBanned ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black uppercase tracking-wide">
                          <ShieldOff className="w-3 h-3" />
                          Banni
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wide">
                          Actif
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right">{renderBanButton(user)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile stacked cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {users.map((user) => (
                <div key={user.id} className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-emerald-900 text-amber-400 flex items-center justify-center text-xs font-black shrink-0">
                      {initialsOf(user.fullName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-emerald-950 truncate">{user.fullName}</div>
                      <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
                    </div>
                    {user.isBanned && (
                      <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black uppercase tracking-wide">
                        Banni
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Téléphone</p>
                      <p className="font-mono tabular-nums text-slate-800 mt-0.5">{user.phoneNumber}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Inscrit le</p>
                      <p className="text-slate-800 mt-0.5">
                        {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${rolePillClass(user.role)}`}
                    >
                      {ROLE_LABELS[user.role]}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${
                        user.isKycVerified
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {user.isKycVerified ? 'Vérifié' : 'Non vérifié'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">{renderRoleSelect(user)}</div>
                    {renderBanButton(user)}
                  </div>
                </div>
              ))}
            </div>
          </div>

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
