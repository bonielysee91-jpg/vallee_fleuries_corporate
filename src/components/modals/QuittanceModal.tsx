import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore.ts';
import { api, formatFcfa } from '../../services/api.ts';
import { X, Printer, ShieldCheck, Download, CheckCircle, FileText } from 'lucide-react';
import { VFC_WHATSAPP_DISPLAY } from '../../constants/contact.ts';

export const QuittanceModal: React.FC = () => {
  const { isQuittanceModalOpen, closeQuittanceModal, addNotification } = useAppStore();
  const [propertyTitle, setPropertyTitle] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [landlordName, setLandlordName] = useState('');
  const [periodMonth, setPeriodMonth] = useState(() => {
    const label = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  });
  const [baseRentFcfa, setBaseRentFcfa] = useState(0);
  const [chargesFcfa, setChargesFcfa] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'ORANGE_MONEY' | 'WAVE' | 'MTN_MOMO' | 'BANK_TRANSFER'>('ORANGE_MONEY');
  const [quittanceData, setQuittanceData] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isQuittanceModalOpen) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const generated = await api.generateQuittance({
        propertyTitle,
        tenantName,
        landlordName,
        periodMonth,
        baseRentFcfa: Number(baseRentFcfa),
        chargesFcfa: Number(chargesFcfa),
        paymentMethod
      });
      setQuittanceData(generated);
      addNotification('Quittance officielle générée avec succès !', 'success');
    } catch (err: any) {
      addNotification(err.message || 'Erreur lors de la génération', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-emerald-950/70 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-2xl liquid-glass-card bg-white rounded-2xl shadow-2xl border border-white/80 overflow-hidden my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-900 text-amber-300 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-emerald-950 font-serif">
                Quittance de Loyer Officielle (Côte d'Ivoire)
              </h3>
              <p className="text-[11px] text-slate-500">
                Conforme aux dispositions de la Loi N° 2019-576 du 26 juin 2019
              </p>
            </div>
          </div>
          <button
            onClick={closeQuittanceModal}
            className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {quittanceData ? (
            <div className="space-y-6">
              {/* Printable Document Sheet */}
              <div id="printable-quittance" className="p-6 rounded-xl border-2 border-slate-200 bg-[#FCFDFD] shadow-sm text-slate-800 space-y-5 font-sans">
                
                {/* Official Letterhead */}
                <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-emerald-950 font-serif">
                      VALLÉES FLEURIES CORPORATE S.A.S
                    </h2>
                    <p className="text-[10px] text-slate-500">
                      Régie Immobilière Agréée · R.C.M. CI-ABJ-2024-B-14209
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Boulevard Hassan II, Cocody, Abidjan · {VFC_WHATSAPP_DISPLAY}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-900 text-[11px] font-bold tracking-wider uppercase font-mono">
                      {quittanceData.quittanceNumber}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1">Date : {quittanceData.paymentDate}</p>
                  </div>
                </div>

                <div className="text-center py-1">
                  <h3 className="text-base font-black tracking-wider uppercase text-emerald-900 underline underline-offset-4 font-serif">
                    QUITTANCE DE LOYER
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Période d'occupation : <strong className="text-slate-900">{quittanceData.periodMonth}</strong>
                  </p>
                </div>

                {/* Landlord & Tenant details */}
                <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3.5 rounded-lg border border-slate-200/80">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Bailleur / Mandant</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{quittanceData.landlordName}</p>
                    <p className="text-slate-500 text-[11px]">Gestion déléguée VFC</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Locataire / Preneur</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{quittanceData.tenantName}</p>
                    <p className="text-slate-500 text-[11px] font-mono">{quittanceData.tenantPhone}</p>
                  </div>
                </div>

                {/* Property & Breakdown Table */}
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Désignation du bien loué</span>
                    <p className="font-medium text-slate-900">{quittanceData.propertyTitle}</p>
                    <p className="text-slate-500 text-[11px]">{quittanceData.propertyAddress}</p>
                  </div>

                  <table className="w-full mt-3 border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] text-slate-500 uppercase">
                        <th className="py-2">Désignation des sommes</th>
                        <th className="py-2 text-right">Montant (FCFA)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      <tr>
                        <td className="py-2">Loyer principal net</td>
                        <td className="py-2 text-right font-mono font-medium">{formatFcfa(quittanceData.baseRentFcfa)}</td>
                      </tr>
                      <tr>
                        <td className="py-2">Provisions pour charges (Groupe, Gardiennage, Eau)</td>
                        <td className="py-2 text-right font-mono font-medium">{formatFcfa(quittanceData.chargesFcfa)}</td>
                      </tr>
                      <tr className="bg-emerald-50/80 font-bold text-emerald-950">
                        <td className="py-2.5 px-2">TOTAL REÇU DU LOCATAIRE</td>
                        <td className="py-2.5 px-2 text-right font-mono text-sm">{formatFcfa(quittanceData.totalPaidFcfa)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Legal Attestation & Seal */}
                <div className="pt-3 border-t border-slate-200 flex justify-between items-end">
                  <div className="text-[10px] text-slate-500 max-w-xs space-y-1">
                    <p>
                      Reçu la somme ci-dessus indiquée au titre du loyer et charges du mois mentionné.
                    </p>
                    <p className="font-mono text-emerald-900">
                      Réf Transaction : {quittanceData.paymentReference} ({quittanceData.paymentMethod})
                    </p>
                  </div>

                  {/* Certified Seal simulation */}
                  <div className="border-2 border-emerald-800 p-2 rounded-lg text-center w-40 text-emerald-900 shadow-sm rotate-1">
                    <div className="text-[8px] font-black uppercase tracking-wider">VFC S.A.S</div>
                    <div className="text-[10px] font-bold">SCEAU AGRÉÉ CI</div>
                    <div className="text-[7px] text-slate-500">Direction Financière Cocody</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handlePrint}
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white font-semibold text-xs tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-amber-300" />
                  <span>Imprimer la Quittance / Télécharger PDF</span>
                </button>
                <button
                  onClick={() => setQuittanceData(null)}
                  className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all cursor-pointer"
                >
                  Éditer une autre
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleGenerate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mois / Période
                  </label>
                  <input
                    type="text"
                    required
                    value={periodMonth}
                    onChange={(e) => setPeriodMonth(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    placeholder="Ex: Novembre 2026"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mode de règlement perçu
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  >
                    <option value="ORANGE_MONEY">Orange Money Côte d'Ivoire</option>
                    <option value="WAVE">Wave CI</option>
                    <option value="MTN_MOMO">MTN MoMo</option>
                    <option value="BANK_TRANSFER">Virement Bancaire (Ecobank / SIB)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Propriété concernée
                </label>
                <input
                  type="text"
                  required
                  value={propertyTitle}
                  onChange={(e) => setPropertyTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Locataire (Preneur)
                  </label>
                  <input
                    type="text"
                    required
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Bailleur (Propriétaire)
                  </label>
                  <input
                    type="text"
                    required
                    value={landlordName}
                    onChange={(e) => setLandlordName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Loyer net mensuel (FCFA)
                  </label>
                  <input
                    type="number"
                    step="50000"
                    required
                    value={baseRentFcfa}
                    onChange={(e) => setBaseRentFcfa(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-700 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Provisions charges (FCFA)
                  </label>
                  <input
                    type="number"
                    step="10000"
                    required
                    value={chargesFcfa}
                    onChange={(e) => setChargesFcfa(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-700 font-mono"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white font-semibold text-xs tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4 text-amber-300" />
                  <span>{isGenerating ? 'Édition en cours...' : 'Générer la Quittance avec Sceau'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
