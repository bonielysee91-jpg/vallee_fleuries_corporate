import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore.ts';
import { AdminStats, api } from '../../services/api.ts';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarCheck,
  Landmark,
  Loader2,
  ListChecks,
  ScrollText,
  UserCog,
  Users
} from 'lucide-react';

const QUICK_LINKS = [
  {
    to: '/admin/visits',
    icon: CalendarCheck,
    title: 'Confirmation des visites clients',
    description: 'Valider les demandes de visite, assigner les créneaux et confirmer sur WhatsApp.'
  },
  {
    to: '/admin/users',
    icon: UserCog,
    title: 'Comptes & attributions de rôles',
    description: 'Vérifier la KYC, promouvoir un agent et suspendre un compte abusif.'
  },
  {
    to: '/admin/moderation',
    icon: ListChecks,
    title: 'File de modération des annonces',
    description: 'Homologuer les mandats propriétaires en attente et publier les annonces locatives.'
  },
  {
    to: '/admin/audit-logs',
    icon: ScrollText,
    title: 'Journaux d\'audit & purge',
    description: 'Consulter l\'historique horodaté des actions administrateurs et le purger.'
  },
  {
    to: '/admin/settings',
    icon: UserCog,
    title: 'Sécurité & Accès Super-Admin',
    description: 'Gestion du compte administrateur, mise à jour sécurisée du mot de passe et habilitations.'
  }
];

/** `/admin` — Super-Admin command centre with platform-wide KPIs. */
export const AdminOverviewPage: React.FC = () => {
  const addNotification = useAppStore((state) => state.addNotification);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pendingVisitsCount, setPendingVisitsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([api.adminGetStats(), api.getVisits()])
      .then(([data, visits]) => {
        if (cancelled) return;
        setStats(data);
        const pending = visits.filter((v) => v.status === 'PENDING').length;
        setPendingVisitsCount(pending);
        setError(null);
      })
      .catch((err: any) => {
        if (cancelled) return;
        const message = err?.message || 'Chargement des indicateurs impossible';
        setError(message);
        addNotification(message, 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [addNotification]);

  const kpis = stats
    ? [
        { label: 'Utilisateurs inscrits', value: stats.users.toLocaleString('fr-FR'), icon: Users, tone: 'emerald' as const, to: '/admin/users' },
        { label: 'Biens publiés', value: stats.properties.toLocaleString('fr-FR'), icon: Building2, tone: 'emerald' as const, to: '/admin/properties' },
        { label: 'Réservations & Visites', value: stats.bookings.toLocaleString('fr-FR'), icon: CalendarCheck, tone: 'amber' as const, to: '/admin/visits' },
        { label: 'Sessions actives', value: stats.activeSessions.toLocaleString('fr-FR'), icon: Activity, tone: 'emerald' as const, to: '/admin/audit-logs' }
      ]
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header>
        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-800 block">
          Direction Générale &amp; Conservateur Foncier VFC
        </span>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-emerald-950 mt-1">
          Poste de commandement Super-Admin
        </h1>
        <p className="text-xs text-slate-600 mt-1">
          Vue consolidée du registre locatif, des parcours clients et de la conformité foncière.
        </p>
      </header>

      {/* Alerte Visites en attente de confirmation */}
      {pendingVisitsCount > 0 && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-300/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-amber-500 text-emerald-950 flex items-center justify-center shrink-0">
              <CalendarCheck className="w-5 h-5" />
            </span>
            <div>
              <p className="text-xs font-bold text-amber-950">
                {pendingVisitsCount} demande{pendingVisitsCount > 1 ? 's' : ''} de visite en attente de confirmation
              </p>
              <p className="text-[11px] text-amber-800">
                Des clients attendent la validation de leur créneau de visite et leur confirmation WhatsApp.
              </p>
            </div>
          </div>
          <Link
            to="/admin/visits"
            className="px-4 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all shrink-0"
          >
            <span>Confirmer les visites</span>
            <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
          </Link>
        </div>
      )}

      {loading ? (
        <div className="py-16 flex flex-col items-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-800" />
          <p className="mt-3 text-xs">Chargement des indicateurs de la plateforme…</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-white border border-amber-200 shadow-sm p-8 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-700">{error}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {kpis.map((kpi) => (
            <Link
              key={kpi.label}
              to={kpi.to}
              className="group rounded-2xl liquid-glass-card border border-white/60 hover:border-emerald-300 shadow-sm hover:shadow-md p-5 flex items-start justify-between gap-4 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-slate-500 group-hover:text-emerald-900 transition-colors">
                  <p className="text-[10px] font-semibold uppercase tracking-wide">
                    {kpi.label}
                  </p>
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all text-emerald-700" />
                </div>
                <p className="mt-1.5 text-xl font-bold text-emerald-950 font-mono tabular-nums break-words">
                  {kpi.value}
                </p>
              </div>
              <span
                className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                  kpi.tone === 'amber'
                    ? 'bg-amber-100 text-[#D97706]'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                <kpi.icon className="w-5 h-5" />
              </span>
            </Link>
          ))}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="font-serif text-lg font-bold text-emerald-950">Accès rapides</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {QUICK_LINKS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="group rounded-2xl liquid-glass-card border border-white/60 shadow-sm p-5 flex flex-col gap-3"
            >
              <span className="w-10 h-10 rounded-xl bg-emerald-900 text-amber-400 flex items-center justify-center">
                <item.icon className="w-5 h-5" />
              </span>
              <span className="text-sm font-bold text-emerald-950">{item.title}</span>
              <span className="text-[11px] text-slate-600 leading-relaxed flex-1">{item.description}</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 group-hover:text-emerald-600">
                Ouvrir la console
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 text-emerald-950">
            <Landmark className="w-5 h-5 text-emerald-700" />
            <h2 className="font-serif text-base font-bold">Conformité locative</h2>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Chaque mandat propriétaire et chaque état des lieux sont contrôlés avant publication.
            La plateforme applique strictement le
            plafonnement légal de <strong>2 mois d'avance</strong> et <strong>2 mois de caution</strong>
            {' '}prévu par la <strong>Loi N° 2019-576 du 26 juin 2019</strong>, ainsi que le
            plafond d'honoraires d'agence.
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">
            La plateforme assiste au calcul du <strong>droit d'enregistrement de 2,5 % (DGI)</strong>{' '}
            appliqué sur le loyer annuel lors de l'enregistrement fiscal du bail auprès de la
            Direction Générale des Impôts.
          </p>
        </section>

        <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 text-emerald-950">
            <ScrollText className="w-5 h-5 text-emerald-700" />
            <h2 className="font-serif text-base font-bold">Sécurité &amp; Traçabilité</h2>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Les accès sont protégés par une authentification JWT — jeton d'accès gardé en mémoire,
            jeton de rafraîchissement en cookie httpOnly — et un contrôle d'accès par rôle (RBAC).
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">
            Chaque action sensible — confirmation de visite, modération d'annonce, changement de rôle
            ou suspension de compte — est horodatée dans le journal d'audit consultable ci-dessus.
          </p>
        </section>
      </div>
    </div>
  );
};
