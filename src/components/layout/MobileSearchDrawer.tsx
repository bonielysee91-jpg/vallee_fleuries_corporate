import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore.ts';
import { api } from '../../services/api.ts';
import { X, Search, SlidersHorizontal, MapPin, Building, KeyRound, Check } from 'lucide-react';
import { PropertyType } from '../../types/index.ts';
import { PROPERTY_TYPE_OPTIONS } from '../../constants/property.ts';

export const MobileSearchDrawer: React.FC = () => {
  const { 
    isMobileSearchOpen, 
    closeMobileSearch, 
    filters, 
    setFilters, 
    resetFilters,
    setView 
  } = useAppStore();

  const [communes, setCommunes] = useState<string[]>(['ALL']);

  // Communes are served by the Neon geography tables — never hardcoded here.
  useEffect(() => {
    api
      .getGeography()
      .then((cities) =>
        setCommunes(['ALL', ...cities.flatMap((city) => city.communes.map((c) => c.name))])
      )
      .catch(() => setCommunes(['ALL']));
  }, []);

  if (!isMobileSearchOpen) return null;

  const TYPES: { value: PropertyType | 'ALL'; label: string }[] = [
    { value: 'ALL', label: 'Tous types' },
    ...PROPERTY_TYPE_OPTIONS
  ];

  const handleApply = () => {
    closeMobileSearch();
    setView('properties');
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="flex-1" onClick={closeMobileSearch} />

      {/* Sliding Sheet from Bottom */}
      <div className="w-full max-h-[85vh] bg-white rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
        
        {/* Drawer Header */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">Recherche Locative</h2>
              <p className="text-[11px] text-slate-500">Filtres rapides au pouce</p>
            </div>
          </div>
          
          <button
            onClick={closeMobileSearch}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Filter Controls */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          
          {/* 1. Offer Type Toggle (Vente & Location) */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-2">
              Type d'Offre
            </label>
            <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setFilters({ category: 'ALL' })}
                className={`py-2.5 px-3 rounded-lg text-xs font-bold transition-all ${
                  filters.category === 'ALL'
                    ? 'bg-emerald-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tous
              </button>
              <button
                onClick={() => setFilters({ category: 'SALE' })}
                className={`py-2.5 px-3 rounded-lg text-xs font-bold transition-all ${
                  filters.category === 'SALE'
                    ? 'bg-emerald-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                À Vendre
              </button>
              <button
                onClick={() => setFilters({ category: 'LONG_TERM_RENT' })}
                className={`py-2.5 px-3 rounded-lg text-xs font-bold transition-all ${
                  filters.category === 'LONG_TERM_RENT'
                    ? 'bg-emerald-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                À Louer
              </button>
            </div>
          </div>

          {/* 2. Commune Selector */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-2">
              Commune / Zone Abidjan
            </label>
            <div className="flex flex-wrap gap-1.5">
              {communes.map((commune) => (
                <button
                  key={commune}
                  onClick={() => setFilters({ commune })}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    (filters.commune || 'ALL') === commune
                      ? 'bg-amber-500 text-white font-bold shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {commune === 'ALL' ? 'Toutes les zones' : commune}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Property Type */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-2">
              Type de bien
            </label>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setFilters({ type: t.value, propertyType: t.value })}
                  className={`py-2 px-2 rounded-xl text-xs font-medium border text-center transition-all ${
                    (filters.type || 'ALL') === t.value
                      ? 'border-emerald-700 bg-emerald-50 text-emerald-950 font-bold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Budget Range */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Loyer Max (FCFA)
              </label>
              <span className="text-xs font-bold text-emerald-900">
                {((filters.maxPrice || 10000000)).toLocaleString('fr-FR')} FCFA
              </span>
            </div>
            <input
              type="range"
              min={100000}
              max={10000000}
              step={100000}
              value={filters.maxPrice || 10000000}
              onChange={(e) => setFilters({ maxPrice: Number(e.target.value) })}
              className="w-full accent-emerald-800 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>100 000 FCFA</span>
              <span>10 000 000 FCFA</span>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center gap-3">
          <button
            onClick={resetFilters}
            className="px-4 py-3 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors"
          >
            Réinitialiser
          </button>

          <button
            onClick={handleApply}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-900 to-emerald-800 text-amber-400 text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/20 active:scale-95 transition-all"
          >
            <Check className="w-4 h-4" />
            <span>Appliquer les Filtres</span>
          </button>
        </div>

      </div>
    </div>
  );
};
