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
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';

/**
 * `/login` — écran de connexion autonome.
 * Méthode unique : identifiant + mot de passe (aucune vérification par SMS).
 * La création de compte vit sur `/register` (page distincte).
 */
export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, currentUser, isAuthenticated, isInitializing } = useAuth();
  const addNotification = useAppStore((state) => state.addNotification);

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

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
    addNotification(
      userRole === 'TENANT'
        ? 'Connexion réussie. Votre sélection locative vous attend.'
        : 'Bienvenue sur votre espace Vallées Fleuries Corporate',
      'success'
    );
    navigate(redirectTarget ?? landingPathForRole(userRole), { replace: true });
  };

  const resetFeedback = () => setErrorMessage(null);

  // Identifiant (email ou téléphone) + mot de passe
  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    resetFeedback();

    if (!identifier.trim() || !password) {
      setErrorMessage('Identifiant et mot de passe requis');
      return;
    }

    setLoading(true);
    try {
      const result = await api.loginWithPassword(identifier.trim(), password);
      login(result.user, result.token);
      finishAuthentication(result.user.role);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Connexion impossible. Vérifiez vos informations.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      footer={
        <p>
          Pas encore de compte ?{' '}
          <Link
            to="/register"
            state={location.state}
            className="font-semibold text-amber-400 hover:text-amber-300 transition-colors"
          >
            Créer un compte
          </Link>
        </p>
      }
    >
      <h2 className="font-serif text-2xl font-bold">Bon retour parmi nous</h2>
      <p className="mt-1.5 text-xs text-emerald-100/70">
        Connectez-vous avec votre identifiant et votre mot de passe.
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
          <label className={labelClass} htmlFor="identifier">
            Email ou téléphone +225
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-100/50" />
            <input
              id="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="vous@exemple.ci"
              autoComplete="username"
              className={inputClass}
            />
          </div>
        </div>

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
              autoComplete="current-password"
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
              <span>Se connecter</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
};
