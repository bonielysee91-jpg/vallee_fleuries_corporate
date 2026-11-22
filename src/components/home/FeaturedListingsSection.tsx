import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore.ts';
import { useShallow } from 'zustand/react/shallow';
import { api, formatFcfa } from '../../services/api.ts';
import { Property } from '../../types/index.ts';
import { optimizedImageUrl } from '../../constants/media.ts';
import { Heart, Zap, Droplets, Shield, Bed, Bath, Maximize, ArrowRight, Eye } from 'lucide-react';

export const FeaturedListingsSection: React.FC = () => {
  const { setView, setSelectedPropertyId, favorites, toggleFavorite, openVisitModal } =
    useAppStore(useShallow((s) => ({
      setView: s.setView,
      setSelectedPropertyId: s.setSelectedPropertyId,
      favorites: s.favorites,
      toggleFavorite: s.toggleFavorite,
      openVisitModal: s.openVisitModal,
    })));
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getProperties({ available: true }).then((data) => {
      setProperties(data.slice(0, 4));
      setLoading(false);
    });
  }, []);

  const handleOpenDetail = (propId: string) => {
    setSelectedPropertyId(propId);
    setView('property-detail', propId);
  };

  const handleScheduleVisit = (e: React.MouseEvent, propId: string) => {
    e.stopPropagation();
    setSelectedPropertyId(propId);
    openVisitModal();
  };

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 block mb-2">
            Collection Exclusive Vallées Fleuries Corporate
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-emerald-950 font-serif">
            Biens d'exception actuellement disponibles.
          </h2>
        </div>

        <button
          onClick={() => setView('properties')}
          className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800 hover:text-emerald-950 transition-colors cursor-pointer group"
        >
          <span>Consulter tout le catalogue</span>
          <ArrowRight className="w-4 h-4 text-amber-500 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[1, 2].map((i) => (
            <div key={i} className="h-96 rounded-2xl bg-slate-200 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {properties.map((prop) => {
            const isFav = favorites.includes(prop.id);
            return (
              <div
                key={prop.id}
                onClick={() => handleOpenDetail(prop.id)}
                className="liquid-glass-card rounded-2xl overflow-hidden cursor-pointer group flex flex-col justify-between"
              >
                {/* Image & Badges */}
                <div className="relative h-64 overflow-hidden">
                  <img
                    src={optimizedImageUrl(prop.featuredImage, 800)}
                    alt={prop.title}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

                  {/* Top Floating Controls */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-md bg-emerald-950/80 text-amber-300 text-[10px] font-bold tracking-wider uppercase backdrop-blur-md border border-white/10">
                      {prop.category === 'SALE' ? 'Vente' : 'Location Longue Durée'}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(prop.id);
                      }}
                      className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center text-slate-700 hover:text-rose-500 transition-colors shadow"
                    >
                      <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
                    </button>
                  </div>

                  {/* Bottom Image Strip */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-[11px]">
                    <div className="flex items-center gap-1.5 font-semibold text-emerald-300">
                      <Shield className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{prop.category === 'SALE' ? 'Acte Authentifié CI' : 'Location Vérifiée CI'}</span>
                    </div>

                    <div className="font-mono text-xs font-bold text-amber-300 bg-black/50 px-2 py-0.5 rounded backdrop-blur-sm">
                      {formatFcfa(prop.priceFcfa)}
                      {prop.category === 'LONG_TERM_RENT' ? '/mois' : ''}
                    </div>
                  </div>
                </div>

                {/* Content details */}
                <div className="p-6 space-y-4">
                  <div>
                    {/* Unboxed metadata with · discipline */}
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5">
                      <span>{prop.commune}</span>
                      <span aria-hidden="true">·</span>
                      <span>{prop.neighborhood}</span>
                      <span aria-hidden="true">·</span>
                      <span>{prop.surfaceM2} m²</span>
                    </div>

                    <h3 className="text-lg font-bold text-emerald-950 font-serif leading-snug group-hover:text-emerald-700 transition-colors">
                      {prop.title}
                    </h3>
                  </div>

                  {/* Structural & Utility specs */}
                  <div className="flex items-center justify-between text-xs text-slate-600 py-3 border-y border-slate-100">
                    {prop.bedrooms && (
                      <div className="flex items-center gap-1.5">
                        <Bed className="w-4 h-4 text-emerald-800" />
                        <span>{prop.bedrooms} ch.</span>
                      </div>
                    )}
                    {prop.bathrooms && (
                      <div className="flex items-center gap-1.5">
                        <Bath className="w-4 h-4 text-emerald-800" />
                        <span>{prop.bathrooms} sdb.</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Maximize className="w-4 h-4 text-emerald-800" />
                      <span>{prop.surfaceM2} m²</span>
                    </div>
                    {prop.hasBackupGenerator && (
                      <div className="flex items-center gap-1 text-emerald-700 font-medium" title="Groupe électrogène">
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        <span className="hidden sm:inline">Groupe</span>
                      </div>
                    )}
                    {prop.hasWaterReserve && (
                      <div className="flex items-center gap-1 text-emerald-700 font-medium" title="Cuve à eau & surpresseur">
                        <Droplets className="w-3.5 h-3.5 text-cyan-500" />
                        <span className="hidden sm:inline">Cuve Eau</span>
                      </div>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-semibold text-emerald-900 group-hover:underline flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" />
                      <span>Fiche complète & Visite 3D</span>
                    </span>

                    <button
                      onClick={(e) => handleScheduleVisit(e, prop.id)}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Planifier Visite
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
