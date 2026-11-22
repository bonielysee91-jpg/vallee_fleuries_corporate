/**
 * Vallées Fleuries Corporate — Router navigation bridge.
 *
 * The Zustand store cannot call `useNavigate()` directly, so the router
 * registers its imperative `navigate` function here once mounted. Every legacy
 * `setView(...)` call site keeps working while the URL stays authoritative.
 */

export type NavigateFn = (to: string, options?: { replace?: boolean }) => void;

let navigateImpl: NavigateFn | null = null;

/** Called once by the router bridge inside `<BrowserRouter>`. */
export function registerNavigate(fn: NavigateFn | null): void {
  navigateImpl = fn;
}

export function navigateTo(to: string, options?: { replace?: boolean }): void {
  if (navigateImpl) {
    navigateImpl(to, options);
    return;
  }
  if (typeof window !== 'undefined') {
    window.location.assign(to);
  }
}

export type RoleLike = 'TENANT' | 'OWNER' | 'AGENT' | 'ADMIN' | 'SUPER_ADMIN';

/** Canonical landing page for a role after login (or after an unauthorized attempt). */
export function landingPathForRole(role: RoleLike | null | undefined): string {
  switch (role) {
    case 'ADMIN':
    case 'SUPER_ADMIN':
      return '/admin';
    case 'OWNER':
    case 'AGENT':
      return '/dashboard';
    default:
      return '/';
  }
}

/** Legacy `AppView` → real URL mapping, so old call sites resolve to routes. */
export function pathForView(view: string, propertyId?: string | null): string {
  switch (view) {
    case 'home':
      return '/';
    case 'properties':
      return '/properties';
    case 'property-detail':
      return propertyId ? `/properties/${propertyId}` : '/properties';
    case 'estimator':
      return '/estimator';
    case 'avant-propos':
      return '/avant-propos';
    case 'services':
      return '/services';
    case 'architecture':
      return '/architecture';
    case 'dashboard':
      return '/dashboard';
    case 'admin':
      return '/admin';
    case 'favorites':
      return '/favorites';
    case 'profile':
      return '/profile/settings';
    default:
      return '/';
  }
}
