import React, { useState } from 'react';
import { useAuth } from '../../components/auth/useAuth.ts';
import { useAppStore } from '../../store/useAppStore.ts';
import { api } from '../../services/api.ts';
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  Loader2,
  UserCog,
  Mail,
  Smartphone,
  Shield,
  Activity,
  Check,
  AlertTriangle
} from 'lucide-react';

const MIN_PASSWORD_LENGTH = 8;

/** Champ mot de passe avec contrôle de visibilité et icône */
const PasswordInput: React.FC<{
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  autoComplete?: string;
  hint?: string;
  onChange: (val: string) => void;
}> = ({ id, label, value, placeholder, autoComplete, hint, onChange }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-700 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-10 pr-11 py-2.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-300 transition-all font-mono"
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={visible ? 'Masquer' : 'Afficher'}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {hint && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
};

/** `/admin/settings` — Paramètres du compte et gestion sécurisée du mot de passe administrateur. */
export const AdminSettingsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const addNotification = useAppStore((state) => state.addNotification);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetMessages = () => {
    setError(null);
    setSuccess(null);
  };

  // Indicateurs de robustesse du mot de passe
  const hasMinLength = newPassword.length >= MIN_PASSWORD_LENGTH;
  const hasNumber = /\d/.test(newPassword);
  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmNewPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (!currentPassword) {
      setError('Veuillez saisir votre mot de passe actuel');
      return;
    }
    if (!newPassword) {
      setError('Veuillez définir un nouveau mot de passe');
      return;
    }
    if (!hasMinLength) {
      setError(`Le mot de passe doit comporter au moins ${MIN_PASSWORD_LENGTH} caractères`);
      return;
    }
    if (!hasLetter || !hasNumber) {
      setError('Le mot de passe doit combiner des lettres et des chiffres');
      return;
    }
    if (!confirmNewPassword) {
      setError('Veuillez confirmer votre nouveau mot de passe');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('La confirmation ne correspond pas au nouveau mot de passe');
      return;
    }
    if (currentPassword === newPassword) {
      setError("Le nouveau mot de passe doit être différent de l'actuel");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.changePassword({
        currentPassword,
        newPassword,
        confirmNewPassword
      });

      const message = res.message || 'Mot de passe administrateur mis à jour avec succès';
      setSuccess(message);
      addNotification(message, 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      const failure = err?.message || 'Échec de la modification du mot de passe';
      setError(failure);
      addNotification(failure, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-200">
      <header>
        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-800 block">
          Sécurité &amp; Droits d'Accès Super-Admin
        </span>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-emerald-950 mt-1">
          Paramètres du Compte Administrateur
        </h1>
        <p className="text-xs text-slate-600 mt-1">
          Gestion des identifiants d'accès au poste de commandement et politique de sécurité.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Admin Identity Summary & Security Specs */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-3xl bg-white border border-slate-200/90 shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-900 to-emerald-950 text-amber-400 font-bold text-xl flex items-center justify-center border-2 border-amber-400/40 shadow-inner">
                {currentUser?.fullName?.charAt(0) || 'A'}
              </div>
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black uppercase tracking-wider">
                  <ShieldCheck className="w-3 h-3 text-amber-600" />
                  {currentUser?.role || 'ADMINISTRATEUR'}
                </span>
                <h2 className="text-base font-bold text-slate-900 truncate mt-1">
                  {currentUser?.fullName || 'Administrateur VFC'}
                </h2>
                <p className="text-[11px] text-slate-500 font-mono">
                  ID: {currentUser?.id || '—'}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-2 text-slate-500">
                  <Mail className="w-3.5 h-3.5 text-emerald-700" />
                  E-mail :
                </span>
                <span className="font-semibold text-slate-900 font-mono">{currentUser?.email || 'Non renseigné'}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-2 text-slate-500">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
                  Téléphone :
                </span>
                <span className="font-semibold text-slate-900 font-mono">{currentUser?.phoneNumber || '—'}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-2 text-slate-500">
                  <Activity className="w-3.5 h-3.5 text-emerald-700" />
                  Session :
                </span>
                <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Active &amp; Vérifiée
                </span>
              </div>
            </div>
          </div>

          {/* Security Protocols Notice */}
          <div className="rounded-3xl bg-emerald-950 text-white p-6 shadow-md border border-emerald-900 space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-400" />
              <h3 className="font-serif text-sm font-bold text-white">
                Politique de Confidentialité &amp; Hachage
              </h3>
            </div>
            <p className="text-xs text-emerald-100/80 leading-relaxed">
              Les mots de passe ne sont jamais stockés en clair. Ils sont chiffrés à l'aide de l'algorithme
              PBKDF2 avec sel cryptographique unique.
            </p>
            <p className="text-xs text-emerald-100/80 leading-relaxed">
              Toute modification d'identifiant est inscrite de manière immuable au journal d'audit
              du Poste de Commandement VFC avec adresse IP et horodatage UTC.
            </p>
          </div>
        </div>

        {/* Right Column: Change Password Form */}
        <div className="lg:col-span-7">
          <section className="rounded-3xl bg-white border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-emerald-900 text-amber-400 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5" />
              </span>
              <div>
                <h2 className="font-serif text-lg font-bold text-slate-900">
                  Modifier le mot de passe Super-Admin
                </h2>
                <p className="text-xs text-slate-500">
                  Saisissez votre mot de passe actuel pour valider votre identité avant d'enregistrer le nouveau.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <PasswordInput
                id="admin-current-password"
                label="Mot de passe actuel"
                value={currentPassword}
                autoComplete="current-password"
                placeholder="Votre mot de passe actuel"
                onChange={(val) => {
                  setCurrentPassword(val);
                  resetMessages();
                }}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PasswordInput
                  id="admin-new-password"
                  label="Nouveau mot de passe"
                  value={newPassword}
                  autoComplete="new-password"
                  placeholder={`Minimum ${MIN_PASSWORD_LENGTH} caractères`}
                  hint="Au moins 8 caractères, lettres et chiffres"
                  onChange={(val) => {
                    setNewPassword(val);
                    resetMessages();
                  }}
                />

                <PasswordInput
                  id="admin-confirm-password"
                  label="Confirmer le nouveau mot de passe"
                  value={confirmNewPassword}
                  autoComplete="new-password"
                  placeholder="Répétez le nouveau mot de passe"
                  onChange={(val) => {
                    setConfirmNewPassword(val);
                    resetMessages();
                  }}
                />
              </div>

              {/* Password Policy Checks */}
              {newPassword.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-1.5">
                  <span className="font-semibold text-slate-500 block mb-1">Critères de sécurité :</span>
                  <div className="flex items-center gap-2">
                    {hasMinLength ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-300" />
                    )}
                    <span className={hasMinLength ? 'text-emerald-800 font-semibold' : 'text-slate-500'}>
                      Au moins 8 caractères
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasNumber && hasLetter ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-300" />
                    )}
                    <span className={hasNumber && hasLetter ? 'text-emerald-800 font-semibold' : 'text-slate-500'}>
                      Lettres et chiffres combinés
                    </span>
                  </div>
                  {confirmNewPassword.length > 0 && (
                    <div className="flex items-center gap-2">
                      {passwordsMatch ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                      )}
                      <span className={passwordsMatch ? 'text-emerald-800 font-semibold' : 'text-rose-600 font-semibold'}>
                        {passwordsMatch ? 'Les deux mots de passe correspondent' : 'Les mots de passe ne correspondent pas'}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="flex items-center gap-2.5 text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 rounded-2xl p-4 animate-in fade-in"
                >
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {success && !error && (
                <div
                  role="status"
                  className="flex items-center gap-2.5 text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 animate-in fade-in"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                      <span>Vérification &amp; Enregistrement…</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4 text-amber-400" />
                      <span>Enregistrer le nouveau mot de passe</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
};
