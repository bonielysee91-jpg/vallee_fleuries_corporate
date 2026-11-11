/**
 * Vallées Fleuries Corporate — Pure Real Estate Rental Platform
 * High-Performance African Web Application
 *
 * Routing architecture (React Router v7):
 *  - PUBLIC            /, /accueil, /properties (+ /nos-biens alias), /properties/:id, /estimator
 *  - INFRASTRUCTURE    /architecture — live Neon PostgreSQL schema readout (never linked publicly)
 *  - LEGACY / 404      any unknown path redirects to /
 *  - AUTH PORTAL       /login, /register            (standalone liquid-glass shell)
 *  - CLIENT  (TENANT|OWNER|ADMIN)   /favorites, /my-rentals, /profile/settings
 *  - LANDLORD (OWNER|AGENT|ADMIN)   /dashboard/*
 *  - ADMIN   (ADMIN only)           /admin/*
 */

import React, { useLayoutEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import { AuthProvider } from './components/auth/AuthProvider.tsx';
import { ProtectedRoute } from './components/auth/ProtectedRoute.tsx';
import { PublicLayout } from './components/layout/PublicLayout.tsx';
import { UserDashboardLayout } from './components/layout/UserDashboardLayout.tsx';
import { AdminDashboardLayout } from './components/layout/AdminDashboardLayout.tsx';
import { NotificationToasts } from './components/layout/NotificationToasts.tsx';

import { registerNavigate } from './router/navigation.ts';
import { useAppStore } from './store/useAppStore.ts';

/**
 * Chargement paresseux (code-splitting) : chaque page/écran part dans son propre
 * chunk, chargé uniquement à la navigation. Le bundle initial ne contient donc que
 * la coquille (layouts, auth, routeur), ce qui accélère le premier affichage.
 * Les layouts partagés restent importés statiquement (ils encadrent tout le site).
 */
const lazyPage = <M, K extends keyof M>(loader: () => Promise<M>, name: K) =>
  React.lazy(async () => {
    const mod = await loader();
    return { default: mod[name] as unknown as React.ComponentType<any> };
  });

const HomePage = lazyPage(() => import('./pages/HomePage.tsx'), 'HomePage');
const AuthPage = lazyPage(() => import('./pages/AuthPage.tsx'), 'AuthPage');
const InvitationAcceptPage = lazyPage(
  () => import('./pages/InvitationAcceptPage.tsx'),
  'InvitationAcceptPage'
);
const PhoneVerificationPage = lazyPage(
  () => import('./pages/PhoneVerificationPage.tsx'),
  'PhoneVerificationPage'
);
const FavoritesPage = lazyPage(() => import('./pages/FavoritesPage.tsx'), 'FavoritesPage');
const MyRentalsPage = lazyPage(() => import('./pages/MyRentalsPage.tsx'), 'MyRentalsPage');
const ProfileSettingsPage = lazyPage(
  () => import('./pages/ProfileSettingsPage.tsx'),
  'ProfileSettingsPage'
);
const SystemArchitecturePage = lazyPage(
  () => import('./pages/SystemArchitecturePage.tsx'),
  'SystemArchitecturePage'
);
const LegalPage = lazyPage(() => import('./pages/LegalPage.tsx'), 'LegalPage');

const PropertyWizardPage = lazyPage(
  () => import('./pages/dashboard/PropertyWizardPage.tsx'),
  'PropertyWizardPage'
);
const PropertyManagePage = lazyPage(
  () => import('./pages/dashboard/PropertyManagePage.tsx'),
  'PropertyManagePage'
);
const CalendarPage = lazyPage(() => import('./pages/dashboard/CalendarPage.tsx'), 'CalendarPage');
const ReceiptsPage = lazyPage(() => import('./pages/dashboard/ReceiptsPage.tsx'), 'ReceiptsPage');

const AdminOverviewPage = lazyPage(
  () => import('./pages/admin/AdminOverviewPage.tsx'),
  'AdminOverviewPage'
);
const AdminUsersPage = lazyPage(() => import('./pages/admin/AdminUsersPage.tsx'), 'AdminUsersPage');
const AdminInvitationsPage = lazyPage(
  () => import('./pages/admin/AdminInvitationsPage.tsx'),
  'AdminInvitationsPage'
);
const AdminModerationPage = lazyPage(
  () => import('./pages/admin/AdminModerationPage.tsx'),
  'AdminModerationPage'
);
const AdminPropertiesPage = lazyPage(
  () => import('./pages/admin/AdminPropertiesPage.tsx'),
  'AdminPropertiesPage'
);
const AdminTransactionsPage = lazyPage(
  () => import('./pages/admin/AdminTransactionsPage.tsx'),
  'AdminTransactionsPage'
);
const AdminAuditLogsPage = lazyPage(
  () => import('./pages/admin/AdminAuditLogsPage.tsx'),
  'AdminAuditLogsPage'
);

const PropertyExplorer = lazyPage(
  () => import('./components/properties/PropertyExplorer.tsx'),
  'PropertyExplorer'
);
const PropertyDetail = lazyPage(
  () => import('./components/properties/PropertyDetail.tsx'),
  'PropertyDetail'
);
const LandlordDashboard = lazyPage(
  () => import('./components/dashboard/LandlordDashboard.tsx'),
  'LandlordDashboard'
);
const CostEstimatorSection = lazyPage(
  () => import('./components/home/CostEstimatorSection.tsx'),
  'CostEstimatorSection'
);

/** Écran d'attente affiché pendant le chargement d'un chunk de route. */
const RouteFallback: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
    <div className="flex flex-col items-center gap-3 text-emerald-800">
      <span className="w-9 h-9 rounded-full border-2 border-emerald-700/25 border-t-emerald-700 animate-spin" />
      <span className="text-xs font-semibold tracking-wide">Chargement…</span>
    </div>
  </div>
);

/** Roles allowed inside the landlord / agency workspace. */
const LANDLORD_ROLES = ['OWNER', 'AGENT', 'ADMIN'] as const;
/** Roles allowed inside the client space. */
const CLIENT_ROLES = ['TENANT', 'OWNER', 'ADMIN'] as const;

/**
 * Keeps the legacy Zustand view machine and the URL in lockstep:
 * gives the store a real `navigate` and mirrors the pathname back into it.
 */
const RouterBridge: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const syncViewFromPath = useAppStore((state) => state.syncViewFromPath);

  useLayoutEffect(() => {
    registerNavigate((to, options) => navigate(to, options));
    return () => registerNavigate(null);
  }, [navigate]);

  useLayoutEffect(() => {
    syncViewFromPath(location.pathname);
  }, [location.pathname, syncViewFromPath]);

  return null;
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RouterBridge />

        <React.Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* ---------- UNIFIED AUTHENTICATION PORTAL ---------- */}
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />

          {/* Vérification du numéro après inscription self-service (code SMS). */}
          <Route path="/verify-phone" element={<PhoneVerificationPage />} />

          {/* Invitation administrateur — page publique d'activation (lien reçu par e-mail). */}
          <Route path="/invitation" element={<InvitationAcceptPage />} />

          {/* ---------- PUBLIC SHELL ---------- */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/accueil" element={<HomePage />} />
            <Route path="/properties" element={<PropertyExplorer />} />
            <Route path="/nos-biens" element={<PropertyExplorer />} />
            <Route path="/properties/:id" element={<PropertyDetail />} />
            <Route
              path="/estimator"
              element={
                <div className="pt-6">
                  <CostEstimatorSection />
                </div>
              }
            />

            {/* Live Neon PostgreSQL schema readout — reachable at its own URL, never linked publicly. */}
            <Route path="/architecture" element={<SystemArchitecturePage />} />

            {/* Pages réglementaires liées depuis le pied de page. */}
            <Route path="/legal/:section" element={<LegalPage />} />

            {/* ---------- CLIENT SPACE (TENANT | OWNER | ADMIN) ---------- */}
            <Route
              path="/favorites"
              element={
                <ProtectedRoute allowedRoles={[...CLIENT_ROLES]}>
                  <FavoritesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-rentals"
              element={
                <ProtectedRoute allowedRoles={[...CLIENT_ROLES]}>
                  <MyRentalsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile/settings"
              element={
                <ProtectedRoute allowedRoles={[...CLIENT_ROLES]}>
                  <ProfileSettingsPage />
                </ProtectedRoute>
              }
            />

            {/* Global 404 fallback: unknown paths are bounced back to the home page. */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>

          {/* ---------- LANDLORD / AGENCE WORKSPACE (OWNER | AGENT | ADMIN) ---------- */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={[...LANDLORD_ROLES]}>
                <UserDashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<LandlordDashboard />} />
            <Route path="properties/new" element={<PropertyWizardPage />} />
            <Route path="properties/:id/edit" element={<PropertyWizardPage />} />
            <Route path="properties/manage" element={<PropertyManagePage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="receipts" element={<ReceiptsPage />} />
          </Route>

          {/* ---------- SUPER-ADMIN COMMAND CENTER (ADMIN ONLY) ---------- */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AdminDashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminOverviewPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="invitations" element={<AdminInvitationsPage />} />
            <Route path="moderation" element={<AdminModerationPage />} />
            <Route path="properties" element={<AdminPropertiesPage />} />
            <Route path="transactions" element={<AdminTransactionsPage />} />
            <Route path="audit-logs" element={<AdminAuditLogsPage />} />
          </Route>
        </Routes>
        </React.Suspense>

        {/* Liquid Glass notifications — mounted at shell level so route guards
            and any nested page can raise alerts from anywhere. */}
        <NotificationToasts />
      </AuthProvider>
    </BrowserRouter>
  );
}
