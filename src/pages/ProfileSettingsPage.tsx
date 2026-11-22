import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../components/auth/useAuth.ts';
import { useAppStore } from '../store/useAppStore.ts';
import { api } from '../services/api.ts';
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
  Briefcase,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  Lock
} from 'lucide-react';

/** Champ mot de passe du navigateur : libellé, bascule d'affichage et aide contextuelle. */
const PasswordField: React.FC<{
  id: string;
  label: string;
  value: string;
  autoComplete: string;
  placeholder?: string;
  hint?: string;
  onChange: (value: string) => void;
}> = ({ id, label, value, autoComplete, placeholder, hint, onChange }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-700 mb-1">
        {label}
      </label>
      <div className="relative">
        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="w-full pl-9 pr-11 py-2.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-300 transition-shadow"
        />
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          aria-pressed={visible}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-emerald-900 hover:bg-emerald-50 transition-colors cursor-pointer"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {hint && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
};

/** Politique de mot de passe partagée avec la validation serveur (minimum 8 caractères). */
const MIN_PASSWORD_LENGTH = 8;

/**
 * Section « Changer le mot de passe » — réservée au compte connecté (administrateurs inclus).
 * Vérifie le mot de passe actuel côté serveur, applique la politique de longueur, confirme
 * la saisie puis re-hache le nouveau secret. La session en cours n'est pas interrompue.
 */
const ChangePasswordSection: React.FC = () => {
  const addNotification = useAppStore((state) => state.addNotification);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetFeedback = () => {
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    resetFeedback();

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setError('Tous les champs sont obligatoires');
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Le nouveau mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères`);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('La confirmation ne correspond pas au nouveau mot de passe');
      return;
    }
    if (newPassword === currentPassword) {
      setError("Le nouveau mot de passe doit être différent de l'actuel");
      return;
    }

    setIsSubmitting(true);
    try {
      const { message } = await api.changePassword({
        currentPassword,
        newPassword,
        confirmNewPassword
      });
      const confirmation = message || 'Mot de passe mis à jour avec succès';
      setSuccess(confirmation);
      addNotification(confirmation, 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      const failure = err?.message || 'Le changement de mot de passe a échoué';
      setError(failure);
      addNotification(failure, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="liquid-glass-card rounded-3xl p-6 border border-white/60">
      <div className="flex items-center gap-2">
        <span className="w-9 h-9 rounded-2xl bg-emerald-900 text-amber-400 flex items-center justify-center shrink-0">
          <KeyRound className="w-4 h-4" />
        </span>
        <div>
          <h2 className="font-serif text-base font-bold text-slate-900">Changer le mot de passe</h2>
          <p className="text-[11px] text-slate-500">
            Mettez à jour vos identifiants de connexion en toute sécurité.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
        <PasswordField
          id="current-password"
          label="Mot de passe actuel"
          value={currentPassword}
          autoComplete="current-password"
          placeholder="Votre mot de passe actuel"
          onChange={(value) => {
            setCurrentPassword(value);
            resetFeedback();
          }}
        />

        <div className="grid sm:grid-cols-2 gap-4">
          <PasswordField
            id="new-password"
            label="Nouveau mot de passe"
            value={newPassword}
            autoComplete="new-password"
            placeholder={`Au moins ${MIN_PASSWORD_LENGTH} caractères`}
            hint={`Minimum ${MIN_PASSWORD_LENGTH} caractères`}
            onChange={(value) => {
              setNewPassword(value);
              resetFeedback();
            }}
          />
          <PasswordField
            id="confirm-new-password"
            label="Confirmer le nouveau mot de passe"
            value={confirmNewPassword}
            autoComplete="new-password"
            placeholder="Répétez le nouveau mot de passe"
            onChange={(value) => {
              setConfirmNewPassword(value);
              resetFeedback();
            }}
          />
        </div>

        {error && (
          <p
            role="alert"
            className="flex items-center gap-2 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5"
          >
            <ShieldAlert className="w-4 h-4 shrink-0" />
            {error}
          </p>
        )}
        {success && !error && (
          <p
            role="status"
            className="flex items-center gap-2 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-emerald-900 text-white text-xs font-bold hover:bg-emerald-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Mise à jour…
            </>
          ) : (
            <>
              <KeyRound className="w-4 h-4 text-amber-400" />
              Mettre à jour le mot de passe
            </>
          )}
        </button>
      </form>
    </section>
  );
};

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

      <ChangePasswordSection />

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
