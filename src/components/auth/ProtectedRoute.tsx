import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth.ts';
import { useAppStore } from '../../store/useAppStore.ts';
import { UserRole } from '../../types/index.ts';
import { landingPathForRole, navigateTo } from '../../router/navigation.ts';
import { ShieldCheck } from 'lucide-react';

interface ProtectedRouteProps {
  /**
   * Roles allowed into this route tree. `SUPER_ADMIN` is always admitted
   * implicitly, mirroring the backend `ROLE_IMPLICATIONS` hierarchy.
   */
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

/** Full-screen liquid-glass splash shown during the session bootstrap. */
const SessionLoader: React.FC = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#064E3B] via-emerald-950 to-slate-950">
    <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-xl flex items-center justify-center">
      <ShieldCheck className="w-7 h-7 text-amber-400" />
    </div>
    <div className="mt-5 w-10 h-10 border-2 border-amber-400/80 border-t-transparent rounded-full animate-spin" />
    <p className="mt-4 text-xs font-medium tracking-wide text-emerald-100/80">
      Vérification sécurisée de votre session…
    </p>
  </div>
);

/**
 * Universal client-side route guard.
 *
 * - Session still resolving → splash (never renders guarded content early).
 * - Unauthenticated → redirect to /login carrying `location.state.from` so the
 *   user lands back on the page they originally requested.
 * - Authenticated but under-privileged → entry blocked, fluid liquid toast
 *   raised, then redirected to the landing page of their own role.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const { currentUser, isAuthenticated, isInitializing } = useAuth();
  const addNotification = useAppStore((state) => state.addNotification);
  const location = useLocation();
  const denialHandled = useRef(false);

  const role = currentUser?.role ?? null;
  const hasAccess = !!role && (allowedRoles.includes(role) || role === 'SUPER_ADMIN');
  const isDenied = !isInitializing && isAuthenticated && !hasAccess;

  useEffect(() => {
    if (!isDenied || denialHandled.current) return;
    denialHandled.current = true;
    addNotification('Accès non autorisé : Privilèges insuffisants', 'error');
    navigateTo(landingPathForRole(role), { replace: true });
  }, [isDenied, role, addNotification]);

  if (isInitializing) {
    return <SessionLoader />;
  }

  // Unauthenticated → the login portal, remembering where the user was heading.
  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isDenied) {
    // The effect above raises the toast and redirects; render nothing meanwhile.
    return <SessionLoader />;
  }

  return <>{children}</>;
};
