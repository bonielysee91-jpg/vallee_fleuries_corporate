import React, { useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../components/auth/AuthProvider.tsx';
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
  Mail,
  Lock,
  Smartphone,
  KeyRound,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2
} from 'lucide-react';

type AuthMethod = 'PASSWORD' | 'OTP';

/**
 * `/login` — écran de connexion autonome.
 * Deux méthodes au choix : identifiant + mot de passe, ou code SMS +225.
 * La création de compte vit désormais sur `/register` (page distincte).
 */
export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, currentUser, isAuthenticated, isInitializing } = useAuth();
  const addNotification = useAppStore((state) => state.addNotification);

  const [method, setMethod] = useState<AuthMethod>('PASSWORD');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [identifier, setIdentifier] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('+225 ');
  const [password, setPassword] = useState('');

  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');

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

  // 1. Email / téléphone + mot de passe
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
      // Compte existant mais numéro non encore vérifié : on enchaîne sur la page dédiée.
      if (err?.code === 'PHONE_NOT_VERIFIED') {
        const pendingPhone =
          (err.payload as { phoneNumber?: string } | undefined)?.phoneNumber || '';
        navigate('/verify-phone', { state: { phoneNumber: pendingPhone } });
        return;
      }
      setErrorMessage(err?.message || 'Connexion impossible. Vérifiez vos informations.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Envoi du code SMS +225
  const handleSendOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    resetFeedback();

    if (phoneNumber.replace(/\D/g, '').length < 8) {
      setErrorMessage('Veuillez saisir un numéro ivoirien valide (+225)');
      return;
    }

    setLoading(true);
    try {
      await api.sendSmsOtp(phoneNumber.trim());
      setOtpSent(true);
      addNotification(`Code de sécurité envoyé au ${phoneNumber.trim()}`, 'info');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Envoi du code SMS impossible');
    } finally {
      setLoading(false);
    }
  };

  // 3. Validation du code SMS
  const handleVerifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    resetFeedback();

    if (otpCode.replace(/\D/g, '').length < 4) {
      setErrorMessage('Saisissez le code de validation reçu par SMS');
      return;
    }

    setLoading(true);
    try {
      const result = await api.verifySmsOtp(phoneNumber.trim(), otpCode.trim());
      login(result.user, result.token);
      finishAuthentication(result.user.role);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Code SMS incorrect ou expiré');
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
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={method}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -14 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="font-serif text-2xl font-bold">Bon retour parmi nous</h2>
          <p className="mt-1.5 text-xs text-emerald-100/70">
            Identifiant + mot de passe, ou code SMS +225 au choix.
          </p>

          {/* Auth method switch */}
          <div className="mt-5 flex items-center gap-2 p-1 rounded-2xl bg-emerald-950/40 border border-white/10">
            <button
              type="button"
              onClick={() => {
                setMethod('PASSWORD');
                setOtpSent(false);
                resetFeedback();
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-all ${
                method === 'PASSWORD'
                  ? 'bg-white/15 text-white shadow-inner'
                  : 'text-emerald-100/60 hover:text-white'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              Mot de passe
            </button>
            <button
              type="button"
              onClick={() => {
                setMethod('OTP');
                resetFeedback();
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-all ${
                method === 'OTP'
                  ? 'bg-white/15 text-white shadow-inner'
                  : 'text-emerald-100/60 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Code SMS +225
            </button>
          </div>

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

          {method === 'PASSWORD' ? (
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
          ) : (
            <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} className="mt-5 space-y-4">
              <div>
                <label className={labelClass} htmlFor="otpPhone">
                  Numéro ivoirien
                </label>
                <div className="relative">
                  <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-100/50" />
                  <input
                    id="otpPhone"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+225 07 00 00 00 00"
                    autoComplete="tel"
                    disabled={otpSent}
                    className={`${inputClass} disabled:opacity-60`}
                  />
                </div>
              </div>

              {otpSent && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <label className={labelClass} htmlFor="otpCode">
                    Code reçu par SMS
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-100/50" />
                    <input
                      id="otpCode"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="000000"
                      inputMode="numeric"
                      maxLength={6}
                      autoComplete="one-time-code"
                      className={`${inputClass} tracking-[0.4em] font-bold`}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setOtpCode('');
                      resetFeedback();
                    }}
                    className="mt-2 text-[11px] font-semibold text-emerald-100/60 hover:text-white transition-colors"
                  >
                    Modifier le numéro
                  </button>
                </motion.div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-[#D97706] text-emerald-950 text-sm font-black tracking-wide shadow-lg shadow-amber-900/30 hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>{otpSent ? 'Valider et continuer' : 'Recevoir mon code'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </motion.div>
      </AnimatePresence>
    </AuthShell>
  );
};
