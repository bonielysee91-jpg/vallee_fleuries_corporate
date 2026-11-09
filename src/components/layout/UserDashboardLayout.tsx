import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.tsx';
import {
  Building2,
  ArrowLeft,
  LayoutDashboard,
  PlusCircle,
  Settings2,
  CalendarDays,
  Receipt
} from 'lucide-react';

const LANDLORD_NAV = [
  { to: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/dashboard/properties/new', label: 'Publier un bien', icon: PlusCircle, end: false },
  { to: '/dashboard/properties/manage', label: 'Mes biens', icon: Settings2, end: false },
  { to: '/dashboard/calendar', label: 'Disponibilités', icon: CalendarDays, end: false },
  { to: '/dashboard/receipts', label: 'Quittances', icon: Receipt, end: false }
];

/**
 * Nested layout for the landlord / agency workspace (`/dashboard/*`).
 * Renders the contextual banner + section nav, then the matched child route.
 */
export const UserDashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Top Banner for Landlord / Owner Workspace */}
      <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-900 text-white px-6 py-4 border-b border-emerald-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-emerald-950 flex items-center justify-center font-bold shadow-md shrink-0">
              <Building2 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold font-serif leading-tight truncate">
                Espace Propriétaire & Gestion Locative
              </h1>
              <p className="text-xs text-amber-300 font-medium truncate">
                {currentUser?.companyName || currentUser?.fullName} · Portefeuille Abidjan
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Catalogue Public</span>
          </button>
        </div>
      </div>

      {/* Section navigation for the landlord workspace */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/80 sticky top-0 z-30">
        <nav
          aria-label="Navigation espace propriétaire"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1.5 overflow-x-auto py-2"
        >
          {LANDLORD_NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-emerald-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-emerald-900 hover:bg-emerald-50'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Matched child route */}
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
};
