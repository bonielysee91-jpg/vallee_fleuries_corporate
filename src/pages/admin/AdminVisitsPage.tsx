import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore.ts';
import { api } from '../../services/api.ts';
import { VisitAppointment, VisitStatus } from '../../types/index.ts';
import {
  CalendarClock,
  CheckCircle2,
  XCircle,
  Clock,
  CheckCheck,
  Phone,
  Search,
  Download,
  RefreshCw,
  ExternalLink,
  MapPin,
  Building2,
  User,
  AlertCircle,
  Video,
  Navigation,
  MessageCircle,
  Loader2,
  Trash2
} from 'lucide-react';

type StatusFilter = 'ALL' | VisitStatus;

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'ALL', label: 'Toutes les visites' },
  { id: 'PENDING', label: 'En attente' },
  { id: 'CONFIRMED', label: 'Acceptées — à effectuer' },
  { id: 'COMPLETED', label: 'Effectuées' },
  { id: 'CANCELLED', label: 'Annulées' },
];

const STATUS_CONFIG: Record<
  VisitStatus,
  { label: string; bg: string; text: string; border: string; icon: React.FC<{ className?: string }> }
> = {
  PENDING: {
    label: 'En attente de confirmation',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    icon: Clock,
  },
  CONFIRMED: {
    label: 'Acceptée — en attente d\'exécution',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    icon: CheckCircle2,
  },
  COMPLETED: {
    label: 'Visite Effectuée',
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
    icon: CheckCheck,
  },
  CANCELLED: {
    label: 'Visite Annulée',
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-200',
    icon: XCircle,
  },
};

/** `/admin/visits` — Gestion et confirmation des visites clients par la Direction. */
export const AdminVisitsPage: React.FC = () => {
  const addNotification = useAppStore((state) => state.addNotification);
  const [visits, setVisits] = useState<VisitAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IN_PERSON' | 'VIRTUAL_3D'>('ALL');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadVisits = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await api.getVisits();
      setVisits(data);
    } catch (err: any) {
      addNotification(err.message || 'Impossible de charger les visites', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadVisits();
  }, []);

  // Met à jour le statut d'une visite avec audit en temps réel
  const handleUpdateStatus = async (visitId: string, newStatus: VisitStatus) => {
    // Message optionnel transmis au client, visible dans son espace « Mes demandes de visite ».
    let adminMessage: string | undefined;
    if (newStatus === 'CONFIRMED' || newStatus === 'CANCELLED') {
      const input = window.prompt(
        newStatus === 'CONFIRMED'
          ? 'Message au client pour confirmer la visite (optionnel) :'
          : 'Motif du refus à communiquer au client (optionnel) :',
        ''
      );
      if (input === null) return;
      adminMessage = input.trim() || undefined;
    }

    setBusyId(visitId);
    try {
      const updated = await api.updateVisitStatus(visitId, newStatus, undefined, adminMessage);
      setVisits((prev) => prev.map((v) => (v.id === visitId ? updated : v)));
      const actionText =
        newStatus === 'CONFIRMED'
          ? 'Visite confirmée avec succès !'
          : newStatus === 'COMPLETED'
          ? 'Visite marquée comme effectuée.'
          : newStatus === 'CANCELLED'
          ? 'Visite annulée.'
          : 'Statut de visite actualisé.';
      addNotification(actionText, 'success');
    } catch (err: any) {
      addNotification(err.message || 'Erreur lors de la mise à jour du statut', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteVisit = async (visit: VisitAppointment) => {
    const clientName = visit.clientName || visit.userName || 'ce client';
    if (
      !window.confirm(
        `Supprimer définitivement la demande de visite de ${clientName} pour « ${visit.propertyTitle} » ?`
      )
    ) {
      return;
    }

    setBusyId(visit.id);
    try {
      await api.adminDeleteVisit(visit.id);
      setVisits((current) => current.filter((item) => item.id !== visit.id));
      addNotification('Demande de visite supprimée.', 'success');
    } catch (err: any) {
      addNotification(err.message || 'Suppression de la demande impossible', 'error');
    } finally {
      setBusyId(null);
    }
  };

  // Génération du message WhatsApp officiel pré-formaté pour le client
  const getWhatsAppConfirmationUrl = (v: VisitAppointment) => {
    const phoneClean = (v.clientPhone || '').replace(/[^0-9]/g, '');
    const dateFormatted = v.scheduledDate || v.visitDate;
    const timeFormatted = v.scheduledTime || v.timeSlot;
    const msg =
      `Bonjour ${v.clientName || v.userName || 'Madame / Monsieur'},\n\n` +
      `La Direction de *Vallées Fleuries Corporate* a le plaisir de vous confirmer votre visite pour le bien suivant :\n` +
      `🏡 *${v.propertyTitle}* (${v.commune || 'Abidjan'})\n` +
      `📅 *Date :* ${dateFormatted}\n` +
      `🕒 *Heure :* ${timeFormatted}\n` +
      `📍 *Modalité :* ${v.visitType === 'VIRTUAL_3D' ? 'Visio Immersive 3D' : 'Visite physique guidée sur site'}\n\n` +
      `Notre agent conciergerie sera à votre disposition sur place.\n` +
      `Pour toute question : +225 01 72 63 31 34.\n` +
      `_Vallées Fleuries Corporate — L'Immobilier de Confiance en Côte d'Ivoire_`;
    return `https://wa.me/${phoneClean}?text=${encodeURIComponent(msg)}`;
  };

  // Export CSV du registre des visites
  const handleExportCsv = () => {
    if (visits.length === 0) return;
    const headers = ['ID', 'Client', 'Téléphone', 'Bien', 'Commune', 'Date', 'Créneau', 'Format', 'Statut', 'Notes'];
    const rows = visits.map((v) => [
      v.id,
      `"${v.clientName || v.userName || ''}"`,
      `"${v.clientPhone || ''}"`,
      `"${v.propertyTitle || ''}"`,
      `"${v.commune || ''}"`,
      v.scheduledDate || v.visitDate || '',
      v.scheduledTime || v.timeSlot || '',
      v.visitType === 'VIRTUAL_3D' ? 'Visio 3D' : 'Sur site',
      v.status,
      `"${(v.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VFC-Registre-Visites-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addNotification('Export CSV des visites téléchargé avec succès.', 'success');
  };

  // Comptages pour les indicateurs
  const counts = useMemo(() => {
    const c = { ALL: visits.length, PENDING: 0, CONFIRMED: 0, COMPLETED: 0, CANCELLED: 0 };
    for (const v of visits) {
      if (c[v.status] !== undefined) c[v.status]++;
    }
    return c;
  }, [visits]);

  // Filtrage combiné (statut, type, recherche)
  const filteredVisits = useMemo(() => {
    return visits.filter((v) => {
      if (filter !== 'ALL' && v.status !== filter) return false;
      if (typeFilter !== 'ALL' && (v.visitType || v.type) !== typeFilter) return false;
      if (search.trim()) {
        const query = search.toLowerCase();
        const client = (v.clientName || v.userName || '').toLowerCase();
        const phone = (v.clientPhone || '').toLowerCase();
        const prop = (v.propertyTitle || '').toLowerCase();
        const commune = (v.commune || '').toLowerCase();
        if (!client.includes(query) && !phone.includes(query) && !prop.includes(query) && !commune.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [visits, filter, typeFilter, search]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* En-tête de la page */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-800 block">
            Direction Commerciale & Conciergerie Locative VFC
          </span>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-emerald-950 mt-1">
            Gestion & Confirmation des Visites
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Validez les rendez-vous clients, confirmez les créneaux et déclenchez les rappels WhatsApp officiels.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => loadVisits(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-emerald-950 hover:bg-slate-50 text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-700' : ''}`} />
            <span>Actualiser</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={visits.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-amber-300" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Cartes KPI / Statistiques */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl liquid-glass-card border border-white/60 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Demandes</span>
            <CalendarClock className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-950 font-mono mt-1">{counts.ALL}</p>
        </div>

        <div className="rounded-2xl liquid-glass-card border border-amber-200/80 bg-amber-50/40 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900">À Confirmer</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-900 font-mono mt-1">{counts.PENDING}</p>
        </div>

        <div className="rounded-2xl liquid-glass-card border border-emerald-200/80 bg-emerald-50/40 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900">Acceptées — à effectuer</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-950 font-mono mt-1">{counts.CONFIRMED}</p>
          <p className="text-[10px] text-emerald-800 mt-0.5">acceptée(s), en attente du passage sur site</p>
        </div>

        <div className="rounded-2xl liquid-glass-card border border-blue-200/80 bg-blue-50/40 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900">Effectuées</span>
            <CheckCheck className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-blue-950 font-mono mt-1">{counts.COMPLETED}</p>
        </div>
      </div>

      {/* Rappel : visites acceptées mais pas encore effectuées par la Direction */}
      {counts.CONFIRMED > 0 && (
        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-300/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
              <CheckCheck className="w-5 h-5" />
            </span>
            <div>
              <p className="text-xs font-bold text-emerald-950">
                {counts.CONFIRMED} visite{counts.CONFIRMED > 1 ? 's' : ''} acceptée
                {counts.CONFIRMED > 1 ? 's' : ''} — pas encore effectuée
                {counts.CONFIRMED > 1 ? 's' : ''}
              </p>
              <p className="text-[11px] text-emerald-800">
                Le créneau est validé avec le client : marquez « Effectuée » après le passage sur site.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setFilter('CONFIRMED');
              setTypeFilter('ALL');
              setSearch('');
            }}
            className="px-4 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all shrink-0 cursor-pointer"
          >
            <span>Voir ces visites</span>
          </button>
        </div>
      )}

      {/* Barre d'outils (Recherche + Filtres) */}
      <div className="rounded-2xl bg-white border border-slate-200/90 shadow-sm p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Champ recherche */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom client, téléphone, titre du bien ou commune…"
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800"
            />
          </div>

          {/* Filtre type de visite */}
          <div className="flex items-center gap-1.5 shrink-0 text-xs">
            <span className="text-slate-500 font-medium hidden sm:inline">Format :</span>
            <button
              type="button"
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                typeFilter === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tous
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('IN_PERSON')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                typeFilter === 'IN_PERSON'
                  ? 'bg-emerald-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Navigation className="w-3 h-3" />
              <span>Sur site</span>
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('VIRTUAL_3D')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                typeFilter === 'VIRTUAL_3D'
                  ? 'bg-emerald-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Video className="w-3 h-3" />
              <span>Visio 3D</span>
            </button>
          </div>
        </div>

        {/* Onglets de statuts */}
        <div className="flex items-center gap-2 border-t border-slate-100 pt-3 overflow-x-auto">
          {FILTERS.map((f) => {
            const count = counts[f.id as keyof typeof counts];
            const isActive = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-emerald-950 hover:bg-slate-100'
                }`}
              >
                <span>{f.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : f.id === 'PENDING' && count > 0
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Liste des visites */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-500 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-800" />
          <p className="text-xs font-semibold">Chargement du registre des visites…</p>
        </div>
      ) : filteredVisits.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-12 text-center space-y-3">
          <CalendarClock className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="font-serif text-base font-bold text-slate-800">Aucune visite trouvée</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {search || filter !== 'ALL' || typeFilter !== 'ALL'
              ? 'Aucun rendez-vous ne correspond aux critères de filtre sélectionnés.'
              : 'Aucune demande de visite enregistrée pour le moment.'}
          </p>
          {(search || filter !== 'ALL' || typeFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setFilter('ALL');
                setTypeFilter('ALL');
              }}
              className="mt-2 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredVisits.map((vis) => {
            const statusCfg = STATUS_CONFIG[vis.status] || STATUS_CONFIG.PENDING;
            const StatusIcon = statusCfg.icon;
            const isBusy = busyId === vis.id;

            return (
              <div
                key={vis.id}
                className="rounded-2xl liquid-glass-card border border-white/60 shadow-sm p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all hover:border-slate-300/80"
              >
                {/* Informations de la visite */}
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                    >
                      <StatusIcon className="w-3.5 h-3.5" />
                      <span>{statusCfg.label}</span>
                    </span>

                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-medium">
                      {vis.visitType === 'VIRTUAL_3D' ? (
                        <>
                          <Video className="w-3 h-3 text-indigo-600" />
                          <span>Visio 3D</span>
                        </>
                      ) : (
                        <>
                          <Navigation className="w-3 h-3 text-emerald-700" />
                          <span>Sur site</span>
                        </>
                      )}
                    </span>

                    <span className="text-[11px] font-mono text-slate-400">ID: {vis.id.slice(0, 8)}</span>
                  </div>

                  {/* Titre du bien & Localisation */}
                  <div>
                    <h3 className="font-serif text-base font-bold text-emerald-950 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-emerald-800 shrink-0" />
                      <span className="truncate">{vis.propertyTitle}</span>
                    </h3>
                    {vis.commune && (
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{vis.commune}</span>
                      </p>
                    )}
                  </div>

                  {/* Coordonnées Client & Créneau */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-semibold text-slate-900">{vis.clientName || vis.userName || 'Client'}</span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <a
                        href={`tel:${vis.clientPhone}`}
                        className="font-mono text-emerald-800 hover:underline flex items-center gap-1"
                      >
                        <Phone className="w-3 h-3" />
                        <span>{vis.clientPhone}</span>
                      </a>
                    </div>

                    <div className="flex items-center gap-2">
                      <CalendarClock className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span className="font-bold text-slate-800">
                        {vis.scheduledDate || vis.visitDate}
                      </span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="font-medium text-slate-700">{vis.scheduledTime || vis.timeSlot}</span>
                    </div>
                  </div>

                  {vis.notes && (
                    <p className="text-xs text-slate-500 italic bg-slate-50/80 rounded-lg p-2 border border-slate-100">
                      « {vis.notes} »
                    </p>
                  )}
                </div>

                {/* Boutons d'actions & Confirmation */}
                <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                  {/* BOUTON CONFIRMER LA VISITE (Action Principale demandée) */}
                  {vis.status !== 'CONFIRMED' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleUpdateStatus(vis.id, 'CONFIRMED')}
                      className="px-3.5 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                      title="Confirmer cette visite client"
                    >
                      {isBusy ? (
                        <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-amber-300" />
                      )}
                      <span>Confirmer la visite</span>
                    </button>
                  )}

                  {/* BOUTON WHATSAPP AVEC MESSAGE OFFICIEL PRÉ-REMPLI */}
                  <a
                    href={getWhatsAppConfirmationUrl(vis)}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    title="Envoyer confirmation officielle via WhatsApp"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp Client</span>
                    <ExternalLink className="w-3 h-3 opacity-80" />
                  </a>

                  {/* BOUTON MARQUER EFFECTUÉE */}
                  {vis.status === 'CONFIRMED' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleUpdateStatus(vis.id, 'COMPLETED')}
                      className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      title="Marquer la visite comme effectuée après passage du client"
                    >
                      <CheckCheck className="w-3.5 h-3.5 text-blue-700" />
                      <span>Marquer effectuée</span>
                    </button>
                  )}

                  {/* BOUTON ANNULER */}
                  {vis.status !== 'CANCELLED' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        if (window.confirm('Voulez-vous vraiment annuler cette visite ?')) {
                          handleUpdateStatus(vis.id, 'CANCELLED');
                        }
                      }}
                      className="px-2.5 py-2 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-700 border border-slate-200 hover:border-rose-200 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                      title="Annuler la visite"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleDeleteVisit(vis)}
                    className="px-2.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    title="Supprimer définitivement cette demande"
                  >
                    {isBusy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    <span>Supprimer</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
