import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore.ts';
import { api, AdminInvitation, InvitationStatus } from '../../services/api.ts';
import { UserRole } from '../../types/index.ts';
import {
  AlertTriangle,
  Check,
  ClipboardCopy,
  Clock,
  Loader2,
  Mail,
  MailCheck,
  Plus,
  Send,
  ShieldOff,
  Ticket,
  X,
  type LucideIcon
} from 'lucide-react';

const ROLE_OPTIONS: UserRole[] = ['TENANT', 'OWNER', 'AGENT', 'ADMIN', 'SUPER_ADMIN'];

const ROLE_LABELS: Record<UserRole, string> = {
  TENANT: 'Locataire',
  OWNER: 'Propriétaire',
  AGENT: 'Agent',
  ADMIN: 'Administrateur',
  SUPER_ADMIN: 'Super-Admin'
};

const STATUS_META: Record<InvitationStatus, { label: string; className: string; Icon: LucideIcon }> = {
  PENDING: { label: 'En attente', className: 'bg-amber-100 text-amber-800', Icon: Clock },
  ACCEPTED: { label: 'Acceptée', className: 'bg-emerald-100 text-emerald-800', Icon: MailCheck },
  REVOKED: { label: 'Révoquée', className: 'bg-rose-100 text-rose-700', Icon: ShieldOff },
  EXPIRED: { label: 'Expirée', className: 'bg-slate-100 text-slate-500', Icon: Clock }
};

/** `/admin/invitations` — émission et suivi des invitations au Command Center. */
export const AdminInvitationsPage: React.FC = () => {
  const addNotification = useAppStore((state) => state.addNotification);

  const [invitations, setInvitations] = useState<AdminInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState<UserRole>('ADMIN');

  /** Dernière invitation créée : son code reste affiché jusqu'à fermeture du bandeau. */
  const [issued, setIssued] = useState<{ code: string; email: string; mailSent: boolean } | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const loadInvitations = useMemo(
    () => async () => {
      setLoading(true);
      try {
        setInvitations(await api.adminGetInvitations());
        setError(null);
      } catch (err: any) {
        const message = err?.message || 'Chargement des invitations impossible';
        setError(message);
        addNotification(message, 'error');
      } finally {
        setLoading(false);
      }
    },
    [addNotification]
  );

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  const resetForm = () => {
    setEmail('');
    setFullName('');
    setPhoneNumber('');
    setRole('ADMIN');
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      addNotification('Adresse e-mail valide requise', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.adminCreateInvitation({
        email: email.trim(),
        fullName: fullName.trim() || undefined,
        phoneNumber: phoneNumber.trim() || undefined,
        role
      });
      setInvitations((prev) => [result.invitation, ...prev]);
      setIssued({
        code: result.invitation.code,
        email: result.invitation.email,
        mailSent: result.mailSent
      });
      addNotification(result.message, 'success');
      resetForm();
      setShowForm(false);
    } catch (err: any) {
      addNotification(err?.message || "Émission de l'invitation impossible", 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (invitation: AdminInvitation) => {
    if (!window.confirm(`Révoquer l'invitation de ${invitation.email} ?`)) return;
    setBusyId(invitation.id);
    try {
      const updated = await api.adminRevokeInvitation(invitation.id);
      setInvitations((prev) => prev.map((item) => (item.id === invitation.id ? updated : item)));
      addNotification(`Invitation de ${updated.email} révoquée`, 'success');
    } catch (err: any) {
      addNotification(err?.message || 'Révocation impossible', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode((prev) => (prev === code ? null : prev)), 2000);
    } catch {
      addNotification('Copie impossible : sélectionnez le code manuellement', 'error');
    }
  };

  const inputClass =
    'w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#D97706]';
  const labelClass = 'block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-800 block">
            Gouvernance des accès
          </span>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-emerald-950 mt-1">
            Invitations administrateur
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Émettez un code d'accès au Command Center. Un e-mail est envoyé à l'invité(e) si le
            serveur SMTP est configuré.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-bold shadow-md transition-colors"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Annuler' : 'Nouvelle invitation'}
        </button>
      </header>

      {/* Code émis récemment — à transmettre si l'e-mail n'est pas parti */}
      {issued && (
        <div className="rounded-2xl bg-emerald-950 text-white border border-emerald-900 shadow-lg p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-400/40 shrink-0">
              <Ticket className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold">
                {issued.mailSent
                  ? `Invitation envoyée à ${issued.email}`
                  : `Invitation créée pour ${issued.email}`}
              </p>
              <p className="text-[11px] text-emerald-100/70 mt-0.5">
                {issued.mailSent
                  ? 'Le code figure également ci-dessous par sécurité.'
                  : "Transmettez ce code d'invitation à l'intéressé(e)."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <code className="px-3.5 py-2 rounded-xl bg-white/10 border border-amber-400/40 font-mono text-sm font-bold tracking-wider text-amber-300">
              {issued.code}
            </code>
            <button
              type="button"
              onClick={() => copyCode(issued.code)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-emerald-950 text-xs font-bold transition-colors"
            >
              {copiedCode === issued.code ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <ClipboardCopy className="w-3.5 h-3.5" />
              )}
              {copiedCode === issued.code ? 'Copié' : 'Copier'}
            </button>
            <button
              type="button"
              onClick={() => setIssued(null)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 transition-colors"
              aria-label="Fermer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Formulaire de création */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center gap-2 text-emerald-950">
            <Send className="w-4 h-4" />
            <h2 className="font-serif text-lg font-bold">Émettre une invitation</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="inv-email">
                E-mail de l'invité(e) *
              </label>
              <input
                id="inv-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom.nom@exemple.ci"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="inv-name">
                Nom complet (optionnel)
              </label>
              <input
                id="inv-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex : Awa Koné"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="inv-phone">
                Téléphone (optionnel)
              </label>
              <input
                id="inv-phone"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+225 07 00 00 00 00"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="inv-role">
                Rôle accordé
              </label>
              <select
                id="inv-role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className={inputClass}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {ROLE_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-[#D97706] text-emerald-950 text-xs font-black shadow-md hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Envoyer l'invitation
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-16 flex flex-col items-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-800" />
          <p className="mt-3 text-xs">Chargement des invitations…</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-white border border-amber-200 shadow-sm p-8 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-700">{error}</p>
        </div>
      ) : invitations.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-4 border border-emerald-100">
            <Mail className="w-7 h-7" />
          </div>
          <h2 className="font-serif text-lg font-bold text-emerald-950">Aucune invitation</h2>
          <p className="text-xs text-slate-600 mt-2">
            Émettez une première invitation pour ouvrir l'accès au Command Center.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white border border-slate-200 shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3.5">Destinataire</th>
                <th className="p-3.5">Rôle</th>
                <th className="p-3.5">Code</th>
                <th className="p-3.5">Statut</th>
                <th className="p-3.5">Expire le</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invitations.map((invitation) => {
                const meta = STATUS_META[invitation.status];
                return (
                  <tr key={invitation.id} className="hover:bg-slate-50/60">
                    <td className="p-3.5">
                      <div className="font-bold text-emerald-950">{invitation.fullName || invitation.email}</div>
                      {invitation.fullName && (
                        <div className="text-[11px] text-slate-500">{invitation.email}</div>
                      )}
                      {invitation.phoneNumber && (
                        <div className="text-[11px] text-slate-400 font-mono">{invitation.phoneNumber}</div>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-wide">
                        {ROLE_LABELS[invitation.role]}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <button
                        type="button"
                        onClick={() => copyCode(invitation.code)}
                        title="Copier le code"
                        className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-slate-700 hover:text-emerald-800 transition-colors"
                      >
                        {copiedCode === invitation.code ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <ClipboardCopy className="w-3.5 h-3.5" />
                        )}
                        {invitation.code}
                      </button>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${meta.className}`}
                      >
                        <meta.Icon className="w-3 h-3" />
                        {meta.label}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-500 whitespace-nowrap">
                      {new Date(invitation.expiresAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="p-3.5 text-right">
                      {invitation.status === 'PENDING' ? (
                        <button
                          type="button"
                          disabled={busyId === invitation.id}
                          onClick={() => handleRevoke(invitation)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold shadow-sm transition-colors disabled:opacity-50"
                        >
                          {busyId === invitation.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ShieldOff className="w-3.5 h-3.5" />
                          )}
                          Révoquer
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
