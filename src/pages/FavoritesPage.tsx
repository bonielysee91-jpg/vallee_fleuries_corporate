import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore.ts';
import { api, formatFcfa } from '../services/api.ts';
import { Property } from '../types/index.ts';
import { FALLBACK_PROPERTY_IMAGE, optimizedImageUrl } from '../constants/media.ts';
import { Heart, MapPin, Bed, Bath, Maximize, ArrowRight, Loader2, Compass } from 'lucide-react';

/** Saved properties list — `/favorites` (clients, owners, admins). */
export const FavoritesPage: React.FC = () => {
  const favorites = useAppStore((state) => state.favorites);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const setView = useAppStore((state) => state.setView);

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .getProperties()
      .then((data) => {
        if (!cancelled) setProperties(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const saved = properties.filter((property) => favorites.includes(property.id));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900">
            Ma sélection privée
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {saved.length} bien{saved.length > 1 ? 's' : ''} sauvegardé{saved.length > 1 ? 's' : ''} ·
            synchronisé avec votre compte Vallées Fleuries
          </p>
        </div>
        <button
          onClick={() => setView('properties')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-900 text-amber-400 text-xs font-bold hover:bg-emerald-800 transition-colors"
        >
          <Compass className="w-4 h-4" />
          Explorer le catalogue
        </button>
      </header>

      {loading ? (
        <div className="py-20 flex flex-col items-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-800" />
          <p className="mt-3 text-xs">Chargement de votre sélection…</p>
        </div>
      ) : saved.length === 0 ? (
        <div className="liquid-glass-card rounded-3xl p-10 text-center border border-white/60">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-4 border border-rose-100">
            <Heart className="w-7 h-7" />
          </div>
          <h2 className="font-serif text-lg font-bold text-slate-900">Aucun favori pour le moment</h2>
          <p className="text-xs text-slate-500 mt-2 mb-6">
            Ajoutez des biens depuis le catalogue : ils apparaîtront ici, sur tous vos appareils.
          </p>
          <button
            onClick={() => setView('properties')}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-900 to-emerald-800 text-amber-400 text-xs font-bold"
          >
            Découvrir les locations
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {saved.map((property) => (
            <article
              key={property.id}
              className="liquid-glass-card rounded-3xl overflow-hidden border border-white/60 flex flex-col"
            >
              <div className="relative h-44 bg-slate-100">
                <img
                  src={
                    optimizedImageUrl(
                      property.coverImage || property.featuredImage || property.images?.[0]?.url,
                      600
                    ) || FALLBACK_PROPERTY_IMAGE
                  }
                  alt={property.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <button
                  onClick={() => toggleFavorite(property.id)}
                  className="absolute top-3 right-3 p-2 rounded-xl bg-white/90 backdrop-blur border border-white/70 text-rose-500 hover:scale-105 transition-transform"
                  aria-label="Retirer des favoris"
                >
                  <Heart className="w-4 h-4 fill-rose-500" />
                </button>
                <span className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-emerald-950/85 text-amber-300 text-[10px] font-bold uppercase tracking-wide">
                  {property.category === 'SALE' ? 'Vente' : 'Location longue durée'}
                </span>
              </div>

              <div className="p-4 flex-1 flex flex-col">
                <h3 className="font-serif text-base font-bold text-slate-900 line-clamp-1">
                  {property.title}
                </h3>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                  <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                  {property.commune} · {property.neighborhood}
                </p>

                <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-600">
                  <span className="flex items-center gap-1">
                    <Bed className="w-3.5 h-3.5" /> {property.bedrooms}
                  </span>
                  <span className="flex items-center gap-1">
                    <Bath className="w-3.5 h-3.5" /> {property.bathrooms}
                  </span>
                  <span className="flex items-center gap-1">
                    <Maximize className="w-3.5 h-3.5" /> {property.surfaceM2} m²
                  </span>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="font-serif text-lg font-bold text-emerald-900">
                      {formatFcfa(property.priceFcfa, 'FCFA')}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {property.category === 'SALE' ? 'prix total' : 'par mois'}
                    </p>
                  </div>
                  <Link
                    to={`/properties/${property.id}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-[11px] font-bold hover:bg-slate-800 transition-colors"
                  >
                    Voir
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
