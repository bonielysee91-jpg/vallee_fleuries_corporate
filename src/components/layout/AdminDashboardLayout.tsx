import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.tsx';
import { AdminNotificationBell } from '../dashboard/AdminNotificationBell.tsx';
import {
  ShieldCheck,
  Eye,
  ArrowLeft,
  LayoutDashboard,
  Users,
  MailPlus,
  FileCheck,
  Receipt,
  ScrollText
} from 'lucide-react';

const ADMIN_NAV = [
  { to: '/admin', label: 'Command Center', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Comptes & Rôles', icon: Users, end: false },
  { to: '/admin/invitations', label: 'Invitations', icon: MailPlus, end: false },
  { to: '/admin/moderation', label: 'Modération', icon: FileCheck, end: false },
  { to: '/admin/transactions', label: 'Transactions', icon: Receipt, end: false },
  { to: '/admin/audit-logs', label: "Journal d'audit", icon: ScrollText, end: false }
];

/**
 * Nested layout for the Super-Admin command center (`/admin/*`).
 */
export const AdminDashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  const { toggleAdminPreview } = useAuth();

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Top Admin Command Header */}
      <div className="bg-emerald-950 text-white border-b border-emerald-900 px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold border border-amber-400/40 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="font-bold text-sm text-white">VFC Command Center — Direction Abidjan</span>
            <span className="ml-2 text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-mono font-bold whitespace-nowrap">
              v4.0 NEON POSTGRESQL
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <AdminNotificationBell />

          <button
            onClick={() => {
              toggleAdminPreview();
              navigate('/');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-900 hover:bg-emerald-800 text-amber-400 text-xs font-bold transition-all border border-amber-400/30"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Aperçu Site Public</span>
          </button>

          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-medium transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sortir</span>
          </button>
        </div>
      </div>

      {/* Section navigation for the admin console */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/80 sticky top-0 z-30">
        <nav
          aria-label="Navigation centre de commandement"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1.5 overflow-x-auto py-2"
        >
          {ADMIN_NAV.map(({ to, label, icon: Icon, end }) => (
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
