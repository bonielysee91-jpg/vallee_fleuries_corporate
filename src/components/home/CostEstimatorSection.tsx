import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore.ts';
import { api, formatFcfa } from '../../services/api.ts';
import { MoveInCostBreakdown } from '../../types/index.ts';
import { Calculator, ShieldCheck, Info, ArrowRight, Check } from 'lucide-react';

export const CostEstimatorSection: React.FC = () => {
  const { setFilters, setView } = useAppStore();
  const [monthlyRent, setMonthlyRent] = useState(1500000);
  const [advanceMonths, setAdvanceMonths] = useState(2);
  const [depositMonths, setDepositMonths] = useState(2);
  const [agencyFeeMonths, setAgencyFeeMonths] = useState(1);
  const [keyMoney, setKeyMoney] = useState(0);
  const [breakdown, setBreakdown] = useState<MoveInCostBreakdown | null>(null);

  useEffect(() => {
    api.calculateMoveInCost(monthlyRent, advanceMonths, depositMonths, agencyFeeMonths, keyMoney)
      .then(setBreakdown);
  }, [monthlyRent, advanceMonths, depositMonths, agencyFeeMonths, keyMoney]);

  return (
    <section id="cost-estimator" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        
        {/* Left Column: Context & Legal Explanation */}
        <div className="lg:col-span-5 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs font-bold">
            <Calculator className="w-3.5 h-3.5 text-emerald-700" />
            <span>Simulateur Réglementaire Côte d'Ivoire</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold text-emerald-950 font-serif leading-tight">
            Anticipez exactement votre décaissement initial.
          </h2>

          <p className="text-sm text-slate-600 leading-relaxed">
            En Côte d'Ivoire, la signature d'un bail d'habitation est strictement encadrée par la <strong className="text-emerald-950">Loi N° 2019-576 du 26 juin 2019</strong>. Le législateur plafonne l'avance de loyer à deux (2) mois et le dépôt de garantie (caution) à deux (2) mois.
          </p>

          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-slate-200/80 shadow-sm">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold text-slate-900 block">Plafonnement 2+2 Garanti</span>
                <span className="text-slate-500">Aucune surfacturation d'avance illégale sur les biens labellisés Vallées Fleuries Corporate.</span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-slate-200/80 shadow-sm">
              <Check className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold text-slate-900 block">Honoraires d'Agence Réglementés</span>
                <span className="text-slate-500">Honoraires forfaitaires équivalents à 1 mois de loyer hors charges.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Liquid Glass Interactive Calculator Card */}
        <div className="lg:col-span-7">
          <div className="liquid-glass-card bg-white/90 rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/60 space-y-6">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-emerald-950 font-serif">
                  Calculateur de Frais d'Emménagement
                </h3>
                <p className="text-xs text-slate-500">
                  Modifiez les paramètres ci-dessous pour actualiser le budget initial
                </p>
              </div>
              <div className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200/60 rounded-lg text-xs font-bold">
                Devise : FCFA (XOF)
              </div>
            </div>

            {/* Slider: Monthly Rent */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700">Loyer Mensuel Souhaité :</span>
                <span className="font-mono font-extrabold text-base text-emerald-900">
                  {formatFcfa(monthlyRent)} / mois
                </span>
              </div>
              <input
                type="range"
                min="200000"
                max="8000000"
                step="50000"
                value={monthlyRent}
                onChange={(e) => setMonthlyRent(Number(e.target.value))}
                className="w-full accent-emerald-700 cursor-pointer h-2 bg-slate-200 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>200 000 FCFA</span>
                <span>4 000 000 FCFA</span>
                <span>8 000 000 FCFA</span>
              </div>
            </div>

            {/* Configurable terms */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                <label className="block text-[11px] font-bold text-slate-500 uppercase">
                  Avance de loyer
                </label>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs font-bold text-slate-800">{advanceMonths} mois (légal)</span>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                <label className="block text-[11px] font-bold text-slate-500 uppercase">
                  Dépôt de garantie (Caution)
                </label>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs font-bold text-slate-800">{depositMonths} mois (légal)</span>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                <label className="block text-[11px] font-bold text-slate-500 uppercase">
                  Honoraires agence
                </label>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs font-bold text-slate-800">{agencyFeeMonths} mois</span>
                </div>
              </div>
            </div>

            {/* Cost Breakdown Table */}
            {breakdown && (
              <div className="space-y-3 pt-2">
                <div className="divide-y divide-slate-100 text-xs">
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-600">Avance de loyer ({breakdown.advanceMonths} mois)</span>
                    <span className="font-mono font-medium text-slate-900">{formatFcfa(breakdown.advanceAmountFcfa || breakdown.advanceAmount || 0)}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-600">Caution de garantie ({breakdown.depositMonths} mois)</span>
                    <span className="font-mono font-medium text-slate-900">{formatFcfa(breakdown.depositAmountFcfa || breakdown.depositAmount || 0)}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-600">Honoraires d'agence VFC ({breakdown.agencyFeeMonths} mois)</span>
                    <span className="font-mono font-medium text-slate-900">{formatFcfa(breakdown.agencyFeeAmountFcfa || breakdown.agencyFeeAmount || 0)}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-600">Enregistrement bail & timbres légaux</span>
                    <span className="font-mono font-medium text-slate-900">{formatFcfa(breakdown.leaseDraftingFeeFcfa || breakdown.stampDutyAndRegistration || 0)}</span>
                  </div>
                  
                  {/* Total Initial Outlay Highlight */}
                  <div className="pt-3 pb-1 flex justify-between items-center text-emerald-950 font-bold bg-emerald-50/70 p-3 rounded-xl border border-emerald-200/80">
                    <div>
                      <span className="text-xs uppercase tracking-wider block">Décaissement Initial Requis</span>
                      <span className="text-[10px] text-emerald-700 font-normal">Avance + Caution + Frais + Timbres</span>
                    </div>
                    <span className="text-xl font-black font-mono tabular-nums text-emerald-900">
                      {formatFcfa(breakdown.totalInitialPayoutFcfa || breakdown.totalUpfrontCost || 0)}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 italic">
                  {breakdown.legalNotice}
                </p>

                <div className="pt-2">
                  <button
                    onClick={() => {
                      setFilters({ maxPrice: monthlyRent });
                      setView('properties');
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white font-semibold text-xs tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Explorer les biens disponibles dans ce budget</span>
                    <ArrowRight className="w-4 h-4 text-amber-300" />
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </section>
  );
};
