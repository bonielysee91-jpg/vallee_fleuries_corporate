import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore.ts';
import { api, formatFcfa } from '../../services/api.ts';
import { Property, FilterState } from '../../types/index.ts';
import { FALLBACK_PROPERTY_IMAGE } from '../../constants/media.ts';
import { 
  Search, SlidersHorizontal, MapPin, Zap, Droplets, Shield, 
  Bed, Bath, Maximize, Heart, ArrowUpRight, Compass, Layers, Check, Phone
} from 'lucide-react';
import { VFC_WHATSAPP_NUMBER, VFC_WHATSAPP_DISPLAY } from '../../constants/contact.ts';

export const PropertyExplorer: React.FC = () => {
  const { filters, setFilters, resetFilters, setSelectedPropertyId, setView, favorites, toggleFavorite, openVisitModal } = useAppStore();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeHoveredId, setActiveHoveredId] = useState<string | null>(null);
  const [selectedMapPin, setSelectedMapPin] = useState<Property | null>(null);
  const [mapZoom, setMapZoom] = useState(1);
  const [mapCenter, setMapCenter] = useState({ lat: 5.34, lng: -3.98 });

  useEffect(() => {
    setLoading(true);
    api.getProperties({ ...filters, available: true } as any).then((data) => {
      setProperties(data);
      if (data.length > 0 && !selectedMapPin) {
        setSelectedMapPin(data[0]);
      }
      setLoading(false);
    });
  }, [filters]);

  const handleSelectProperty = (prop: Property) => {
    setSelectedPropertyId(prop.id);
    setView('property-detail', prop.id);
  };

  return (
    <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Top Filter & Search Bar */}
      <div className="liquid-glass rounded-2xl p-4 mb-8 border border-white/60 shadow-lg">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Rechercher par mot-clé, commune (ex: Cocody, Plateau, Assinie)..."
              value={filters.searchQuery || ''}
              onChange={(e) => setFilters({ searchQuery: e.target.value })}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200/90 bg-white/80 focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          {/* Quick Segmented Categories */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0">
            {[
              { id: 'ALL', label: 'Toutes les maisons' },
              { id: 'SALE', label: 'À Vendre' },
              { id: 'LONG_TERM_RENT', label: 'À Louer' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilters({ category: tab.id as any })}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  filters.category === tab.id
                    ? 'bg-emerald-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Reset Filters */}
          <button
            onClick={resetFilters}
            className="text-xs font-semibold text-slate-500 hover:text-emerald-800 transition-colors whitespace-nowrap"
          >
            Réinitialiser
          </button>
        </div>

        {/* Second Row: Specific Amenities Filters */}
        <div className="mt-3 pt-3 border-t border-slate-200/60 flex flex-wrap items-center gap-3 text-xs">
          <span className="font-semibold text-slate-500">Spécificités Abidjan :</span>
          
          <button
            onClick={() => setFilters({ hasBackupGenerator: !filters.hasBackupGenerator })}
            className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
              filters.hasBackupGenerator
                ? 'bg-emerald-100 text-emerald-900 border-emerald-400 font-bold'
                : 'border-slate-200 bg-white/70 text-slate-600'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Groupe Électrogène</span>
          </button>

          <button
            onClick={() => setFilters({ hasWaterReserve: !filters.hasWaterReserve })}
            className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
              filters.hasWaterReserve
                ? 'bg-emerald-100 text-emerald-900 border-emerald-400 font-bold'
                : 'border-slate-200 bg-white/70 text-slate-600'
            }`}
          >
            <Droplets className="w-3.5 h-3.5 text-cyan-600" />
            <span>Cuve d'eau + Surpresseur</span>
          </button>

          <button
            onClick={() => setFilters({ hasSecurity247: !filters.hasSecurity247 })}
            className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
              filters.hasSecurity247
                ? 'bg-emerald-100 text-emerald-900 border-emerald-400 font-bold'
                : 'border-slate-200 bg-white/70 text-slate-600'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-emerald-700" />
            <span>Sécurité 24/7</span>
          </button>

          <div className="ml-auto text-[11px] text-slate-500">
            {properties.length} bien(s) vérifié(s) disponible(s)
          </div>
        </div>
      </div>

      {/* Split View: Left List, Right Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Properties Grid */}
        <div className="lg:col-span-7 space-y-6">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-64 rounded-2xl bg-slate-200 animate-pulse" />
              ))}
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-16 liquid-glass rounded-2xl p-8 border border-white/60">
              <Compass className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900">Aucun bien ne correspond à ces critères</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Modifiez vos filtres ou réinitialisez la sélection pour explorer les autres secteurs d'Abidjan et de l'intérieur.
              </p>
              <button
                onClick={resetFilters}
                className="mt-4 px-4 py-2 rounded-xl bg-emerald-900 text-white text-xs font-semibold"
              >
                Réinitialiser la recherche
              </button>
            </div>
          ) : (
            properties.map((prop) => {
              const isFav = favorites.includes(prop.id);
              const isHovered = activeHoveredId === prop.id;

              return (
                <div
                  key={prop.id}
                  onMouseEnter={() => {
                    setActiveHoveredId(prop.id);
                    setSelectedMapPin(prop);
                  }}
                  onMouseLeave={() => setActiveHoveredId(null)}
                  onClick={() => handleSelectProperty(prop)}
                  className={`liquid-glass-card rounded-2xl overflow-hidden cursor-pointer flex flex-col sm:flex-row transition-all duration-300 ${
                    isHovered ? 'ring-2 ring-emerald-700 shadow-xl -translate-y-1' : ''
                  }`}
                >
                  {/* Property Image */}
                  <div className="relative sm:w-64 h-52 sm:h-auto shrink-0 overflow-hidden">
                    <img
                      src={prop.coverImage || prop.featuredImage || prop.images?.[0]?.url || FALLBACK_PROPERTY_IMAGE}
                      alt={prop.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent sm:hidden" />
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(prop.id);
                      }}
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center text-slate-700 hover:text-rose-500 transition-colors shadow"
                    >
                      <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
                    </button>

                    <div className="absolute bottom-3 left-3 px-2 py-0.5 rounded bg-emerald-950/80 text-amber-300 text-[10px] font-bold tracking-wider uppercase backdrop-blur-md">
                      {prop.category === 'SALE' ? 'Vente' : 'Location'}
                    </div>
                  </div>

                  {/* Property Info */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      {/* Unboxed metadata with · separator */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                        <span>{prop.commune}</span>
                        <span aria-hidden="true">·</span>
                        <span>{prop.neighborhood}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-emerald-800">
                          {prop.category === 'SALE' ? 'Vente Ferme' : 'Location Vérifiée'}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-emerald-950 font-serif leading-snug">
                        {prop.title}
                      </h3>

                      <p className="text-xs text-slate-600 line-clamp-2 mt-1.5 leading-relaxed">
                        {prop.description}
                      </p>
                    </div>

                    {/* Specifications row */}
                    <div className="flex items-center gap-4 text-xs text-slate-600 py-2 border-y border-slate-100">
                      {prop.bedrooms && (
                        <div className="flex items-center gap-1">
                          <Bed className="w-3.5 h-3.5 text-emerald-800" />
                          <span>{prop.bedrooms} ch.</span>
                        </div>
                      )}
                      {prop.bathrooms && (
                        <div className="flex items-center gap-1">
                          <Bath className="w-3.5 h-3.5 text-emerald-800" />
                          <span>{prop.bathrooms} sdb.</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Maximize className="w-3.5 h-3.5 text-emerald-800" />
                        <span>{prop.surfaceM2} m²</span>
                      </div>
                      {prop.hasBackupGenerator && (
                        <div className="flex items-center gap-1 text-emerald-700 font-medium">
                          <Zap className="w-3 h-3 text-amber-500" />
                          <span className="hidden sm:inline">Groupe</span>
                        </div>
                      )}
                    </div>

                    {/* Price and CTA */}
                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">
                          {prop.category === 'SALE' ? 'Prix de Vente' : 'Tarification'}
                        </span>
                        <span className="text-base font-black font-mono text-emerald-900 tabular-nums">
                          {formatFcfa(prop.priceFcfa)}
                          {prop.category === 'LONG_TERM_RENT' && (
                            <span className="text-xs font-normal text-slate-500"> / mois</span>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href={`tel:+${VFC_WHATSAPP_NUMBER}`}
                          onClick={(e) => e.stopPropagation()}
                          title={`Appeler l'agence : ${VFC_WHATSAPP_DISPLAY}`}
                          aria-label={`Appeler l'agence ${VFC_WHATSAPP_DISPLAY}`}
                          className="p-1.5 rounded-lg border border-emerald-200 text-emerald-800 hover:bg-emerald-50 transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPropertyId(prop.id);
                            openVisitModal();
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                        >
                          Visiter
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Interactive Map with Animated Emerald FCFA Markers */}
        <div className="lg:col-span-5 sticky top-28">
          <div className="liquid-glass rounded-3xl p-4 border border-white/60 shadow-2xl overflow-hidden space-y-4">
            
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/70 text-xs">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-emerald-800" />
                <span className="font-bold text-slate-800">Cartographie Immobilière Côte d'Ivoire</span>
              </div>
              <span className="text-[11px] text-emerald-800 font-medium bg-emerald-100 px-2 py-0.5 rounded">
                Abidjan & Régions
              </span>
            </div>

            {/* Simulated Vector / Interactive Styled Map of Abidjan */}
            <div className="relative w-full h-[540px] rounded-2xl bg-[#E8F0E8] overflow-hidden border border-slate-300/80 shadow-inner">
              
              {/* Map Lagoon & Coastline SVG styling */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 600 600" preserveAspectRatio="none">
                {/* Background Land */}
                <rect width="600" height="600" fill="#EDF4EC" />
                
                {/* Ebrié Lagoon (Deep emerald blue) */}
                <path
                  d="M0,320 Q120,290 200,340 T360,310 T480,360 T600,330 L600,420 Q480,450 350,400 T180,440 T0,400 Z"
                  fill="#BFE1DF"
                  opacity="0.95"
                />
                
                {/* Secondary lagoon arm (Cocody / Deux-Plateaux bay) */}
                <path
                  d="M200,340 Q230,220 260,180 T290,160 Q270,240 250,330 Z"
                  fill="#BFE1DF"
                  opacity="0.9"
                />

                {/* Suspension Bridge Pont Alassane Ouattara */}
                <line x1="230" y1="280" x2="280" y2="340" stroke="#F59E0B" strokeWidth="3" strokeDasharray="4 2" />
                {/* Henri Konan Bédié Bridge */}
                <line x1="330" y1="320" x2="350" y2="390" stroke="#047857" strokeWidth="2.5" />

                {/* Major Highway Corridors */}
                <path d="M50,150 Q250,160 550,130" stroke="#D1D5DB" strokeWidth="3" fill="none" />
                <path d="M260,130 L260,550" stroke="#D1D5DB" strokeWidth="3" fill="none" />
                <path d="M380,100 L380,550" stroke="#D1D5DB" strokeWidth="3" fill="none" />

                {/* Labels of Communes */}
                <text x="320" y="150" fill="#064E3B" fontSize="13" fontWeight="bold" opacity="0.6">COCODY</text>
                <text x="210" y="270" fill="#064E3B" fontSize="12" fontWeight="bold" opacity="0.7">LE PLATEAU</text>
                <text x="260" y="440" fill="#064E3B" fontSize="12" fontWeight="bold" opacity="0.6">MARCORY (ZONE 4)</text>
                <text x="50" y="250" fill="#6B7280" fontSize="11" fontWeight="bold" opacity="0.5">YOPOUGON</text>
                <text x="440" y="520" fill="#047857" fontSize="12" fontWeight="bold" opacity="0.6">ASSINIE (SUD)</text>
              </svg>

              {/* Interactive Property Markers */}
              {properties.map((prop, idx) => {
                // Map coordinates projection
                const xPos = prop.commune === 'Plateau' ? 240 :
                             prop.neighborhood.includes('Riviera') ? 350 :
                             prop.neighborhood.includes('Vallon') ? 300 :
                             prop.neighborhood.includes('Zone 4') ? 320 :
                             prop.commune.includes('Assinie') ? 480 : 380;
                const yPos = prop.commune === 'Plateau' ? 280 :
                             prop.neighborhood.includes('Riviera') ? 180 :
                             prop.neighborhood.includes('Vallon') ? 140 :
                             prop.neighborhood.includes('Zone 4') ? 420 :
                             prop.commune.includes('Assinie') ? 500 : 110;

                const isSelected = selectedMapPin?.id === prop.id || activeHoveredId === prop.id;

                return (
                  <div
                    key={prop.id}
                    onClick={() => {
                      setSelectedMapPin(prop);
                      setActiveHoveredId(prop.id);
                    }}
                    style={{ left: `${xPos}px`, top: `${yPos}px` }}
                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300 z-10 ${
                      isSelected ? 'scale-110 z-20' : 'hover:scale-105'
                    }`}
                  >
                    <div className={`px-2.5 py-1 rounded-full text-[11px] font-bold font-mono shadow-xl border flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                      isSelected
                        ? 'bg-amber-500 text-white border-white ring-4 ring-amber-500/30'
                        : 'bg-emerald-900 text-white border-white/60'
                    }`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
                      <span>{formatFcfa(prop.priceFcfa)}</span>
                    </div>
                  </div>
                );
              })}

              {/* Selected Pin Mini Preview Card floating on the map */}
              {selectedMapPin && (
                <div
                  onClick={() => handleSelectProperty(selectedMapPin)}
                  className="absolute bottom-4 left-4 right-4 liquid-glass-card bg-white/95 rounded-xl p-3 shadow-2xl border border-white/80 cursor-pointer flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2"
                >
                  <img
                    src={selectedMapPin.coverImage || selectedMapPin.featuredImage || selectedMapPin.images?.[0]?.url || FALLBACK_PROPERTY_IMAGE}
                    alt={selectedMapPin.title}
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-lg object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider block">
                      {selectedMapPin.commune} · {selectedMapPin.neighborhood}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 truncate">
                      {selectedMapPin.title}
                    </h4>
                    <span className="text-xs font-black font-mono text-emerald-900 mt-0.5 block">
                      {formatFcfa(selectedMapPin.priceFcfa)}
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-emerald-900 text-white flex items-center justify-center shrink-0">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
              )}

              {/* Map Compass and Control layer */}
              <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
                <button
                  onClick={() => setMapZoom(z => Math.min(z + 0.2, 2))}
                  className="w-7 h-7 rounded-lg bg-white/90 text-slate-800 font-bold flex items-center justify-center shadow text-xs hover:bg-white"
                >
                  +
                </button>
                <button
                  onClick={() => setMapZoom(z => Math.max(z - 0.2, 0.8))}
                  className="w-7 h-7 rounded-lg bg-white/90 text-slate-800 font-bold flex items-center justify-center shadow text-xs hover:bg-white"
                >
                  -
                </button>
              </div>

            </div>

          </div>
        </div>

      </div>

    </div>
  );
};
