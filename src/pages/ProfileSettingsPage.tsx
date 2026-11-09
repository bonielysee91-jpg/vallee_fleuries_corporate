import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthProvider.tsx';
import {
  BadgeCheck,
  Building2,
  Heart,
  LogOut,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Mail,
  CalendarDays,
  KeyRound,
  Briefcase
} from 'lucide-react';

/** `/profile/settings` — personal profile, role and session security. */
export const ProfileSettingsPage: React.FC = () => {
  const { currentUser, role, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  if (!currentUser) return null;

  const isLandlord = role === 'OWNER' || role === 'AGENT' || role === 'ADMIN' || role === 'SUPER_ADMIN';
  const isSuperAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

  const initials = currentUser.fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  const details = [
    { icon: Mail, label: 'Adresse email', value: currentUser.email },
    { icon: Smartphone, label: 'Téléphone', value: currentUser.phoneNumber },
    {
      icon: CalendarDays,
      label: 'Membre depuis',
      value: new Date(currentUser.createdAt).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      })
    },
    { icon: KeyRound, label: 'Rôle plateforme', value: currentUser.role }
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900">
          Profil & sécurité
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Informations de votre compte Vallées Fleuries Corporate.
        </p>
      </header>

      {/* Identity card */}
      <section className="liquid-glass-card rounded-3xl p-6 border border-white/60">
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-900 to-emerald-700 text-amber-400 font-serif text-xl font-bold flex items-center justify-center border border-amber-400/40">
            {initials || 'VF'}
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-lg font-bold text-slate-900">{currentUser.fullName}</h2>
              {currentUser.isKycVerified ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-black uppercase">
                  <BadgeCheck className="w-3 h-3" />
                  Vérifié
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase">
                  <ShieldAlert className="w-3 h-3" />
                  En attente KYC
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {currentUser.companyName || 'Particulier'} · Portefeuille Abidjan
            </p>
          </div>
        </div>

        <dl className="mt-6 grid sm:grid-cols-2 gap-3">
          {details.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3"
            >
              <item.icon className="w-4 h-4 text-emerald-800 shrink-0" />
              <div className="min-w-0">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {item.label}
                </dt>
                <dd className="text-xs font-bold text-slate-900 truncate">{item.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </section>

      {/* Quick access */}
      <section className="grid sm:grid-cols-3 gap-4">
        <Link
          to="/my-rentals"
          className="liquid-glass-card rounded-3xl p-5 border border-white/60 flex items-center gap-3"
        >
          <span className="w-10 h-10 rounded-2xl bg-emerald-900 text-amber-400 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </span>
          <span className="text-xs font-bold text-slate-800">Mes locations</span>
        </Link>

        <Link
          to="/favorites"
          className="liquid-glass-card rounded-3xl p-5 border border-white/60 flex items-center gap-3"
        >
          <span className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
            <Heart className="w-5 h-5" />
          </span>
          <span className="text-xs font-bold text-slate-800">Mes favoris</span>
        </Link>

        {isLandlord ? (
          <Link
            to="/dashboard"
            className="liquid-glass-card rounded-3xl p-5 border border-white/60 flex items-center gap-3"
          >
            <span className="w-10 h-10 rounded-2xl bg-amber-400 text-emerald-950 flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </span>
            <span className="text-xs font-bold text-slate-800">Espace Propriétaire</span>
          </Link>
        ) : (
          <Link
            to="/properties"
            className="liquid-glass-card rounded-3xl p-5 border border-white/60 flex items-center gap-3"
          >
            <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </span>
            <span className="text-xs font-bold text-slate-800">Catalogue locatif</span>
          </Link>
        )}
      </section>

      {isSuperAdmin && (
        <Link
          to="/admin"
          className="block rounded-3xl p-5 bg-gradient-to-r from-emerald-950 to-emerald-900 border border-amber-400/40 text-white flex items-center justify-between"
        >
          <span className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <span className="text-xs font-bold">
              Accéder au Centre de Commandement Super-Admin
            </span>
          </span>
          <span className="text-[10px] font-black uppercase tracking-wide text-amber-400">
            Role.ADMIN
          </span>
        </Link>
      )}

      {/* Session security */}
      <section className="liquid-glass-card rounded-3xl p-6 border border-white/60">
        <h2 className="font-serif text-base font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-800" />
          Sécurité de la session
        </h2>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          Votre accès repose sur un jeton JWT de courte durée (1 heure) renouvelé par un cookie
          httpOnly révocable côté serveur. Chaque connexion est journalisée dans Neon PostgreSQL
          pour la Direction Générale.
        </p>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors disabled:opacity-60"
        >
          <LogOut className="w-4 h-4" />
          {loggingOut ? 'Déconnexion…' : 'Se déconnecter de tous mes appareils'}
        </button>
      </section>
    </div>
  );
};
