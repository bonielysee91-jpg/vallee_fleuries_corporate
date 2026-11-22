import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../components/auth/useAuth.ts';
import { useAppStore } from '../store/useAppStore.ts';
import { api } from '../services/api.ts';
import { landingPathForRole } from '../router/navigation.ts';
import {
  KeyRound,
  User as UserIcon,
  Smartphone,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Loader2,
  MailCheck,
  AlertTriangle
} from 'lucide-react';

/**
 * `/invitation` — activation publique d'une invitation administrateur.
 * L'invité(e) saisit le code reçu (préremplit via `?code=` dans le lien e-mail),
 * définit son accès, et rejoint directement le Command Center.
 */
export const InvitationAcceptPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const addNotification = useAppStore((state) => state.addNotification);

  const [code, setCode] = useState(searchParams.get('code') ?? '');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('+225 ');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const inputClass =
    'w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white/10 border border-white/20 text-sm text-white placeholder-emerald-100/40 outline-none transition-all focus:ring-2 focus:ring-[#D97706] focus:border-transparent';
  const labelClass = 'block text-[11px] font-semibold uppercase tracking-wider text-emerald-100/70 mb-1.5';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!code.trim()) {
      setErrorMessage("Le code d'invitation est requis");
      return;
    }
    if (password && password.length < 10) {
      setErrorMessage('Le mot de passe doit contenir au moins 10 caractères');
      return;
    }

    setLoading(true);
    try {
      const result = await api.acceptInvitation({
        code: code.trim(),
        fullName: fullName.trim() || undefined,
        password: password || undefined,
        phoneNumber: phoneNumber.trim() || undefined
      });
      login(result.user, result.token);
      addNotification('Invitation acceptée : bienvenue au Command Center', 'success');
      navigate(landingPathForRole(result.user.role), { replace: true });
    } catch (err: any) {
      setErrorMessage(err?.message || "Activation de l'invitation impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#064E3B] via-emerald-950 to-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-24 w-[28rem] h-[28rem] rounded-full bg-emerald-500/20 blur-[120px]" />
        <div className="absolute top-1/3 -right-32 w-[32rem] h-[32rem] rounded-full bg-[#D97706]/15 blur-[140px]" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-6">
            <span className="inline-flex items-center justify-center rounded-xl bg-white p-1 shadow-lg">
              <img
                src="/atar.jpg"
                alt="Vallées Fleuries Corporate"
                className="h-8 w-auto object-contain"
              />
            </span>
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="backdrop-blur-2xl bg-white/10 border border-white/20 shadow-2xl rounded-3xl p-6 sm:p-8"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-400/40 mb-4">
              <MailCheck className="w-6 h-6" />
            </div>
            <h1 className="font-serif text-2xl font-bold">Activer votre invitation</h1>
            <p className="mt-1.5 text-xs text-emerald-100/70">
              Saisissez le code reçu par e-mail pour ouvrir votre accès au Command Center.
            </p>

            {errorMessage && (
              <p className="mt-4 px-3.5 py-2.5 rounded-xl bg-rose-500/15 border border-rose-400/30 text-[11px] font-medium text-rose-100 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {errorMessage}
              </p>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className={labelClass} htmlFor="inv-code">
                  Code d'invitation
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-100/50" />
                  <input
                    id="inv-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="VFC-XXXXXXXXXXXX"
                    autoComplete="one-time-code"
                    className={`${inputClass} font-mono tracking-wider uppercase`}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass} htmlFor="inv-fullname">
                  Nom complet
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-100/50" />
                  <input
                    id="inv-fullname"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex : Awa Koné"
                    autoComplete="name"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass} htmlFor="inv-phone">
                  Numéro ivoirien
                </label>
                <div className="relative">
                  <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-100/50" />
                  <input
                    id="inv-phone"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+225 07 00 00 00 00"
                    autoComplete="tel"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass} htmlFor="inv-password">
                  Mot de passe (10 caractères minimum)
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-100/50" />
                  <input
                    id="inv-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
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
                    <span>Activer mon accès</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-4 flex items-center gap-1.5 text-[11px] text-emerald-100/60">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              Le code est à usage unique et expire au bout de 7 jours.
            </p>
          </motion.div>

          <p className="mt-5 text-center text-[11px] text-emerald-100/50">
            <Link to="/login" className="hover:text-white transition-colors">
              ← J'ai déjà un compte
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
