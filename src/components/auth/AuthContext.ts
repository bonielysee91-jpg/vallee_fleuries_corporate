import { createContext } from 'react';
import { User, UserRole } from '../../types/index.ts';

export interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  /** True until the Neon-backed session check has resolved (prevents auth flicker). */
  isInitializing: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  isTenant: boolean;
  role: UserRole | null;
  adminPreviewMode: boolean; // Allows admin to view the site as a normal client without logging out
  toggleAdminPreview: () => void;
  login: (user: User, token?: string) => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

/**
 * Le contexte vit dans son propre module, et non dans `AuthProvider.tsx` : un
 * fichier qui exporte à la fois un composant (`AuthProvider`) et une valeur non
 * composant (le contexte, l'ancien hook `useAuth`) casse la frontière de React
 * Fast Refresh — d'où l'avertissement Vite « Could not Fast Refresh ». Séparer
 * ces exports rend le rechargement à chaud fiable sans changer l'architecture.
 */
export const AuthContext = createContext<AuthContextType | undefined>(undefined);
