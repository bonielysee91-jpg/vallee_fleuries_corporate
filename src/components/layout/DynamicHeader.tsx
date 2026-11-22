import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore.ts';
import { useShallow } from 'zustand/react/shallow';
import { useAuth } from '../auth/useAuth.ts';
import { VFC_WHATSAPP_URL, VFC_WHATSAPP_MESSAGE } from '../../constants/contact.ts';
import {
  Heart,
  ChevronDown,
  Sparkles,
  LogOut,
  ShieldCheck,
  Eye,
  Menu,
  Briefcase,
  KeyRound,
  Settings,
  MessageCircle,
  UserPlus,
} from 'lucide-react';

/**
 * Adaptive Liquid Glass header.
 *
 *  · Mobile  (<768px) : frosted bar with only the VFC wordmark, an active
 *                       WhatsApp concierge button and the user avatar.
 *  · Tablet  (768-1024): wordmark + hamburger drawer (secondary links live there).
 *  · Desktop (>1024px): wordmark, « Accueil / Nos Biens / Vente / Location »,
 *                       WhatsApp action, FCFA currency badge and the profile menu.
 *
 * No search input lives in the header: searching belongs to the catalogue page
 * (desktop) and to the « Recherche » bottom tab (mobile).
 */
export const DynamicHeader: React.FC = () => {
  const navigate = useNavigate();
  const { currentView, favorites, filters, resetFilters, setFilters, openTabletDrawer } =
    useAppStore(useShallow((s) => ({
      currentView: s.currentView,
      favorites: s.favorites,
      filters: s.filters,
      resetFilters: s.resetFilters,
      setFilters: s.setFilters,
      openTabletDrawer: s.openTabletDrawer,
    })));
  const { currentUser, isAdmin, isOwner, adminPreviewMode, toggleAdminPreview, logout } = useAuth();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const whatsAppHref = `${VFC_WHATSAPP_URL}?text=${encodeURIComponent(VFC_WHATSAPP_MESSAGE)}`;

  const goToCatalogue = (category: 'ALL' | 'SALE' | 'LONG_TERM_RENT') => {
    setFilters({ category, searchQuery: '' });
    navigate('/properties');
  };

  return (
    <header className="sticky top-0 z-40 w-full liquid-glass border-b border-emerald-950/10">

      {/* Super-Admin Quick Preview Banner (when active) */}
      {adminPreviewMode && (
        <div className="w-full bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-slate-950 px-4 py-1.5 text-xs font-bold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full justify-between">
            <div className="flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              <span>Mode Prévisualisation Client Public actif (Super-Admin)</span>
            </div>
            <button
              onClick={toggleAdminPreview}
              className="px-2.5 py-0.5 rounded-full bg-slate-950 text-amber-300 text-[10px] uppercase tracking-wider font-extrabold hover:bg-slate-900 transition-colors"
            >
              Retour Console Admin
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4">

        {/* Left: Brand Logo & Wordmark */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            resetFilters();
            navigate('/');
          }}
          className="flex items-center gap-3.5 group shrink-0"
        >
          {/* Logo VFC complet (icône + texte), affiché sans recadrage */}
          <div className="flex items-center shrink-0">
            <img
              src="/atar.jpg"
              onError={(e) => {
                if (e.currentTarget.src.endsWith('/atar.jpg')) {
                  e.currentTarget.src = '/atar.svg';
                } else if (e.currentTarget.src.endsWith('/atar.svg')) {
                  e.currentTarget.src = '/atar.png';
                } else if (e.currentTarget.src.endsWith('/atar.png')) {
                  e.currentTarget.src = '/atar.jpeg';
                }
              }}
              alt="Vallées Fleuries Corporate"
              className="h-12 sm:h-16 w-auto object-contain"
            />
          </div>
        </a>

        {/* Center: Primary rental navigation (Desktop only) */}
        <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-700">
          <button
            onClick={() => navigate('/')}
            className={`whitespace-nowrap transition-colors py-1 cursor-pointer hover:text-emerald-900 ${
              currentView === 'home' ? 'text-emerald-900 font-bold border-b-2 border-emerald-700' : ''
            }`}
          >
            Accueil
          </button>

          <button
            onClick={() => navigate('/avant-propos')}
            className={`whitespace-nowrap transition-colors py-1 cursor-pointer hover:text-emerald-900 ${
              currentView === 'avant-propos' ? 'text-emerald-900 font-bold border-b-2 border-emerald-700' : ''
            }`}
          >
            À propos
          </button>

          <button
            onClick={() => navigate('/services')}
            className={`whitespace-nowrap transition-colors py-1 cursor-pointer hover:text-emerald-900 ${
              currentView === 'services' ? 'text-emerald-900 font-bold border-b-2 border-emerald-700' : ''
            }`}
          >
            Nos Services
          </button>

          <button
            onClick={() => goToCatalogue('ALL')}
            className={`whitespace-nowrap transition-colors py-1 cursor-pointer hover:text-emerald-900 ${
              currentView === 'properties' && filters.category === 'ALL'
                ? 'text-emerald-900 font-bold border-b-2 border-emerald-700'
                : ''
            }`}
          >
            Nos Biens
          </button>

          <button
            onClick={() => goToCatalogue('SALE')}
            className={`whitespace-nowrap transition-colors py-1 cursor-pointer hover:text-emerald-900 flex items-center gap-1.5 ${
              currentView === 'properties' && filters.category === 'SALE'
                ? 'text-emerald-900 font-bold border-b-2 border-emerald-700'
                : ''
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Vente</span>
          </button>

          <button
            onClick={() => goToCatalogue('LONG_TERM_RENT')}
            className={`whitespace-nowrap transition-colors py-1 cursor-pointer hover:text-emerald-900 flex items-center gap-1.5 ${
              currentView === 'properties' && filters.category === 'LONG_TERM_RENT'
                ? 'text-emerald-900 font-bold border-b-2 border-emerald-700'
                : ''
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
            <span>Location</span>
          </button>
        </nav>

        {/* Right Section: Contact, Currency, Favourites & Profile */}
        <div className="flex items-center gap-2.5 shrink-0">

          {/* Tablet Hamburger (768px - 1024px) */}
          <button
            onClick={openTabletDrawer}
            className="hidden md:flex lg:hidden items-center justify-center w-10 h-10 rounded-full bg-white/90 border border-slate-200 text-slate-800 hover:bg-slate-100 transition-colors"
            title="Menu"
          >
            <Menu className="w-5 h-5 text-emerald-950" />
          </button>

          {/* WhatsApp concierge action — the only contact affordance on mobile */}
          <a
            href={whatsAppHref}
            target="_blank"
            rel="noreferrer"
            title="Conciergerie WhatsApp"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">WhatsApp</span>
          </a>

          {/* FCFA currency badge — desktop */}
          <span className="hidden lg:inline-flex items-center px-2.5 py-1 rounded-full bg-white/80 border border-slate-200 text-[10px] font-black tracking-wider text-emerald-900">
            FCFA
          </span>

          {/* Favourites — desktop & tablet */}
          <button
            onClick={() => navigate('/favorites')}
            title="Mes favoris"
            className="hidden sm:flex relative items-center justify-center w-10 h-10 rounded-full bg-white/90 border border-slate-200/80 text-slate-700 hover:text-rose-600 hover:border-rose-200 hover:shadow-sm transition-all cursor-pointer"
          >
            <Heart className={`w-4 h-4 ${favorites.length > 0 ? 'fill-rose-500 text-rose-500' : ''}`} />
            {favorites.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow">
                {favorites.length}
              </span>
            )}
          </button>

          {/* ROLE: SUPER-ADMIN / ADMIN */}
          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-950 to-emerald-900 border border-amber-400 text-amber-300 text-xs font-bold shadow-sm hover:scale-105 transition-all"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden xl:inline">Super-Admin</span>
            </button>
          )}

          {/* ROLE: OWNER / PROPRIÉTAIRE */}
          {isOwner && (
            <button
              onClick={() => navigate('/dashboard')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-900 to-emerald-800 text-amber-400 border border-amber-400/40 text-xs font-bold shadow-sm hover:scale-105 transition-all"
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Espace Propriétaire</span>
            </button>
          )}

          {/* User Account / Profile Dropdown */}
          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                aria-label="Menu du compte"
                className="flex items-center gap-2 p-1 sm:pl-1.5 sm:pr-2.5 sm:py-1 rounded-full bg-white/90 border border-slate-200/90 text-slate-800 hover:border-emerald-600 transition-all cursor-pointer shadow-sm"
              >
                <div className="w-8 h-8 sm:w-7 sm:h-7 rounded-full bg-emerald-900 text-amber-400 font-bold text-xs flex items-center justify-center border border-amber-400/40 overflow-hidden">
                  {currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    currentUser.fullName.charAt(0)
                  )}
                </div>
                <span className="hidden md:inline text-xs font-semibold max-w-[100px] truncate">
                  {currentUser.fullName}
                </span>
                <ChevronDown className="hidden sm:block w-3 h-3 text-slate-500" />
              </button>

              {isUserMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsUserMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <div className="text-xs font-bold text-slate-900">{currentUser.fullName}</div>
                    <div className="text-[11px] text-emerald-700 font-medium">{currentUser.phoneNumber}</div>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[9px] font-black uppercase">
                      {currentUser.role}
                    </span>
                  </div>

                  <div className="py-1">
                    {(currentUser.role === 'OWNER' || currentUser.role === 'AGENT' || currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN') && (
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          navigate('/dashboard');
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 rounded-lg flex items-center gap-2"
                      >
                        <Briefcase className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Espace Propriétaire</span>
                      </button>
                    )}

                    {(currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN') && (
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          navigate('/admin');
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 rounded-lg flex items-center gap-2"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                        <span>Command Center Admin</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        navigate('/my-rentals');
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Mes locations</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        navigate('/favorites');
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2"
                    >
                      <Heart className="w-3.5 h-3.5 text-rose-500" />
                      <span>Mes Favoris ({favorites.length})</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        navigate('/profile/settings');
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2"
                    >
                      <Settings className="w-3.5 h-3.5 text-slate-500" />
                      <span>Paramètres du profil</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2 mt-1"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-600" />
                      <span>Se déconnecter</span>
                    </button>
                  </div>
                </div>
              </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/register')}
                title="Créer un compte"
                className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/90 border border-emerald-800/30 text-emerald-900 font-bold text-xs hover:bg-emerald-50 hover:border-emerald-700 active:scale-95 transition-all shadow-sm"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Inscription</span>
              </button>
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 rounded-full bg-gradient-to-r from-emerald-900 to-emerald-800 text-amber-400 font-bold text-xs border border-amber-400/40 hover:scale-105 active:scale-95 transition-all shadow-sm"
              >
                Connexion
              </button>
            </div>
          )}

        </div>

      </div>
    </header>
  );
};
