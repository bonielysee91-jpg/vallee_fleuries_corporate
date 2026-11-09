import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore.ts';
import { api } from '../../services/api.ts';
import { City } from '../../types/index.ts';
import { VFC_MEDIA } from '../../constants/media.ts';
import { MapPin, ArrowUpRight, Loader2 } from 'lucide-react';

/**
 * Featured Ivorian hubs. No geography is hardcoded: the cities, communes and
 * neighbourhoods rendered here all come from the Neon cloud database, and only
 * the decorative cover art is resolved locally from the CDN catalogue.
 */
const HUB_IMAGES = [
  VFC_MEDIA.modernVilla,
  VFC_MEDIA.penthouseView,
  VFC_MEDIA.beachResidence,
  VFC_MEDIA.duplexFacade,
];

export const NeighborhoodsSection: React.FC = () => {
  const { setFilters, setView } = useAppStore();
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .getGeography()
      .then((data) => {
        if (!cancelled) setCities(data);
      })
      .catch(() => {
        if (!cancelled) setCities([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectCity = (city: string) => {
    setFilters({ city, commune: 'ALL' });
    setView('properties');
  };

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-200/60">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 block mb-2">
            Géolocalisation & Pôles de Prestige
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-emerald-950 font-serif">
            Les pôles locatifs de Côte d'Ivoire.
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-slate-500 max-w-md">
          Chaque pôle référencé garantit des résidences rigoureusement contrôlées avec gardiennage 24/7, commodités complètes et baux certifiés conformes.
        </p>
      </div>

      {loading ? (
        <div className="py-16 flex flex-col items-center text-slate-500">
          <Loader2 className="w-7 h-7 animate-spin text-emerald-800" />
          <p className="mt-3 text-xs">Chargement des pôles régionaux…</p>
        </div>
      ) : cities.length === 0 ? (
        <p className="py-16 text-center text-xs text-slate-500">
          Les pôles régionaux seront affichés dès que la base cloud sera synchronisée.
        </p>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cities.map((city, idx) => (
          <div
            key={city.id}
            onClick={() => handleSelectCity(city.name)}
            className="group relative rounded-2xl overflow-hidden shadow-lg border border-white/60 cursor-pointer h-96 flex flex-col justify-end p-5 transition-transform duration-300 hover:-translate-y-1"
          >
            {/* Background Image with Scrim */}
            <img
              src={HUB_IMAGES[idx % HUB_IMAGES.length]}
              alt={city.name}
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#022C22] via-[#022C22]/50 to-transparent" />

            {/* Content Card */}
            <div className="relative z-10 space-y-2 text-white">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300">
                  <MapPin className="w-3 h-3 text-amber-400" />
                  <span>{city.region}</span>
                </span>
                <span className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white group-hover:bg-amber-500 transition-colors">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </div>

              <h3 className="text-base font-bold font-serif leading-snug">
                {city.name}
              </h3>

              <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                {city.description || `Locations longue durée et biens vérifiés à ${city.name}.`}
              </p>

              <div className="pt-2 border-t border-white/15 flex flex-wrap gap-1">
                {city.communes.slice(0, 4).map((commune) => (
                  <span
                    key={commune.id}
                    className="px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-medium text-slate-200"
                  >
                    {commune.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      )}
    </section>
  );
};
