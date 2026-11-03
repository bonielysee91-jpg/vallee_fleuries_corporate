import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore.ts';
import { api } from '../../services/api.ts';
import { Search, MapPin, Building, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';
import { RentalCategory, City } from '../../types/index.ts';
import { VFC_MEDIA } from '../../constants/media.ts';

export const HeroSection: React.FC = () => {
  const { setFilters, setView } = useAppStore();
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
      maxPrice: budgetMax === 'ALL' ? 15000000 : Number(budgetMax)
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
            <span>L'Excellence Locative Ivoirienne · Baux Certifiés & Résidences Meublées</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white font-serif tracking-tight leading-[1.12] text-balance">
            La référence absolue de la location de prestige à Abidjan.
          </h1>

          <p className="text-sm sm:text-base text-slate-200/90 font-normal max-w-2xl mx-auto leading-relaxed">
            Résidences diplomatiques à Cocody, penthouses d'affaires au Plateau, duplex contemporains en Zone 4 et villas pieds dans l'eau à Assinie.
          </p>
        </div>

        {/* Liquid Glass Dynamic Multi-Filter Bar */}
        <div className="max-w-4xl mx-auto liquid-glass rounded-2xl p-4 sm:p-5 shadow-2xl border border-white/40">
          
          {/* Strictly Rental Formulas Tabs */}
          <div className="flex items-center justify-center gap-2 mb-4 overflow-x-auto pb-1">
            {[
              { id: 'ALL', label: 'Toutes les Locations' },
              { id: 'LONG_TERM_RENT', label: 'Location Longue Durée (Bail 1 an+)' },
              { id: 'SHORT_TERM_FURNISHED', label: 'Résidences Meublées (Séjours Courts)' },
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
                Type de bien locatif
              </label>
              <div className="flex items-center gap-2 mt-0.5">
                <Building className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <select
                  className="w-full bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                  onChange={(e) => useAppStore.getState().setFilters({ propertyType: e.target.value as any })}
                >
                  <option value="ALL">Tous types</option>
                  <option value="VILLA">Villa de Standing</option>
                  <option value="PENTHOUSE">Penthouse Panoramique</option>
                  <option value="DUPLEX">Duplex Familial</option>
                  <option value="APARTMENT">Appartement Exécutif</option>
                  <option value="STUDIO">Studio Meublé</option>
                  <option value="COMMERCIAL">Bureaux Corporate</option>
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
                  <option value="300000">Jusqu'à 300 000 FCFA</option>
                  <option value="750000">Jusqu'à 750 000 FCFA</option>
                  <option value="1500000">Jusqu'à 1 500 000 FCFA</option>
                  <option value="3000000">Jusqu'à 3 000 000 FCFA</option>
                  <option value="6000000">Jusqu'à 6 000 000 FCFA</option>
                  <option value="10000000">Plus de 10 000 000 FCFA</option>
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

        {/* Reassuring Pillars Under Search */}
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs text-slate-200/85">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Loi N° 2019-576 : 2 mois avance + 2 mois caution</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Paiements Sécurisés Wave & Orange Money</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Baux d'Habitation & Quittances Numérisées</span>
          </div>
        </div>

      </div>

    </section>
  );
};
