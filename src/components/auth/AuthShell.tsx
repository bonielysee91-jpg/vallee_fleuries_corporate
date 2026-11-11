import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, ShieldCheck } from 'lucide-react';

/** Arguments de valeur répétés sur les deux écrans du portail. */
const SOCIAL_PROOF: string[] = [
  'Baux certifiés Loi CI 2019-576',
  'Paiement Wave · Orange · MTN · Moov',
  'Quittances numériques vérifiables'
];

/** Habillage commun des champs de saisie du portail (style « Liquid Glass »). */
export const authInputClass =
  'w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white/10 dark:bg-emerald-950/40 border border-white/20 text-sm text-white placeholder-emerald-100/40 outline-none transition-all focus:ring-2 focus:ring-[#D97706] focus:border-transparent';

/** Habillage commun des libellés de champ. */
export const authLabelClass =
  'block text-[11px] font-semibold uppercase tracking-wider text-emerald-100/70 mb-1.5';

interface AuthShellProps {
  /** Formulaire affiché dans la carte d'authentification. */
  children: React.ReactNode;
  /** Lien croisé vers l'autre écran du portail (connexion ⇄ inscription). */
  footer?: React.ReactNode;
}

/**
 * Coquille strictement présentationnelle partagée par `/login` et `/register` :
 * colonne éditoriale de marque (bureau) et panneau « Liquid Glass » côté formulaire.
 * Elle évite de dupliquer l'habillage entre les deux pages distinctes.
 */
export const AuthShell: React.FC<AuthShellProps> = ({ children, footer }) => {
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
              {children}
            </div>

            <div className="mt-5 space-y-2 text-center text-[11px] text-emerald-100/50">
              {footer}
              <p>
                <Link to="/" className="hover:text-white transition-colors">
                  ← Retour au catalogue locatif
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
