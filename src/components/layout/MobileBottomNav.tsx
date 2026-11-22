import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.ts';
import { useAppStore } from '../../store/useAppStore.ts';
import { Home, Search, Heart, User } from 'lucide-react';

/**
 * iOS "Liquid Glass" bottom navigation for mobile (<768px).
 * Tabs: Accueil · Recherche · Favoris · Profil.
 */
export const MobileBottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const favorites = useAppStore((state) => state.favorites);
  const openMobileSearch = useAppStore((state) => state.openMobileSearch);

  /** The 4th tab always reads « Profil »; it routes to the auth portal when signed out. */
  const profileTarget = currentUser ? '/profile/settings' : '/login';

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  const itemClass = (active: boolean, accent: 'amber' | 'rose' = 'amber') => {
    if (!active) return 'text-slate-300 hover:text-white';
    return accent === 'rose' ? 'text-rose-400 font-bold scale-105' : 'text-amber-400 font-bold scale-105';
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-3 pb-3 pointer-events-none">
      <nav
        aria-label="Navigation mobile"
        className="pointer-events-auto mx-auto max-w-md backdrop-blur-2xl bg-emerald-950/85 border border-white/20 rounded-2xl shadow-[0_12px_40px_rgba(6,78,59,0.45)] px-2 py-2 grid grid-cols-4"
      >
        {/* Accueil */}
        <button
          onClick={() => navigate('/')}
          className={`flex flex-col items-center justify-center py-1 transition-all duration-300 relative ${itemClass(isActive('/'))}`}
        >
          <Home className="w-5 h-5 stroke-[2.2]" />
          <span className="text-[10px] mt-1 tracking-tight">Accueil</span>
          {isActive('/') && <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
        </button>

        {/* Recherche — ouvre aussi le tiroir de filtres */}
        <button
          onClick={() => {
            openMobileSearch();
            navigate('/properties');
          }}
          className={`flex flex-col items-center justify-center py-1 transition-all duration-300 relative ${itemClass(
            isActive('/properties') || isActive('/estimator')
          )}`}
        >
          <Search className="w-5 h-5 stroke-[2.2]" />
          <span className="text-[10px] mt-1 tracking-tight">Recherche</span>
          {(isActive('/properties') || isActive('/estimator')) && (
            <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          )}
        </button>

        {/* Favoris */}
        <button
          onClick={() => navigate(currentUser ? '/favorites' : '/login')}
          className={`flex flex-col items-center justify-center py-1 transition-all duration-300 relative ${itemClass(
            isActive('/favorites'),
            'rose'
          )}`}
        >
          <div className="relative">
            <Heart className={`w-5 h-5 stroke-[2.2] ${favorites.length > 0 ? 'fill-rose-500 text-rose-500' : ''}`} />
            {favorites.length > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-amber-500 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center shadow-md">
                {favorites.length}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">Favoris</span>
        </button>

        {/* Profil */}
        <button
          onClick={() => navigate(profileTarget)}
          className={`flex flex-col items-center justify-center py-1 transition-all duration-300 relative ${itemClass(
            isActive(profileTarget)
          )}`}
        >
          {currentUser?.avatarUrl ? (
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.fullName}
              className="w-5 h-5 rounded-full object-cover border border-amber-400"
            />
          ) : (
            <User className="w-5 h-5 stroke-[2.2]" />
          )}
          <span className="text-[10px] mt-1 tracking-tight">Profil</span>
          {isActive(profileTarget) && <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
        </button>
      </nav>
    </div>
  );
};
