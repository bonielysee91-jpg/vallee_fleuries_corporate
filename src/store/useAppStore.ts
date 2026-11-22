import { create } from 'zustand';
import { FilterState, User } from '../types/index.ts';
import { navigateTo, pathForView } from '../router/navigation.ts';
import { api, setAccessToken } from '../services/api.ts';

export interface Notification {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  message: string;
  persistent?: boolean;
}

export interface ConfirmationOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  inputPlaceholder?: string;
  defaultValue?: string;
  onConfirm: (inputValue?: string) => void | Promise<void>;
  onCancel?: () => void;
}

export type AppView = 'home' | 'properties' | 'property-detail' | 'estimator' | 'dashboard' | 'admin' | 'favorites' | 'messages' | 'profile' | 'architecture' | 'avant-propos' | 'services';

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
  isVirtualTourOpen: boolean;
  confirmationDialog: ConfirmationOptions | null;
  /**
   * Jeton incrémenté après chaque création de visite : les écrans qui listent les
   * rendez-vous s'y abonnent pour recharger leur liste depuis Neon.
   */
  visitsRefreshToken: number;

  // Actions
  setView: (view: AppView, propertyId?: string) => void;
  syncViewFromPath: (pathname: string) => void;
  setSelectedPropertyId: (id: string | null) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  toggleFavorite: (propertyId: string) => void;
  setFavorites: (propertyIds: string[]) => void;
  addNotification: (message: string, type?: 'success' | 'info' | 'warning' | 'error', persistent?: boolean) => void;
  removeNotification: (id: string) => void;
  openConfirmation: (options: ConfirmationOptions) => void;
  closeConfirmation: () => void;

  // Auth actions
  loginUser: (user: User, token?: string) => void;
  logoutUser: () => void;
  openAuthModal: (mode?: 'LOGIN' | 'REGISTER') => void;

  // Adaptive Navigation actions
  openMobileSearch: () => void;
  closeMobileSearch: () => void;
  openTabletDrawer: () => void;
  closeTabletDrawer: () => void;

  // Modals actions
  openVisitModal: () => void;
  closeVisitModal: () => void;
  requestVisitsRefresh: () => void;
  openVirtualTour: () => void;
  closeVirtualTour: () => void;
}

const DEFAULT_FILTERS: FilterState = {
  category: 'ALL',
  type: 'ALL',
  propertyType: 'ALL',
  commune: 'ALL',
  minPrice: 0,
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
  isVirtualTourOpen: false,
  confirmationDialog: null,
  visitsRefreshToken: 0,

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
      pathname === '/' || pathname.startsWith('/accueil') ? 'home'
        : pathname.startsWith('/properties') || pathname.startsWith('/nos-biens') ? 'properties'
        : pathname.startsWith('/avant-propos') || pathname.startsWith('/a-propos') ? 'avant-propos'
        : pathname.startsWith('/services') ? 'services'
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

  addNotification: (message, type = 'success', persistent = false) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 6);
    set((state) => ({
      notifications: [...state.notifications, { id, message, type, persistent }]
    }));
    // Persistent errors remain until manually dismissed; other notifications auto-dismiss
    if (!persistent && type !== 'error') {
      setTimeout(() => {
        get().removeNotification(id);
      }, 5000);
    } else if (type === 'error' && !persistent) {
      setTimeout(() => {
        get().removeNotification(id);
      }, 8000);
    }
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter(n => n.id !== id)
    }));
  },

  openConfirmation: (options) => set({ confirmationDialog: options }),
  closeConfirmation: () => {
    const dialog = get().confirmationDialog;
    if (dialog?.onCancel) dialog.onCancel();
    set({ confirmationDialog: null });
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
  requestVisitsRefresh: () => set((state) => ({ visitsRefreshToken: state.visitsRefreshToken + 1 })),

  openVirtualTour: () => set({ isVirtualTourOpen: true }),
  closeVirtualTour: () => set({ isVirtualTourOpen: false }),
}));
