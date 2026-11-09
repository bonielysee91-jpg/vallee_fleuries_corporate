import React from 'react';
import { useAppStore } from '../../store/useAppStore.ts';
import { VFC_WHATSAPP_URL } from '../../constants/contact.ts';
import { 
  X, 
  Building2, 
  Home, 
  Search, 
  Calculator, 
  Calendar, 
  ShieldCheck, 
  Heart, 
  User, 
  LogOut,
  PhoneCall,
  Sparkles
} from 'lucide-react';

export const TabletDrawer: React.FC = () => {
  const { 
    isTabletDrawerOpen, 
    closeTabletDrawer, 
    currentView, 
    setView, 
    favorites, 
    currentUser, 
    logoutUser, 
    openAuthModal,
    setFilters 
  } = useAppStore();

  if (!isTabletDrawerOpen) return null;

  const navigateTo = (view: any, filterAction?: () => void) => {
    closeTabletDrawer();
    if (filterAction) filterAction();
    setView(view);
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        onClick={closeTabletDrawer} 
      />

      {/* Slide-over panel */}
      <div className="relative ml-auto w-full max-w-sm h-full liquid-glass-dark bg-emerald-950/95 border-l border-white/20 shadow-2xl flex flex-col p-6 text-white z-10 animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-800 flex items-center justify-center text-amber-400 border border-amber-400/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="font-serif text-lg font-bold text-white leading-none">Vallées Fleuries</div>
              <div className="text-[10px] text-amber-400 uppercase tracking-widest font-semibold mt-1">Corporate CI</div>
            </div>
          </div>

          <button
            onClick={closeTabletDrawer}
            className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* User profile section */}
        <div className="py-4 my-2 px-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
          {currentUser ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-800 flex items-center justify-center text-amber-400 font-bold border border-amber-400/40">
                {currentUser.fullName.charAt(0)}
              </div>
              <div className="overflow-hidden">
                <div className="text-sm font-bold text-white truncate">{currentUser.fullName}</div>
                <div className="text-xs text-amber-300/80 font-medium">{currentUser.role === 'OWNER' ? 'Propriétaire Vérifié' : 'Locataire'}</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-slate-300">Non connecté</span>
              <button
                onClick={() => {
                  closeTabletDrawer();
                  openAuthModal('LOGIN');
                }}
                className="text-xs font-bold text-amber-400 hover:underline"
              >
                Se connecter
              </button>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto py-4 space-y-1">
          <button
            onClick={() => navigateTo('home')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
              currentView === 'home' ? 'bg-white/15 text-amber-300 font-bold' : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            <Home className="w-5 h-5 text-emerald-400" />
            <span>Accueil Prestige</span>
          </button>

          <button
            onClick={() => navigateTo('properties', () => setFilters({ category: 'ALL' }))}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
              currentView === 'properties' ? 'bg-white/15 text-amber-300 font-bold' : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            <Search className="w-5 h-5 text-emerald-400" />
            <span>Explorer tous les biens</span>
          </button>

          <button
            onClick={() => navigateTo('properties', () => setFilters({ category: 'SALE' }))}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-200 hover:bg-white/10 transition-colors"
          >
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span>Maisons à Vendre</span>
          </button>

          <button
            onClick={() => navigateTo('properties', () => setFilters({ category: 'LONG_TERM_RENT' }))}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-200 hover:bg-white/10 transition-colors"
          >
            <Building2 className="w-5 h-5 text-emerald-400" />
            <span>Maisons à Louer (Location Longue Durée)</span>
          </button>

          <button
            onClick={() => navigateTo('estimator')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
              currentView === 'estimator' ? 'bg-white/15 text-amber-300 font-bold' : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            <Calculator className="w-5 h-5 text-emerald-400" />
            <span>Simulateur Frais d'Entrée</span>
          </button>

          {/* Favorites Link */}
          <button
            onClick={() => navigateTo('properties')}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium text-slate-200 hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Heart className="w-5 h-5 text-rose-400" />
              <span>Ma Sélection Privée</span>
            </div>
            {favorites.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-900 text-xs font-black">
                {favorites.length}
              </span>
            )}
          </button>

          {/* Portals */}
          {currentUser?.role === 'OWNER' && (
            <button
              onClick={() => navigateTo('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                currentView === 'dashboard' ? 'bg-white/15 text-amber-300 font-bold' : 'text-slate-200 hover:bg-white/10'
              }`}
            >
              <User className="w-5 h-5 text-amber-400" />
              <span>Espace Propriétaire</span>
            </button>
          )}

          {(currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN') && (
            <button
              onClick={() => navigateTo('admin')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                currentView === 'admin' ? 'bg-white/15 text-amber-300 font-bold' : 'text-slate-200 hover:bg-white/10'
              }`}
            >
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              <span>Console d'Administration VFC</span>
            </button>
          )}
        </div>

        {/* Footer with Concierge Contact & Logout */}
        <div className="pt-4 border-t border-white/10 space-y-3">
          <a
            href={VFC_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-900 border border-emerald-700/50 flex items-center justify-center gap-2 text-xs font-bold text-emerald-200 hover:bg-emerald-800 transition-colors"
          >
            <PhoneCall className="w-4 h-4 text-emerald-400" />
            <span>Conciergerie WhatsApp (+225)</span>
          </a>

          {currentUser && (
            <button
              onClick={() => {
                closeTabletDrawer();
                logoutUser();
              }}
              className="w-full py-2 px-4 rounded-xl text-xs font-medium text-rose-300 hover:bg-rose-500/20 flex items-center justify-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Se déconnecter</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
