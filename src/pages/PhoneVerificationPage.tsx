import React, { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../components/auth/AuthProvider.tsx';
import { useAppStore } from '../store/useAppStore.ts';
import { api } from '../services/api.ts';
import { landingPathForRole } from '../router/navigation.ts';
import {
  Building2,
  KeyRound,
  Smartphone,
  ArrowRight,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  RotateCw
} from 'lucide-react';

interface VerificationState {
  phoneNumber?: string;
}

/**
 * `/verify-phone` — validation du numéro après une inscription self-service.
 * Le compte est créé au statut « non vérifié » ; l'accès n'est ouvert qu'une
 * fois le code à 6 chiffres (reçu par SMS) confirmé.
 */
export const PhoneVerificationPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, currentUser, isAuthenticated, isInitializing } = useAuth();
  const addNotification = useAppStore((state) => state.addNotification);

  const incoming = (location.state as VerificationState | null) ?? {};
  const phoneNumber = incoming.phoneNumber ?? '';

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Décompte anti-spam (en secondes) avant de pouvoir redemander un code.
  // Il démarre à 60 s car un premier code vient d'être envoyé à l'inscription.
  const [cooldown, setCooldown] = useState(60);

  const isCoolingDown = cooldown > 0;

  // Tick du décompte : décrémente chaque seconde jusqu'à zéro, puis réactive le bouton.
  useEffect(() => {
    if (!isCoolingDown) return;
    const timerId = setInterval(
      () => setCooldown((remaining) => (remaining > 0 ? remaining - 1 : 0)),
      1000
    );
    return () => clearInterval(timerId);
  }, [isCoolingDown]);

  // Déjà connecté : aucun besoin de repasser par la vérification.
  if (!isInitializing && isAuthenticated && currentUser) {
    return <Navigate to={landingPathForRole(currentUser.role)} replace />;
  }

  // Aucun numéro en attente : on renvoie vers l'inscription.
  if (!phoneNumber) {
    return <Navigate to="/register" replace />;
  }

  const inputClass =
    'w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white/10 border border-white/20 text-sm text-white placeholder-emerald-100/40 outline-none transition-all focus:ring-2 focus:ring-[#D97706] focus:border-transparent';
  const labelClass = 'block text-[11px] font-semibold uppercase tracking-wider text-emerald-100/70 mb-1.5';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    if (code.replace(/\D/g, '').length < 4) {
      setErrorMessage('Saisissez le code de validation reçu par SMS');
      return;
    }

    setLoading(true);
    try {
      const result = await api.verifyRegistration(phoneNumber, code.trim());
      login(result.user, result.token);
      addNotification('Numéro vérifié : bienvenue sur Vallées Fleuries Corporate', 'success');
      navigate(landingPathForRole(result.user.role), { replace: true });
    } catch (err: any) {
      if (err?.code === 'INVALID_CODE') {
        setErrorMessage('Code SMS incorrect ou expiré. Réessayez ou demandez un nouveau code.');
      } else {
        setErrorMessage(err?.message || 'Validation du code impossible');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (isCoolingDown) return;
    setErrorMessage(null);
    setResending(true);
    try {
      await api.resendRegistrationCode(phoneNumber);
      addNotification(`Nouveau code envoyé au ${phoneNumber}`, 'info');
      // Anti-spam : bloque le renvoi pendant 60 s après un envoi réussi.
      setCooldown(60);
    } catch (err: any) {
      setErrorMessage(err?.message || "Renvoi du code impossible");
    } finally {
      setResending(false);
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
            <span className="w-9 h-9 rounded-xl bg-white/10 border border-amber-400/40 backdrop-blur-xl flex items-center justify-center">
              <Building2 className="w-4 h-4 text-amber-400" />
            </span>
            <span className="font-serif text-base font-bold">Vallées Fleuries Corporate</span>
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="backdrop-blur-2xl bg-white/10 border border-white/20 shadow-2xl rounded-3xl p-6 sm:p-8"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-400/40 mb-4">
              <Smartphone className="w-6 h-6" />
            </div>
            <h1 className="font-serif text-2xl font-bold">Vérifiez votre numéro</h1>
            <p className="mt-1.5 text-xs text-emerald-100/70">
              Un code de validation à 6 chiffres a été envoyé par SMS au{' '}
              <strong className="text-amber-300">{phoneNumber}</strong>.
            </p>

            {errorMessage && (
              <p className="mt-4 px-3.5 py-2.5 rounded-xl bg-rose-500/15 border border-rose-400/30 text-[11px] font-medium text-rose-100 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {errorMessage}
              </p>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className={labelClass} htmlFor="verify-code">
                  Code reçu par SMS
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-100/50" />
                  <input
                    id="verify-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="000000"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="one-time-code"
                    className={`${inputClass} tracking-[0.4em] font-bold`}
                  />
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
                    <span>Valider mon numéro</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <button
              type="button"
              onClick={handleResend}
              disabled={resending || isCoolingDown}
              className="mt-4 w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-emerald-100/70 hover:text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {resending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCw className="w-3.5 h-3.5" />
              )}
              Renvoyer un nouveau code
              {isCoolingDown && <span className="tabular-nums">(Attendez {cooldown}s)</span>}
            </button>

            <p className="mt-4 flex items-center gap-1.5 text-[11px] text-emerald-100/60">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              Le code est à usage unique et expire au bout de 10 minutes.
            </p>
          </motion.div>

          <p className="mt-5 text-center text-[11px] text-emerald-100/50">
            <Link to="/login" className="hover:text-white transition-colors">
              ← Retour à la connexion
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
