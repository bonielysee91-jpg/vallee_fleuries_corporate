/**
 * Vallées Fleuries Corporate — Pure Real Estate Rental Platform
 * High-Performance African Web Application
 *
 * Routing architecture (React Router v7):
 *  - PUBLIC            /, /properties, /properties/:id, /estimator
 *  - AUTH PORTAL       /login, /register            (standalone liquid-glass shell)
 *  - CLIENT  (TENANT|OWNER|ADMIN)   /favorites, /my-rentals, /profile/settings
 *  - LANDLORD (OWNER|AGENT|ADMIN)   /dashboard/*
 *  - ADMIN   (ADMIN only)           /admin/*
 */

import React, { useLayoutEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import { AuthProvider } from './components/auth/AuthProvider.tsx';
import { ProtectedRoute } from './components/auth/ProtectedRoute.tsx';
import { PublicLayout } from './components/layout/PublicLayout.tsx';
import { UserDashboardLayout } from './components/layout/UserDashboardLayout.tsx';
import { AdminDashboardLayout } from './components/layout/AdminDashboardLayout.tsx';
import { NotificationToasts } from './components/layout/NotificationToasts.tsx';

import { HomePage } from './pages/HomePage.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { FavoritesPage } from './pages/FavoritesPage.tsx';
import { MyRentalsPage } from './pages/MyRentalsPage.tsx';
import { ProfileSettingsPage } from './pages/ProfileSettingsPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';

import { PropertyWizardPage } from './pages/dashboard/PropertyWizardPage.tsx';
import { PropertyManagePage } from './pages/dashboard/PropertyManagePage.tsx';
import { CalendarPage } from './pages/dashboard/CalendarPage.tsx';
import { ReceiptsPage } from './pages/dashboard/ReceiptsPage.tsx';

import { AdminOverviewPage } from './pages/admin/AdminOverviewPage.tsx';
import { AdminUsersPage } from './pages/admin/AdminUsersPage.tsx';
import { AdminModerationPage } from './pages/admin/AdminModerationPage.tsx';
import { AdminTransactionsPage } from './pages/admin/AdminTransactionsPage.tsx';
import { AdminAuditLogsPage } from './pages/admin/AdminAuditLogsPage.tsx';

import { PropertyExplorer } from './components/properties/PropertyExplorer.tsx';
import { PropertyDetail } from './components/properties/PropertyDetail.tsx';
import { LandlordDashboard } from './components/dashboard/LandlordDashboard.tsx';
import { CostEstimatorSection } from './components/home/CostEstimatorSection.tsx';

import { registerNavigate } from './router/navigation.ts';
import { useAppStore } from './store/useAppStore.ts';

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

        <Routes>
          {/* ---------- UNIFIED AUTHENTICATION PORTAL ---------- */}
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />

          {/* ---------- PUBLIC SHELL ---------- */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/properties" element={<PropertyExplorer />} />
            <Route path="/properties/:id" element={<PropertyDetail />} />
            <Route
              path="/estimator"
              element={
                <div className="pt-6">
                  <CostEstimatorSection />
                </div>
              }
            />

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

            <Route path="*" element={<NotFoundPage />} />
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
            <Route path="moderation" element={<AdminModerationPage />} />
            <Route path="transactions" element={<AdminTransactionsPage />} />
            <Route path="audit-logs" element={<AdminAuditLogsPage />} />
          </Route>
        </Routes>

        {/* Liquid Glass notifications — mounted at shell level so route guards
            and any nested page can raise alerts from anywhere. */}
        <NotificationToasts />
      </AuthProvider>
    </BrowserRouter>
  );
}
