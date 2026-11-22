import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore.ts';
import { useShallow } from 'zustand/react/shallow';
import { api } from '../../services/api.ts';
import { Search, MapPin, Building, Sparkles } from 'lucide-react';
import { RentalCategory, City } from '../../types/index.ts';
import { VFC_MEDIA } from '../../constants/media.ts';
import { PROPERTY_TYPE_OPTIONS } from '../../constants/property.ts';

export const HeroSection: React.FC = () => {
  const { setFilters, setView } = useAppStore(useShallow((s) => ({
    setFilters: s.setFilters,
    setView: s.setView,
  })));
  const [category, setCategory] = useState<RentalCategory | 'ALL'>('ALL');
  const [commune, setCommune] = useState('ALL');
  const [budgetMax, setBudgetMax] = useState('ALL');
  const [cities, setCities] = useState<City[]>([]);

  // Communes are never hardcoded: they come straight from the Neon geography table.
  useEffect(() => {
    api.getGeography().then(setCities).catch(() => setCities([]));
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters({
      category,
      commune,
      maxPrice: budgetMax === 'ALL' ? undefined : Number(budgetMax)
    });
    setView('properties');
  };

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center pt-8 pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
      
      {/* Background Media with Contrast Scrim */}
      <div className="absolute inset-0 z-0">
        <img
          src={VFC_MEDIA.villaPool}
          alt="Propriété locative de prestige à Abidjan"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover scale-105 animate-pulse duration-[10000ms]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#022C22] via-emerald-950/60 to-black/40" />
      </div>

      {/* Main Content Box */}
      <div className="relative z-10 max-w-6xl w-full mx-auto text-center space-y-8">
        
        {/* Headline & Kicker */}
        <div className="space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full liquid-glass-dark text-amber-300 text-xs font-semibold tracking-wide border border-amber-400/20 shadow-lg">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Votre Projet Immobilier en Toute Confiance • Expertises & Opportunités Rares</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white font-serif tracking-tight leading-[1.12] text-balance">
            Trouvez la maison idéale, à l'achat ou à la location.
          </h1>
        </div>

        {/* Liquid Glass Dynamic Multi-Filter Bar */}
        <div className="max-w-4xl mx-auto liquid-glass rounded-2xl p-4 sm:p-5 shadow-2xl border border-white/40">
          
          {/* Offer Type Tabs: Vente & Location */}
          <div className="flex items-center justify-center gap-2 mb-4 overflow-x-auto pb-1">
            {[
              { id: 'ALL', label: 'Toutes les maisons' },
              { id: 'SALE', label: 'Vente' },
              { id: 'LONG_TERM_RENT', label: 'Location' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategory(tab.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  category === tab.id
                    ? 'bg-gradient-to-r from-emerald-950 to-emerald-900 text-amber-400 shadow-md border border-amber-400/30'
                    : 'text-slate-700 hover:text-emerald-900 hover:bg-white/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Form Controls */}
          <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            
            {/* Commune */}
            <div className="text-left bg-white/90 rounded-xl px-3.5 py-2.5 border border-slate-200/80">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Commune / Zone Abidjan
              </label>
              <div className="flex items-center gap-2 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <select
                  value={commune}
                  onChange={(e) => setCommune(e.target.value)}
                  className="w-full bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Toutes les Communes</option>
                  {cities.flatMap((city) =>
                    city.communes.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name} ({city.name})
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Property Type (NO Land parcels!) */}
            <div className="text-left bg-white/90 rounded-xl px-3.5 py-2.5 border border-slate-200/80">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Type de bien
              </label>
              <div className="flex items-center gap-2 mt-0.5">
                <Building className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <select
                  className="w-full bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                  onChange={(e) => useAppStore.getState().setFilters({ propertyType: e.target.value as any })}
                >
                  <option value="ALL">Tous types</option>
                  {PROPERTY_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Budget Max */}
            <div className="text-left bg-white/90 rounded-xl px-3.5 py-2.5 border border-slate-200/80">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Budget Plafond (FCFA)
              </label>
              <div className="flex items-center gap-2 mt-0.5">
                <select
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                  className="w-full bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Sans limite de budget</option>
                  <option value="500000">Jusqu'à 500 000 FCFA</option>
                  <option value="1500000">Jusqu'à 1 500 000 FCFA</option>
                  <option value="5000000">Jusqu'à 5 000 000 FCFA</option>
                  <option value="20000000">Jusqu'à 20 000 000 FCFA</option>
                  <option value="50000000">Jusqu'à 50 000 000 FCFA</option>
                  <option value="100000000">Jusqu'à 100 000 000 FCFA</option>
                  <option value="200000000">Jusqu'à 200 000 000 FCFA</option>
                </select>
              </div>
            </div>

            {/* Submit Action */}
            <button
              type="submit"
              className="h-full min-h-[46px] rounded-xl bg-gradient-to-r from-emerald-900 to-emerald-800 text-amber-400 text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/30 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer border border-amber-400/30"
            >
              <Search className="w-4 h-4" />
              <span>Consulter les Offres</span>
            </button>
          </form>

        </div>

      </div>
    </section>
  );
};
