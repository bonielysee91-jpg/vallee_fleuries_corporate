import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore.ts';
import { api, formatFcfa } from '../../services/api.ts';
import { X, Smartphone, CreditCard, ShieldCheck, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';

type Provider = 'WAVE' | 'ORANGE_MONEY' | 'MTN_MOMO' | 'MOOV_MONEY' | 'VISA_MASTERCARD';

export const PaymentModal: React.FC = () => {
  const { isPaymentModalOpen, closePaymentModal, activePaymentDetails, addNotification, currentUser } = useAppStore();
  const [provider, setProvider] = useState<Provider>('WAVE');
  const [phoneNumber, setPhoneNumber] = useState(currentUser?.phoneNumber ?? '');
  const [clientName, setClientName] = useState(currentUser?.fullName ?? '');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [paymentStep, setPaymentStep] = useState<'FORM' | 'PROCESSING' | 'SUCCESS'>('FORM');
  const [completedTx, setCompletedTx] = useState<any>(null);

  if (!isPaymentModalOpen || !activePaymentDetails) return null;

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentStep('PROCESSING');

    try {
      // Simulate real carrier USSD push / Wave QR handshake
      await new Promise(resolve => setTimeout(resolve, 1800));

      const tx = await api.initiatePayment({
        phoneNumber,
        provider,
        amountFcfa: activePaymentDetails.amountFcfa,
        purpose: activePaymentDetails.purpose,
        clientName,
        propertyTitle: activePaymentDetails.propertyTitle
      });

      setCompletedTx(tx);
      setPaymentStep('SUCCESS');
      addNotification(`Paiement de ${formatFcfa(activePaymentDetails.amountFcfa)} validé avec succès !`, 'success');

      if (activePaymentDetails.onSuccessCallback) {
        activePaymentDetails.onSuccessCallback();
      }
    } catch (err: any) {
      addNotification(err.message || 'Échec de la transaction', 'error');
      setPaymentStep('FORM');
    }
  };

  const handleClose = () => {
    setPaymentStep('FORM');
    setCompletedTx(null);
    closePaymentModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-emerald-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg liquid-glass-card bg-white/95 rounded-2xl shadow-2xl border border-white/60 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-900 text-amber-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-emerald-950 font-serif">
                Paiement Sécurisé Côte d'Ivoire
              </h3>
              <p className="text-[11px] text-slate-500">
                Agrément CinetPay / Passerelle Multi-Opérateurs
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {paymentStep === 'FORM' && (
            <form onSubmit={handlePay} className="space-y-4">
              {/* Order Summary Box */}
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/60">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">
                      Objet de règlement
                    </span>
                    <h4 className="text-xs font-bold text-emerald-950 line-clamp-1 mt-0.5">
                      {activePaymentDetails.purpose}
                    </h4>
                    {activePaymentDetails.propertyTitle && (
                      <p className="text-[11px] text-emerald-700/80 mt-0.5">
                        {activePaymentDetails.propertyTitle}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-emerald-800 block">Montant Total</span>
                    <span className="text-base font-extrabold text-emerald-900 font-mono tabular-nums">
                      {formatFcfa(activePaymentDetails.amountFcfa)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Provider Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Sélectionnez votre moyen de paiement
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  <button
                    type="button"
                    onClick={() => setProvider('WAVE')}
                    className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      provider === 'WAVE'
                        ? 'border-cyan-500 bg-cyan-50/70 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-[#1AA9E8] text-white flex items-center justify-center text-[10px] font-black">
                      W
                    </div>
                    <span className="text-[10px] font-bold text-slate-800">Wave</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProvider('ORANGE_MONEY')}
                    className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      provider === 'ORANGE_MONEY'
                        ? 'border-orange-500 bg-orange-50/70 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-[#FF6600] text-white flex items-center justify-center text-[10px] font-black">
                      OM
                    </div>
                    <span className="text-[10px] font-bold text-slate-800">Orange</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProvider('MTN_MOMO')}
                    className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      provider === 'MTN_MOMO'
                        ? 'border-amber-500 bg-amber-50/70 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-[#FFCC00] text-slate-900 flex items-center justify-center text-[10px] font-black">
                      MTN
                    </div>
                    <span className="text-[10px] font-bold text-slate-800">MTN MoMo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProvider('MOOV_MONEY')}
                    className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      provider === 'MOOV_MONEY'
                        ? 'border-blue-500 bg-blue-50/70 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-[#0082C9] text-white flex items-center justify-center text-[10px] font-black">
                      Moov
                    </div>
                    <span className="text-[10px] font-bold text-slate-800">Moov</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProvider('VISA_MASTERCARD')}
                    className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      provider === 'VISA_MASTERCARD'
                        ? 'border-emerald-500 bg-emerald-50/70 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-emerald-800 text-white flex items-center justify-center text-[10px] font-black">
                      <CreditCard className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-800">Carte</span>
                  </button>
                </div>
              </div>

              {/* Provider Specific Inputs */}
              {provider === 'VISA_MASTERCARD' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Numéro de carte bancaire (Visa / Mastercard)
                    </label>
                    <input
                      type="text"
                      required
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700 font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Expiration
                      </label>
                      <input
                        type="text"
                        required
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700 font-mono text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        CVV (Cryptogramme)
                      </label>
                      <input
                        type="password"
                        maxLength={3}
                        required
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700 font-mono text-center"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Numéro Mobile Money Côte d'Ivoire (+225)
                    </label>
                    <div className="relative">
                      <Smartphone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700 font-mono"
                        placeholder="+225 07 00 00 00 00"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Titulaire du compte Mobile Money
                    </label>
                    <input
                      type="text"
                      required
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    />
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 leading-relaxed">
                    {provider === 'WAVE' && '📱 Une invite Wave s\'ouvrira sur votre smartphone ou scanner pour valider sans frais additionnels.'}
                    {provider === 'ORANGE_MONEY' && '📲 Composez le #144*82# sur votre téléphone pour générer votre code d\'autorisation temporaire.'}
                    {provider === 'MTN_MOMO' && '📲 Vous recevrez une invite de notification USSD sur votre écran pour confirmer votre code secret MoMo.'}
                    {provider === 'MOOV_MONEY' && '📲 Validez la notification de débit sur votre SIM MoMo Côte d\'Ivoire.'}
                  </div>
                </div>
              )}

              {/* Submit CTA */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white font-semibold text-xs tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Procéder au Débit de {formatFcfa(activePaymentDetails.amountFcfa)}</span>
                  <ArrowRight className="w-4 h-4 text-amber-300" />
                </button>
              </div>
            </form>
          )}

          {paymentStep === 'PROCESSING' && (
            <div className="py-12 text-center space-y-4">
              <Loader2 className="w-12 h-12 text-emerald-700 animate-spin mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">Communication avec l'opérateur {provider}</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Veuillez confirmer l'invite USSD ou l'application sur votre smartphone (+225)...
                </p>
              </div>
            </div>
          )}

          {paymentStep === 'SUCCESS' && completedTx && (
            <div className="py-4 text-center space-y-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Transaction Validée</h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Référence VFC : <span className="font-mono font-bold text-emerald-800">{completedTx.reference}</span>
                </p>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-left text-xs space-y-1 text-emerald-900">
                <div className="flex justify-between">
                  <span className="text-emerald-700">Montant :</span>
                  <span className="font-mono font-bold">{formatFcfa(completedTx.amountFcfa)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-700">Moyen :</span>
                  <span className="font-bold">{completedTx.paymentProvider}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-700">Horodatage :</span>
                  <span>{new Date(completedTx.createdAt).toLocaleString('fr-FR')}</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={handleClose}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-900 text-white font-semibold text-xs tracking-wide shadow transition-all cursor-pointer"
                >
                  Fermer & Terminer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
