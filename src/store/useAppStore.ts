import { create } from 'zustand';
import { FilterState, User } from '../types/index.ts';
import { navigateTo, pathForView } from '../router/navigation.ts';
import { api, setAccessToken } from '../services/api.ts';

interface Notification {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  message: string;
}

export type AppView = 'home' | 'properties' | 'property-detail' | 'estimator' | 'dashboard' | 'admin' | 'favorites' | 'messages' | 'profile';

interface AppState {
  currentView: AppView;
  selectedPropertyId: string | null;
  activeCategoryFilter: string;
  filters: FilterState;
  favorites: string[];
  notifications: Notification[];

  // Auth state — hydrated exclusively from the Neon-backed session endpoint.
  currentUser: User | null;
  isAuthenticated: boolean;

  // Adaptive Responsive Modals & Drawers
  isMobileSearchOpen: boolean;
  isTabletDrawerOpen: boolean;

  // Domain Modals state
  isVisitModalOpen: boolean;
  isPaymentModalOpen: boolean;
  isVirtualTourOpen: boolean;
  isQuittanceModalOpen: boolean;
  activePaymentDetails: {
    amountFcfa: number;
    purpose: string;
    propertyTitle?: string;
    onSuccessCallback?: () => void;
  } | null;

  // Actions
  setView: (view: AppView, propertyId?: string) => void;
  syncViewFromPath: (pathname: string) => void;
  setSelectedPropertyId: (id: string | null) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  toggleFavorite: (propertyId: string) => void;
  setFavorites: (propertyIds: string[]) => void;
  addNotification: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  removeNotification: (id: string) => void;

  // Auth actions
  loginUser: (user: User, token?: string) => void;
  logoutUser: () => void;
  openAuthModal: (mode?: 'LOGIN' | 'REGISTER' | 'OTP') => void;

  // Adaptive Navigation actions
  openMobileSearch: () => void;
  closeMobileSearch: () => void;
  openTabletDrawer: () => void;
  closeTabletDrawer: () => void;

  // Modals actions
  openVisitModal: () => void;
  closeVisitModal: () => void;
  openPaymentModal: (details: { amountFcfa: number; purpose: string; propertyTitle?: string; onSuccessCallback?: () => void }) => void;
  closePaymentModal: () => void;
  openVirtualTour: () => void;
  closeVirtualTour: () => void;
  openQuittanceModal: () => void;
  closeQuittanceModal: () => void;
}

const DEFAULT_FILTERS: FilterState = {
  category: 'ALL',
  type: 'ALL',
  propertyType: 'ALL',
  commune: 'ALL',
  minPrice: 0,
  maxPrice: 15000000,
  bedrooms: 'ALL',
  furnishing: 'ALL',
  amenities: [],
  searchQuery: ''
};

export const useAppStore = create<AppState>((set, get) => ({
  currentView: 'home',
  selectedPropertyId: null,
  activeCategoryFilter: 'ALL',
  filters: DEFAULT_FILTERS,
  favorites: [],
  notifications: [],

  // No optimistic mock session: the AuthProvider hydrates this from /api/auth/me.
  currentUser: null,
  isAuthenticated: false,

  isMobileSearchOpen: false,
  isTabletDrawerOpen: false,

  isVisitModalOpen: false,
  isPaymentModalOpen: false,
  isVirtualTourOpen: false,
  isQuittanceModalOpen: false,
  activePaymentDetails: null,

  setView: (view, propertyId) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const nextPropertyId = propertyId ?? get().selectedPropertyId;
    set({
      currentView: view,
      ...(propertyId ? { selectedPropertyId: propertyId } : {})
    });
    navigateTo(pathForView(view, nextPropertyId));
  },

  syncViewFromPath: (pathname) => {
    if (pathname.startsWith('/properties/')) {
      const id = decodeURIComponent(pathname.replace('/properties/', ''));
      if (id) set({ selectedPropertyId: id });
      set({ currentView: 'property-detail' });
      return;
    }
    const derived =
      pathname === '/' ? 'home'
        : pathname.startsWith('/properties') ? 'properties'
        : pathname.startsWith('/estimator') ? 'estimator'
        : pathname.startsWith('/dashboard') ? 'dashboard'
        : pathname.startsWith('/admin') ? 'admin'
        : pathname.startsWith('/favorites') ? 'favorites'
        : pathname.startsWith('/profile') ? 'profile'
        : 'home';
    set({ currentView: derived as AppView });
  },

  setSelectedPropertyId: (id) => set({ selectedPropertyId: id }),

  setFilters: (newFilters) => set((state) => ({
    filters: { ...state.filters, ...newFilters }
  })),

  resetFilters: () => set({ filters: DEFAULT_FILTERS }),

  toggleFavorite: (propertyId) => {
    const { favorites, addNotification, isAuthenticated } = get();
    const exists = favorites.includes(propertyId);
    const updated = exists ? favorites.filter(id => id !== propertyId) : [...favorites, propertyId];
    set({ favorites: updated });
    addNotification(
      exists ? 'Propriété retirée de vos favoris' : 'Propriété ajoutée à votre sélection privée',
      'info'
    );

    // Persist to Neon only for a verified session.
    if (isAuthenticated) {
      const sync = exists ? api.removeFavorite(propertyId) : api.addFavorite(propertyId);
      sync.catch(() => {
        set({ favorites });
        addNotification('Synchronisation du favori impossible pour le moment', 'warning');
      });
    }
  },

  setFavorites: (propertyIds) => set({ favorites: propertyIds }),

  addNotification: (message, type = 'success') => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 6);
    set((state) => ({
      notifications: [...state.notifications, { id, message, type }]
    }));
    setTimeout(() => {
      get().removeNotification(id);
    }, 4500);
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter(n => n.id !== id)
    }));
  },

  loginUser: (user, token) => {
    if (token) setAccessToken(token);
    set({
      currentUser: user,
      isAuthenticated: true
    });
    get().addNotification(`Bienvenue sur Vallées Fleuries, ${user.fullName}`, 'success');
  },

  logoutUser: () => {
    setAccessToken(null);
    set({
      currentUser: null,
      isAuthenticated: false,
      favorites: []
    });
    get().addNotification('Vous avez été déconnecté avec succès', 'info');
  },

  // The unified auth portal lives at /login & /register.
  openAuthModal: (mode = 'LOGIN') => {
    navigateTo(mode === 'LOGIN' ? '/login' : '/register');
  },

  openMobileSearch: () => set({ isMobileSearchOpen: true }),
  closeMobileSearch: () => set({ isMobileSearchOpen: false }),

  openTabletDrawer: () => set({ isTabletDrawerOpen: true }),
  closeTabletDrawer: () => set({ isTabletDrawerOpen: false }),

  openVisitModal: () => set({ isVisitModalOpen: true }),
  closeVisitModal: () => set({ isVisitModalOpen: false }),

  openPaymentModal: (details) => set({
    isPaymentModalOpen: true,
    activePaymentDetails: details
  }),
  closePaymentModal: () => set({ isPaymentModalOpen: false, activePaymentDetails: null }),

  openVirtualTour: () => set({ isVirtualTourOpen: true }),
  closeVirtualTour: () => set({ isVirtualTourOpen: false }),

  openQuittanceModal: () => set({ isQuittanceModalOpen: true }),
  closeQuittanceModal: () => set({ isQuittanceModalOpen: false }),
}));
