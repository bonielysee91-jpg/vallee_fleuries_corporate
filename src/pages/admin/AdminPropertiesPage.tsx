import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore.ts';
import { api, formatFcfa } from '../../services/api.ts';
import { Property } from '../../types/index.ts';
import {
  AlertTriangle,
  Building2,
  Eye,
  Landmark,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2
} from 'lucide-react';

type StatusFilter = 'ALL' | Property['status'];

const STATUS_LABELS: Record<Property['status'], string> = {
  AVAILABLE: 'Disponible',
  OCCUPIED: 'Occupé',
  RESERVED: 'Réservé',
  UNDER_MAINTENANCE: 'Maintenance',
  PENDING_REVIEW: 'En attente',
  PUBLISHED: 'Publié',
  RENTED: 'Loué'
};

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'ALL', label: 'Tous' },
  { id: 'PENDING_REVIEW', label: 'En attente' },
  { id: 'PUBLISHED', label: 'Publiés' },
  { id: 'AVAILABLE', label: 'Disponibles' },
  { id: 'RESERVED', label: 'Réservés' },
  { id: 'UNDER_MAINTENANCE', label: 'Maintenance' }
];

const statusPillClass = (status: Property['status']): string => {
  if (status === 'PUBLISHED') return 'bg-emerald-100 text-emerald-800';
  if (status === 'AVAILABLE') return 'bg-sky-100 text-sky-800';
  if (status === 'RESERVED') return 'bg-amber-100 text-amber-800';
  if (status === 'UNDER_MAINTENANCE') return 'bg-rose-100 text-rose-700';
  if (status === 'RENTED' || status === 'OCCUPIED') return 'bg-slate-200 text-slate-700';
  return 'bg-slate-100 text-slate-600';
};

/**
 * `/admin/properties` — registre complet du parc immobilier.
 * Permet à la Direction d'ajouter, modifier, réinitialiser et supprimer des biens.
 * La création/édition réutilise le wizard existant (`/dashboard/properties/new`),
 * afin d'éviter tout composant en double.
 */
export const AdminPropertiesPage: React.FC = () => {
  const addNotification = useAppStore((state) => state.addNotification);

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = React.useCallback(
    () =>
      api
        .adminGetProperties()
        .then((data) => {
          setProperties(data ?? []);
          setError(null);
        })
        .catch((err: any) => {
          const message = err?.message || 'Chargement du parc immobilier impossible';
          setError(message);
          addNotification(message, 'error');
        })
        .finally(() => setLoading(false)),
    [addNotification]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void load().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const handleReset = async (prop: Property) => {
    const confirmed = window.confirm(
      `Réinitialiser « ${prop.title} » ?\n\n` +
        'Le bien repassera en « En attente de validation » et quittera le catalogue public ' +
        "jusqu'à revalidation. Aucune donnée n'est supprimée."
    );
    if (!confirmed) return;

    setBusyId(prop.id);
    try {
      const updated = await api.adminResetProperty(prop.id);
      setProperties((prev) => prev.map((item) => (item.id === prop.id ? updated : item)));
      addNotification(`Bien réinitialisé : ${updated.title}`, 'success');
    } catch (err: any) {
      addNotification(err?.message || 'Réinitialisation impossible', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (prop: Property) => {
    const confirmed = window.confirm(
      `Supprimer définitivement « ${prop.title} » ?\n\n` +
        'Cette action est irréversible. Elle est refusée si le bien possède des réservations, ' +
        'des baux ou des demandes de visite (préservation de l’historique juridique).'
    );
    if (!confirmed) return;

    setBusyId(prop.id);
    try {
      await api.deleteProperty(prop.id);
      setProperties((prev) => prev.filter((item) => item.id !== prop.id));
      addNotification(`Bien supprimé : ${prop.title}`, 'success');
    } catch (err: any) {
      addNotification(err?.message || 'Suppression impossible', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    properties.forEach((item) => {
      map[item.status] = (map[item.status] ?? 0) + 1;
    });
    return map;
  }, [properties]);

  const term = search.trim().toLowerCase();
  const visible = properties.filter((item) => {
    if (filter !== 'ALL' && item.status !== filter) return false;
    if (!term) return true;
    return (
      item.title.toLowerCase().includes(term) ||
      item.commune.toLowerCase().includes(term) ||
      (item.neighborhood?.toLowerCase().includes(term) ?? false)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-800 block">
            Portefeuille locatif — Direction Abidjan
          </span>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-emerald-950 mt-1">
            Biens &amp; Annonces
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Ajoutez, modifiez, réinitialisez ou retirez les biens du parc immobilier.
          </p>
        </div>
        <Link
          to="/dashboard/properties/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-bold shadow-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          Ajouter une maison
        </Link>
      </header>

      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600">
        <span className="px-3 py-1.5 rounded-xl bg-white border border-slate-200">
          {properties.length} bien{properties.length > 1 ? 's' : ''} au total
        </span>
        {(['PENDING_REVIEW', 'PUBLISHED', 'AVAILABLE', 'RESERVED'] as Property['status'][])
          .filter((status) => (counts[status] ?? 0) > 0)
          .map((status) => (
            <span key={status} className={`px-3 py-1.5 rounded-xl ${statusPillClass(status)}`}>
              {STATUS_LABELS[status]} : {counts[status]}
            </span>
          ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                filter === item.id
                  ? 'bg-emerald-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
              {item.id !== 'ALL' && counts[item.id] ? ` (${counts[item.id]})` : ''}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un titre, une commune…"
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#D97706]"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex flex-col items-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-800" />
          <p className="mt-3 text-xs">Chargement du parc immobilier…</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-white border border-amber-200 shadow-sm p-8 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-700">{error}</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-4 border border-emerald-100">
            <Landmark className="w-7 h-7" />
          </div>
          <h2 className="font-serif text-lg font-bold text-emerald-950">Aucun bien à afficher</h2>
          <p className="text-xs text-slate-600 mt-2">
            {term || filter !== 'ALL'
              ? 'Aucun bien ne correspond à ce filtre.'
              : 'Le parc est vide : commencez par ajouter une maison.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((prop) => {
            const perLabel = prop.category === 'SALE' ? '' : '/ mois';
            const isBusy = busyId === prop.id;
            return (
              <article
                key={prop.id}
                className="rounded-2xl liquid-glass-card border border-white/60 shadow-sm p-5"
              >
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  {prop.featuredImage ? (
                    <img
                      src={prop.featuredImage}
                      alt={prop.title}
                      referrerPolicy="no-referrer"
                      className="w-full md:w-24 h-40 md:h-24 rounded-xl object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-full md:w-24 h-40 md:h-24 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <Building2 className="w-7 h-7" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-serif text-base font-bold text-emerald-950">{prop.title}</h3>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${statusPillClass(prop.status)}`}
                      >
                        {STATUS_LABELS[prop.status]}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Landmark className="w-3.5 h-3.5 text-emerald-700" />
                        <span className="font-bold text-emerald-800">
                          {prop.category === 'SALE' ? 'Vente' : 'Location longue durée'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{prop.furnishing === 'FULLY_FURNISHED' ? 'Équipé' : 'Non équipé'}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                        {prop.commune} ({prop.neighborhood})
                      </span>
                      <span className="font-mono tabular-nums font-bold text-emerald-900">
                        {formatFcfa(prop.priceFcfa)} {perLabel}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2">{prop.description}</p>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Link
                        to={`/dashboard/properties/${prop.id}/edit`}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-semibold shadow-md transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Modifier
                      </Link>
                      <button
                        type="button"
                        disabled={isBusy || prop.status === 'PENDING_REVIEW'}
                        onClick={() => handleReset(prop)}
                        title={
                          prop.status === 'PENDING_REVIEW'
                            ? 'Déjà en attente de validation'
                            : 'Renvoyer en file de modération'
                        }
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        Réinitialiser
                      </button>
                      <Link
                        to={`/properties/${prop.id}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-emerald-800 text-xs font-semibold transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Inspecter
                      </Link>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDelete(prop)}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-md disabled:opacity-50 transition-colors"
                      >
                        {isBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
