import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore.ts';
import { User, UserRole } from '../../types/index.ts';
import { api } from '../../services/api.ts';

interface AuthContextType {
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isAuthenticated, loginUser, logoutUser, setFavorites } = useAppStore();
  const [adminPreviewMode, setAdminPreviewMode] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  // Hydrate the session from Neon on mount: access-token cookie first, then a
  // single refresh-cookie rotation. Nothing is ever assumed or fabricated.
  useEffect(() => {
    let cancelled = false;

    const bootstrapSession = async () => {
      let user = await api.getCurrentUser();

      if (!user) {
        user = await api.refreshSession();
      }

      if (cancelled) return;

      if (user) {
        // Silent hydration: no welcome toast on a simple page reload.
        useAppStore.setState({ currentUser: user, isAuthenticated: true });
        try {
          setFavorites(await api.getFavorites());
        } catch {
          // A favorites failure must never block authentication.
        }
      }

      if (!cancelled) setIsInitializing(false);
    };

    bootstrapSession();
    return () => {
      cancelled = true;
    };
  }, [setFavorites]);

  const toggleAdminPreview = () => {
    setAdminPreviewMode((prev) => !prev);
  };

  const role = currentUser?.role || null;
  const isAdmin = (role === 'ADMIN' || role === 'SUPER_ADMIN') && !adminPreviewMode;
  const isOwner = role === 'OWNER' || role === 'AGENT';
  const isTenant = role === 'TENANT' || adminPreviewMode;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        isInitializing,
        isAdmin,
        isOwner,
        isTenant,
        role,
        adminPreviewMode,
        toggleAdminPreview,
        login: loginUser,
        logout: async () => {
          // Revoke the server-side session first, then clear local state.
          await api.logout();
          logoutUser();
        },
        refreshSession: async () => {
          const user = await api.getCurrentUser();
          if (user) {
            useAppStore.setState({ currentUser: user, isAuthenticated: true });
          } else {
            logoutUser();
          }
        }
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
