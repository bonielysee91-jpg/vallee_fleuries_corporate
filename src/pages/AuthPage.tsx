import React, { useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../components/auth/AuthProvider.tsx';
import { useAppStore } from '../store/useAppStore.ts';
import { api } from '../services/api.ts';
import { UserRole } from '../types/index.ts';
import { landingPathForRole } from '../router/navigation.ts';
import {
  Building2,
  Mail,
  Lock,
  User as UserIcon,
  Smartphone,
  KeyRound,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Loader2,
  Sparkles,
  Briefcase
} from 'lucide-react';

type AuthMethod = 'PASSWORD' | 'OTP';

interface AuthPageProps {
  mode: 'login' | 'register';
}

const SOCIAL_PROOF: string[] = [
  'Baux certifiés Loi CI 2019-576',
  'Paiement Wave · Orange · MTN · Moov',
  'Quittances numériques vérifiables'
];

export const AuthPage: React.FC<AuthPageProps> = ({ mode }) => {
  const isRegister = mode === 'register';
  const navigate = useNavigate();
  const location = useLocation();
  const { login, currentUser, isAuthenticated, isInitializing } = useAuth();
  const addNotification = useAppStore((state) => state.addNotification);

  const [method, setMethod] = useState<AuthMethod>('PASSWORD');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Unified field set for both login and registration.
  const [identifier, setIdentifier] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('+225 ');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState<UserRole>('TENANT');

  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  const redirectTarget = useMemo(() => {
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    if (from && from !== '/login' && from !== '/register') return from;
    return null;
  }, [location.state]);

  // Already authenticated visitors never see the portal twice.
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

  // 1. Email / phone + password
  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    resetFeedback();

    if (isRegister) {
      if (!fullName.trim() || phoneNumber.trim().length < 8) {
        setErrorMessage('Nom complet et numéro de téléphone (+225) requis');
        return;
      }
      if (password.length < 8) {
        setErrorMessage('Le mot de passe doit contenir au moins 8 caractères');
        return;
      }
    } else if (!identifier.trim() || !password) {
      setErrorMessage('Identifiant et mot de passe requis');
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        // Création du compte (statut « non vérifié ») puis envoi automatique du
        // code SMS. La session n'est ouverte qu'après validation du code.
        const result = await api.registerUser({
          fullName: fullName.trim(),
          phoneNumber: phoneNumber.trim(),
          email: identifier.trim() || undefined,
          password,
          role,
          companyName: role === 'OWNER' ? companyName.trim() || undefined : undefined
        });
        addNotification(`Code de validation envoyé au ${result.phoneNumber}`, 'info');
        navigate('/verify-phone', {
          state: { phoneNumber: result.phoneNumber, devOtpCode: result.devOtpCode }
        });
        return;
      }

      const result = await api.loginWithPassword(identifier.trim(), password);
      login(result.user, result.token);
      finishAuthentication(result.user.role);
    } catch (err: any) {
      // Compte créé mais numéro non encore vérifié : on enchaîne sur la page dédiée.
      if (err?.code === 'PHONE_NOT_VERIFIED') {
        const pendingPhone =
          (err.payload as { phoneNumber?: string } | undefined)?.phoneNumber || '';
        navigate('/verify-phone', { state: { phoneNumber: pendingPhone } });
        return;
      }
      setErrorMessage(err?.message || 'Authentification impossible. Vérifiez vos informations.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Send the +225 SMS OTP
  const handleSendOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    resetFeedback();

    if (phoneNumber.replace(/\D/g, '').length < 8) {
      setErrorMessage('Veuillez saisir un numéro ivoirien valide (+225)');
      return;
    }
    if (isRegister && !fullName.trim()) {
      setErrorMessage('Votre nom complet est requis pour créer le compte');
      return;
    }

    setLoading(true);
    try {
      const res = await api.sendSmsOtp(phoneNumber.trim());
      setOtpSent(true);
      if (res.devOtpCode) {
        setDevOtpHint(res.devOtpCode);
      }
      addNotification(`Code de sécurité envoyé au ${phoneNumber.trim()}`, 'info');
    } catch (err: any) {
      setErrorMessage(err?.message || "Envoi du code SMS impossible");
    } finally {
      setLoading(false);
    }
  };

  // 3. Verify the OTP (creates the account on first use)
  const handleVerifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    resetFeedback();

    if (otpCode.replace(/\D/g, '').length < 4) {
      setErrorMessage('Saisissez le code de validation reçu par SMS');
      return;
    }

    setLoading(true);
    try {
      const result = await api.verifySmsOtp(
        phoneNumber.trim(),
        otpCode.trim(),
        fullName.trim() || undefined,
        role
      );
      login(result.user, result.token);
      finishAuthentication(result.user.role);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Code SMS incorrect ou expiré');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white/10 dark:bg-emerald-950/40 border border-white/20 text-sm text-white placeholder-emerald-100/40 outline-none transition-all focus:ring-2 focus:ring-[#D97706] focus:border-transparent';
  const labelClass = 'block text-[11px] font-semibold uppercase tracking-wider text-emerald-100/70 mb-1.5';

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#064E3B] via-emerald-950 to-slate-950 text-white">
      {/* Ambient glowing light effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-24 w-[28rem] h-[28rem] rounded-full bg-emerald-500/20 blur-[120px]" />
        <div className="absolute top-1/3 -right-32 w-[32rem] h-[32rem] rounded-full bg-[#D97706]/15 blur-[140px]" />
        <div className="absolute -bottom-40 left-1/3 w-[26rem] h-[26rem] rounded-full bg-emerald-400/10 blur-[120px]" />
      </div>

      <div className="relative z-10 min-h-screen grid lg:grid-cols-2">
        {/* Editorial brand column (desktop) */}
        <div className="hidden lg:flex flex-col justify-between p-14">
          <Link to="/" className="inline-flex items-center gap-3 group">
            <span className="w-11 h-11 rounded-2xl bg-white/10 border border-amber-400/40 backdrop-blur-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-amber-400" />
            </span>
            <span className="leading-tight">
              <span className="block font-serif text-lg font-bold">Vallées Fleuries</span>
              <span className="block text-[10px] font-black uppercase tracking-[0.28em] text-amber-400">
                Corporate
              </span>
            </span>
          </Link>

          <div className="max-w-md">
            <h1 className="font-serif text-4xl xl:text-5xl font-bold leading-tight">
              La location immobilière
              <span className="block text-amber-400">d'exception à Abidjan</span>
            </h1>
            <p className="mt-5 text-sm text-emerald-100/75 leading-relaxed">
              Plateforme exclusivement dédiée à la vente et à la location longue durée de biens
              vérifiés. Un portail unique pour les locataires, les propriétaires et la Direction Générale.
            </p>

            <ul className="mt-8 space-y-3">
              {SOCIAL_PROOF.map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-xs text-emerald-100/80">
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[11px] text-emerald-100/40">
            © {new Date().getFullYear()} Vallées Fleuries Corporate · Abidjan, Côte d'Ivoire
          </p>
        </div>

        {/* Auth portal */}
        <div className="flex items-center justify-center p-5 sm:p-8 lg:p-14">
          <div className="w-full max-w-md">
            {/* Mobile brand mark */}
            <Link to="/" className="lg:hidden inline-flex items-center gap-2.5 mb-6">
              <span className="w-9 h-9 rounded-xl bg-white/10 border border-amber-400/40 backdrop-blur-xl flex items-center justify-center">
                <Building2 className="w-4 h-4 text-amber-400" />
              </span>
              <span className="font-serif text-base font-bold">Vallées Fleuries Corporate</span>
            </Link>

            <div className="backdrop-blur-2xl bg-white/10 dark:bg-emerald-950/40 border border-white/20 shadow-2xl rounded-3xl p-6 sm:p-8">
              {/* Login / Register segmented control */}
              <div className="relative grid grid-cols-2 gap-1 p-1 mb-6 rounded-2xl bg-emerald-950/40 border border-white/10">
                {(['login', 'register'] as const).map((tab) => {
                  const active = (tab === 'register') === isRegister;
                  return (
                    <Link
                      key={tab}
                      to={tab === 'login' ? '/login' : '/register'}
                      state={location.state}
                      className={`relative z-10 py-2.5 text-center text-xs font-bold rounded-xl transition-colors ${
                        active ? 'text-emerald-950' : 'text-emerald-100/70 hover:text-white'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="auth-segment"
                          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                          className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-r from-amber-300 to-[#D97706] shadow-lg"
                        />
                      )}
                      {tab === 'login' ? 'Connexion' : 'Inscription'}
                    </Link>
                  );
                })}
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${mode}-${method}`}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                >
                  <h2 className="font-serif text-2xl font-bold">
                    {isRegister ? 'Créer votre accès' : 'Bon retour parmi nous'}
                  </h2>
                  <p className="mt-1.5 text-xs text-emerald-100/70">
                    {isRegister
                      ? 'Un seul compte pour louer, publier ou administrer.'
                      : 'Email, mot de passe ou code SMS +225 au choix.'}
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
                      {isRegister && (
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
                      )}

                      <div>
                        <label className={labelClass} htmlFor="identifier">
                          {isRegister ? 'Email (optionnel)' : 'Email ou téléphone +225'}
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-100/50" />
                          <input
                            id="identifier"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            placeholder={
                              isRegister ? 'awa.kone@exemple.ci' : 'vous@exemple.ci'
                            }
                            autoComplete={isRegister ? 'email' : 'username'}
                            className={inputClass}
                          />
                        </div>
                      </div>

                      {isRegister && (
                        <>
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
                        </>
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
                            autoComplete={isRegister ? 'new-password' : 'current-password'}
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
                            <span>{isRegister ? 'Créer mon compte' : 'Se connecter'}</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </form>
                  ) : (
                    <form
                      onSubmit={otpSent ? handleVerifyOtp : handleSendOtp}
                      className="mt-5 space-y-4"
                    >
                      {isRegister && (
                        <div>
                          <label className={labelClass} htmlFor="otpFullName">
                            Nom complet
                          </label>
                          <div className="relative">
                            <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-100/50" />
                            <input
                              id="otpFullName"
                              value={fullName}
                              onChange={(e) => setFullName(e.target.value)}
                              placeholder="Ex : Awa Koné"
                              className={inputClass}
                            />
                          </div>
                        </div>
                      )}

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

                          {devOtpHint && (
                            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-300/90">
                              <Sparkles className="w-3.5 h-3.5" />
                              Environnement de test — code : <strong>{devOtpHint}</strong>
                            </p>
                          )}

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
            </div>

            <p className="mt-5 text-center text-[11px] text-emerald-100/50">
              <Link to="/" className="hover:text-white transition-colors">
                ← Retour au catalogue locatif
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
