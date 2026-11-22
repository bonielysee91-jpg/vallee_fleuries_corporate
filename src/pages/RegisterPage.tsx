import React, { useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../components/auth/useAuth.ts';
import { useAppStore } from '../store/useAppStore.ts';
import { api } from '../services/api.ts';
import { UserRole } from '../types/index.ts';
import { landingPathForRole } from '../router/navigation.ts';
import {
  AuthShell,
  authInputClass as inputClass,
  authLabelClass as labelClass
} from '../components/auth/AuthShell.tsx';
import {
  Building2,
  Mail,
  Lock,
  User as UserIcon,
  Smartphone,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  Briefcase
} from 'lucide-react';

/**
 * `/register` — écran d'inscription autonome.
 * Crée un compte actif immédiatement (aucune vérification par SMS) et ouvre
 * la session dès la création. La connexion vit sur `/login` (page distincte).
 */
export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, currentUser, isAuthenticated, isInitializing } = useAuth();
  const addNotification = useAppStore((state) => state.addNotification);

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [identifier, setIdentifier] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('+225 ');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState<UserRole>('TENANT');

  const redirectTarget = useMemo(() => {
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    if (from && from !== '/login' && from !== '/register') return from;
    return null;
  }, [location.state]);

  // Un visiteur déjà authentifié ne revoit jamais le portail.
  if (!isInitializing && isAuthenticated && currentUser) {
    return <Navigate to={redirectTarget ?? landingPathForRole(currentUser.role)} replace />;
  }

  const finishAuthentication = (userRole: UserRole) => {
    addNotification('Bienvenue sur votre espace Vallées Fleuries Corporate', 'success');
    navigate(redirectTarget ?? landingPathForRole(userRole), { replace: true });
  };

  const resetFeedback = () => setErrorMessage(null);

  // Nom + téléphone (+ email + mot de passe) : la session s'ouvre immédiatement.
  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    resetFeedback();

    if (!fullName.trim() || phoneNumber.trim().length < 8) {
      setErrorMessage('Nom complet et numéro de téléphone (+225) requis');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    setLoading(true);
    try {
      const result = await api.registerUser({
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        email: identifier.trim() || undefined,
        password,
        role,
        companyName: role === 'OWNER' ? companyName.trim() || undefined : undefined
      });
      login(result.user, result.token);
      finishAuthentication(result.user.role);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Création du compte impossible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      footer={
        <p>
          Déjà inscrit ?{' '}
          <Link
            to="/login"
            state={location.state}
            className="font-semibold text-amber-400 hover:text-amber-300 transition-colors"
          >
            Se connecter
          </Link>
        </p>
      }
    >
      <h2 className="font-serif text-2xl font-bold">Créer votre accès</h2>
      <p className="mt-1.5 text-xs text-emerald-100/70">
        Un seul compte pour louer, publier ou administrer.
      </p>

      {/* Error feedback */}
      <AnimatePresence>
        {errorMessage && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 px-3.5 py-2.5 rounded-xl bg-rose-500/15 border border-rose-400/30 text-[11px] font-medium text-rose-100"
          >
            {errorMessage}
          </motion.p>
        )}
      </AnimatePresence>

      <form onSubmit={handlePasswordSubmit} className="mt-5 space-y-4">
        <div>
          <label className={labelClass} htmlFor="fullName">
            Nom complet
          </label>
          <div className="relative">
            <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-100/50" />
            <input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex : Awa Koné"
              autoComplete="name"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="identifier">
            Email (optionnel)
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-100/50" />
            <input
              id="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="awa.kone@exemple.ci"
              autoComplete="email"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="phone">
            Téléphone ivoirien
          </label>
          <div className="relative">
            <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-100/50" />
            <input
              id="phone"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+225 07 00 00 00 00"
              autoComplete="tel"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="role">
            Votre profil
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRole('TENANT')}
              className={`flex items-center justify-center gap-2 py-3 rounded-2xl border text-[11px] font-bold transition-all ${
                role === 'TENANT'
                  ? 'bg-white/15 border-[#D97706] text-white'
                  : 'bg-white/5 border-white/15 text-emerald-100/60 hover:text-white'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              Locataire
            </button>
            <button
              type="button"
              onClick={() => setRole('OWNER')}
              className={`flex items-center justify-center gap-2 py-3 rounded-2xl border text-[11px] font-bold transition-all ${
                role === 'OWNER'
                  ? 'bg-white/15 border-[#D97706] text-white'
                  : 'bg-white/5 border-white/15 text-emerald-100/60 hover:text-white'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              Propriétaire
            </button>
          </div>
        </div>

        {role === 'OWNER' && (
          <div>
            <label className={labelClass} htmlFor="companyName">
              Agence / Société (optionnel)
            </label>
            <div className="relative">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-100/50" />
              <input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ex : Groupe Brou Immobilier CI"
                className={inputClass}
              />
            </div>
          </div>
        )}

        <div>
          <label className={labelClass} htmlFor="password">
            Mot de passe
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-100/50" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              className={`${inputClass} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-100/50 hover:text-white transition-colors"
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-[#D97706] text-emerald-950 text-sm font-black tracking-wide shadow-lg shadow-amber-900/30 hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <span>Créer mon compte</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
};
