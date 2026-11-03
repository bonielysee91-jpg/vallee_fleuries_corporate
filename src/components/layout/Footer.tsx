import React from 'react';
import { useAppStore } from '../../store/useAppStore.ts';
import { Building2, ShieldCheck, Phone, Mail, MapPin, ExternalLink } from 'lucide-react';
import { VFC_WHATSAPP_URL, VFC_WHATSAPP_DISPLAY } from '../../constants/contact.ts';

export const Footer: React.FC = () => {
  const { setView } = useAppStore();

  return (
    <footer className="bg-[#022C22] text-slate-300 pt-16 pb-12 border-t border-emerald-900/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 pb-12 border-b border-emerald-800/40">
          
          {/* Brand & Purpose */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-800 flex items-center justify-center text-amber-400">
                <Building2 className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white font-serif">
                Vallées Fleuries
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Plateforme SaaS de location immobilière de référence en Côte d'Ivoire. Courtage locatif institutionnel, sécurisation juridique des baux et conciergerie de prestige.
            </p>
            <div className="flex items-center gap-2 text-xs text-amber-400/90 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Agrément MCLU & Barreau d'Abidjan</span>
            </div>
          </div>

          {/* Hubs & Communes */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">
              Périmètres d'Intervention
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>Abidjan — Cocody, Plateau, Marcory, Yopougon, Riviera</li>
              <li>Yamoussoukro — Habitat & Centre Administratif</li>
              <li>Bouaké — Air France & Belleville</li>
              <li>Assinie — Mafia & France (bord de mer)</li>
            </ul>
          </div>

          {/* Solutions & Juridique */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">
              Services & Réglementation
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <button onClick={() => setView('properties')} className="hover:text-amber-400 transition-colors">
                  Locations Longue Durée (Baux 1 an+)
                </button>
              </li>
              <li>
                <button onClick={() => setView('properties')} className="hover:text-amber-400 transition-colors">
                  Résidences Meublées Courte Durée
                </button>
              </li>
              <li>
                <button onClick={() => setView('estimator')} className="hover:text-amber-400 transition-colors">
                  Calculateur Loi N° 2019-576 (Caution 2+2)
                </button>
              </li>
              <li>Vérification des Mandats Bailleurs</li>
              <li>Génération Sécurisée de Quittances de Loyer</li>
              <li>Paiements Wave, Orange Money & MTN MoMo</li>
            </ul>
          </div>

          {/* Direct Contact & Head Office */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">
              Siège Social & Contact
            </h4>
            <div className="space-y-3 text-xs text-slate-400">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Boulevard Hassan II, Immeuble Vallées Fleuries, Cocody, Abidjan</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{VFC_WHATSAPP_DISPLAY}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>contact@valleesfleuries.ci</span>
              </div>
              <div className="pt-2">
                <a
                  href={VFC_WHATSAPP_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-800/80 hover:bg-emerald-700 text-emerald-100 text-xs font-medium transition-colors"
                >
                  <span>Conciergerie WhatsApp Direct</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Quiet Sub-footer */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© 2026 Vallées Fleuries Corporate S.A.S. Tous droits réservés. R.C.M. CI-ABJ-2024-B-14209.</p>
          <div className="flex items-center gap-6">
            <span className="hover:text-slate-400 cursor-pointer">Conditions Générales</span>
            <span className="hover:text-slate-400 cursor-pointer">Barème Honoraires Agence</span>
            <span className="hover:text-slate-400 cursor-pointer">Confidentialité & Données</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
