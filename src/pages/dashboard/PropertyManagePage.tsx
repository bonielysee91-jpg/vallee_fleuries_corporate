import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore.ts';
import { api, formatFcfa } from '../../services/api.ts';
import { Property, PropertyStatus } from '../../types/index.ts';
import {
  Building2,
  Eye,
  Loader2,
  MapPin,
  Plus,
  Search,
  Wallet
} from 'lucide-react';

const STATUS_OPTIONS: { value: PropertyStatus; label: string; className: string }[] = [
  { value: 'AVAILABLE', label: 'Disponible', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'PUBLISHED', label: 'Publié', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { value: 'RESERVED', label: 'Réservé', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'OCCUPIED', label: 'Occupé', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  { value: 'RENTED', label: 'Loué', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { value: 'UNDER_MAINTENANCE', label: 'En maintenance', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  { value: 'PENDING_REVIEW', label: 'En attente de validation', className: 'bg-orange-50 text-orange-700 border-orange-200' }
];

const CATEGORY_LABELS: Record<Property['category'], string> = {
  SALE: 'Vente',
  LONG_TERM_RENT: 'Location longue durée',
  SHORT_TERM_FURNISHED: 'Location'
};

const categoryLabel = (category: Property['category']): string =>
  CATEGORY_LABELS[category] ?? category;

const statusMeta = (status: PropertyStatus) =>
  STATUS_OPTIONS.find((option) => option.value === status) ?? {
    value: status,
    label: status,
    className: 'bg-slate-100 text-slate-600 border-slate-200'
  };

/** `/dashboard/properties/manage` — table CRUD des biens du propriétaire. */
export const PropertyManagePage: React.FC = () => {
  const addNotification = useAppStore((state) => state.addNotification);

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .getProperties()
      .then((data) => {
        if (active) setProperties(data);
      })
      .catch((err) => {
        addNotification(
          err instanceof Error ? err.message : 'Chargement des biens impossible',
          'error'
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [addNotification]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return properties;
    return properties.filter(
      (prop) =>
        prop.title.toLowerCase().includes(query) ||
        prop.commune.toLowerCase().includes(query) ||
        prop.neighborhood.toLowerCase().includes(query)
    );
  }, [properties, search]);

  const totalRentFcfa = useMemo(
    () => properties.reduce((sum, prop) => sum + (prop.priceFcfa || 0), 0),
    [properties]
  );
  const publishedCount = useMemo(
    () => properties.filter((prop) => prop.status === 'PUBLISHED').length,
    [properties]
  );

  const handleStatusChange = async (property: Property, next: PropertyStatus) => {
    if (next === property.status) return;
    const previous = properties;
    setProperties((prev) =>
      prev.map((item) => (item.id === property.id ? { ...item, status: next } : item))
    );
    setUpdatingId(property.id);
    try {
      const updated = await api.updatePropertyStatus(property.id, next);
      setProperties((prev) =>
        prev.map((item) => (item.id === property.id ? { ...item, ...updated } : item))
      );
      addNotification('Statut du bien mis à jour', 'success');
    } catch (err) {
      setProperties(previous);
      addNotification(
        err instanceof Error ? err.message : 'Mise à jour du statut impossible',
        'error'
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const priceSuffix = (category: Property['category']) =>
    category === 'SALE' ? '' : '/ mois';

  const inputClass =
    'w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#D97706]';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-emerald-950">Gestion de mes biens</h1>
          <p className="text-xs text-slate-500 mt-1">
            Suivez l'état de votre portefeuille locatif et publiez de nouvelles annonces.
          </p>
        </div>
        <Link
          to="/dashboard/properties/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-semibold shadow-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          Publier un nouveau bien
        </Link>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="liquid-glass-card rounded-2xl border border-white/60 shadow-sm p-4">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <Building2 className="w-3.5 h-3.5 text-emerald-700" />
            Total biens
          </span>
          <p className="mt-1 text-lg font-bold text-emerald-950 font-mono tabular-nums">
            {properties.length}
          </p>
        </div>
        <div className="liquid-glass-card rounded-2xl border border-white/60 shadow-sm p-4">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <Wallet className="w-3.5 h-3.5 text-amber-600" />
            Loyers cumulés
          </span>
          <p className="mt-1 text-lg font-bold text-emerald-950 font-mono tabular-nums">
            {formatFcfa(totalRentFcfa)}
          </p>
        </div>
        <div className="liquid-glass-card rounded-2xl border border-white/60 shadow-sm p-4">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <Eye className="w-3.5 h-3.5 text-emerald-700" />
            Publiés
          </span>
          <p className="mt-1 text-lg font-bold text-emerald-950 font-mono tabular-nums">
            {publishedCount}
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par titre, commune ou quartier…"
          className={`${inputClass} pl-9`}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-xs text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />
          Chargement de vos biens…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <Building2 className="w-8 h-8 mx-auto text-slate-300" />
          <h2 className="mt-3 font-serif text-lg font-bold text-emerald-950">
            {properties.length === 0 ? 'Aucun bien publié' : 'Aucun bien ne correspond'}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {properties.length === 0
              ? 'Publiez votre première annonce pour la voir apparaître ici.'
              : 'Ajustez votre recherche pour retrouver vos biens.'}
          </p>
        </div>
      ) : (
        <>
          <div className="hidden md:block overflow-hidden rounded-2xl bg-white border border-slate-200">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Visuel</th>
                  <th className="px-4 py-3">Typologie</th>
                  <th className="px-4 py-3">Catégorie</th>
                  <th className="px-4 py-3">Loyer</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((prop) => {
                  const meta = statusMeta(prop.status);
                  return (
                    <tr key={prop.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {prop.featuredImage ? (
                            <img
                              src={prop.featuredImage}
                              alt={prop.title}
                              className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                            />
                          ) : (
                            <span className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                              <Building2 className="w-5 h-5 text-slate-400" />
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-emerald-950 truncate">{prop.title}</p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {prop.commune} · {prop.neighborhood}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <span className="block font-semibold text-slate-700">{prop.type}</span>
                        <span className="block text-[11px] text-slate-500">{prop.furnishing}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{categoryLabel(prop.category)}</td>
                      <td className="px-4 py-3">
                        <span className="block text-xs font-bold text-emerald-950 font-mono tabular-nums">
                          {formatFcfa(prop.priceFcfa)}
                        </span>
                        <span className="block text-[11px] text-slate-500">
                          {priceSuffix(prop.category)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-semibold ${meta.className}`}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <select
                            value={prop.status}
                            disabled={updatingId === prop.id}
                            onChange={(e) =>
                              handleStatusChange(prop, e.target.value as PropertyStatus)
                            }
                            className={`${inputClass} w-auto disabled:opacity-50`}
                          >
                            {STATUS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <Link
                            to={`/properties/${prop.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Aperçu
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="md:hidden space-y-3">
            {filtered.map((prop) => {
              const meta = statusMeta(prop.status);
              return (
                <li
                  key={prop.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-start gap-3">
                    {prop.featuredImage ? (
                      <img
                        src={prop.featuredImage}
                        alt={prop.title}
                        className="w-14 h-14 rounded-xl object-cover border border-slate-200"
                      />
                    ) : (
                      <span className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-slate-400" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-emerald-950">{prop.title}</p>
                      <p className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                        <MapPin className="w-3 h-3" />
                        {prop.commune} · {prop.neighborhood}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-semibold ${meta.className}`}
                    >
                      {meta.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">
                      {prop.type} · {categoryLabel(prop.category)}
                    </span>
                    <span className="font-bold text-emerald-950 font-mono tabular-nums">
                      {formatFcfa(prop.priceFcfa)}{' '}
                      <span className="text-[11px] font-normal text-slate-500">
                        {priceSuffix(prop.category)}
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={prop.status}
                      disabled={updatingId === prop.id}
                      onChange={(e) => handleStatusChange(prop, e.target.value as PropertyStatus)}
                      className={`${inputClass} flex-1 disabled:opacity-50`}
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <Link
                      to={`/properties/${prop.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Aperçu
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
};
