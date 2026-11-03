import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore.ts';
import { api, formatFcfa } from '../../services/api.ts';
import { Property, Transaction } from '../../types/index.ts';
import { FALLBACK_PROPERTY_IMAGE } from '../../constants/media.ts';
import { 
  ShieldCheck, Check, X, AlertTriangle, Smartphone, RefreshCw, 
  ExternalLink, FileCheck, Layers, Eye
} from 'lucide-react';

export const AdminPortal: React.FC = () => {
  const { addNotification, setSelectedPropertyId, setView } = useAppStore();
  const [properties, setProperties] = useState<Property[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<'MODERATION' | 'TRANSACTIONS' | 'KYC'>('MODERATION');

  useEffect(() => {
    api.getProperties().then(setProperties);
    api.getTransactions().then(setTransactions);
  }, []);

  const handleUpdateStatus = async (propId: string, newStatus: Property['status']) => {
    try {
      const updated = await api.updatePropertyStatus(propId, newStatus);
      setProperties(prev => prev.map(p => p.id === propId ? updated : p));
      addNotification(`Statut du bien mis à jour : ${newStatus}`, 'success');
    } catch (err: any) {
      addNotification(err.message || 'Erreur mise à jour', 'error');
    }
  };

  const handleSimulateWebhook = async (provider: string) => {
    const randomAmount = Math.floor(250000 + Math.random() * 2000000);
    try {
      const newTx = await api.initiatePayment({
        phoneNumber: '+225 07 99 88 77 66',
        provider,
        amountFcfa: randomAmount,
        purpose: `SIMULATION WEBHOOK CALLBACK ${provider} CI`,
        clientName: 'Audit Automatique CinetPay',
        propertyTitle: 'Contrôle Flux Financier'
      });
      setTransactions(prev => [newTx, ...prev]);
      addNotification(`Webhook ${provider} reçu : Transaction ${newTx.reference} créditée !`, 'info');
    } catch (err: any) {
      addNotification('Erreur simulation webhook', 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl liquid-glass border border-white/60 shadow-lg">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-800 block">
            Direction Générale & Régie Locative VFC
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-emerald-950 font-serif">
            Portail Super-Admin & Modération
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Qualification des mandats bailleurs, validation des annonces locatives et flux Mobile Money.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSimulateWebhook('WAVE')}
            className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tester Webhook Wave</span>
          </button>
          <button
            onClick={() => handleSimulateWebhook('ORANGE_MONEY')}
            className="px-3 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tester Webhook Orange</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('MODERATION')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === 'MODERATION' ? 'bg-emerald-900 text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Pipeline Modération Annonces ({properties.length})
        </button>
        <button
          onClick={() => setActiveTab('TRANSACTIONS')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === 'TRANSACTIONS' ? 'bg-emerald-900 text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Grand Livre Transactions Mobile Money ({transactions.length})
        </button>
        <button
          onClick={() => setActiveTab('KYC')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === 'KYC' ? 'bg-emerald-900 text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Conformité Mandats & Bailleurs
        </button>
      </div>

      {/* TAB 1: MODERATION */}
      {activeTab === 'MODERATION' && (
        <div className="space-y-4">
          <div className="divide-y divide-slate-100 rounded-2xl liquid-glass border border-white/60 overflow-hidden shadow-sm">
            {properties.map((prop) => (
              <div key={prop.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/50">
                <div className="flex items-start gap-4">
                  <img
                    src={prop.coverImage || prop.featuredImage || prop.images?.[0]?.url || FALLBACK_PROPERTY_IMAGE}
                    alt={prop.title}
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-xl object-cover shrink-0 mt-1"
                  />
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-bold text-emerald-800">
                        {prop.category === 'LONG_TERM_RENT' ? 'Bail longue durée' : 'Meublé courte durée'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{prop.commune} ({prop.neighborhood})</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatFcfa(prop.priceFcfa)}</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">{prop.title}</h4>
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                      {prop.furnishing === 'FULLY_FURNISHED' ? 'Résidence entièrement meublée' : 'Bien loué non meublé'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                    prop.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {prop.status}
                  </span>

                  <button
                    onClick={() => handleUpdateStatus(prop.id, 'PUBLISHED')}
                    title="Approuver et publier"
                    className="p-2 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 transition-colors cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleUpdateStatus(prop.id, 'RESERVED')}
                    title="Marquer réservé"
                    className="p-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 transition-colors cursor-pointer"
                  >
                    <AlertTriangle className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => {
                      setSelectedPropertyId(prop.id);
                      setView('property-detail', prop.id);
                    }}
                    title="Inspecter la fiche"
                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: TRANSACTIONS AUDIT */}
      {activeTab === 'TRANSACTIONS' && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-2xl liquid-glass border border-white/60 shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5">Référence VFC</th>
                  <th className="p-3.5">Client & Numéro</th>
                  <th className="p-3.5">Opérateur / Passerelle</th>
                  <th className="p-3.5">Objet de règlement</th>
                  <th className="p-3.5 text-right">Montant (FCFA)</th>
                  <th className="p-3.5 text-center">Statut</th>
                  <th className="p-3.5">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/60">
                    <td className="p-3.5 font-mono font-bold text-emerald-950">{tx.reference}</td>
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-900">{tx.clientName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{tx.clientPhone}</div>
                    </td>
                    <td className="p-3.5">
                      <span className="font-semibold text-slate-800">{tx.paymentProvider}</span>
                    </td>
                    <td className="p-3.5 text-slate-600 line-clamp-1">{tx.purpose}</td>
                    <td className="p-3.5 text-right font-mono font-black text-emerald-900 text-xs">
                      {formatFcfa(tx.amountFcfa)}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        {tx.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-400 text-[11px] whitespace-nowrap">
                      {new Date(tx.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: KYC & LAND TITLE AUDIT */}
      {activeTab === 'KYC' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl liquid-glass border border-white/60 space-y-4">
            <div className="flex items-center gap-2 text-emerald-950">
              <FileCheck className="w-5 h-5 text-emerald-700" />
              <h3 className="text-base font-bold font-serif">Processus d'Homologation des Mandats Locatifs</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Chaque bien locatif fait l'objet d'une vérification d'authenticité du mandat du bailleur et d'un état des lieux contradictoire. Les dossiers sont contrôlés afin de garantir la conformité du bail, l'absence de litige en cours et l'exactitude des charges annoncées.
            </p>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1 text-slate-700">
              <div>· Nombre de dossiers vérifiés : <strong>48 mandats et résidences</strong></div>
              <div>· Taux de conformité notariale : <strong>100%</strong></div>
              <div>· Délai moyen d'instruction VFC : <strong>48 heures</strong></div>
            </div>
          </div>

          <div className="p-6 rounded-2xl liquid-glass border border-white/60 space-y-4">
            <div className="flex items-center gap-2 text-emerald-950">
              <Smartphone className="w-5 h-5 text-amber-600" />
              <h3 className="text-base font-bold font-serif">Agrément Passerelles Mobile Money</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              La plateforme est interfacée avec l'écosystème de paiement ivoirien via les protocoles sécurisés Wave Merchant API et CinetPay. Les avis de versement sont chiffrés et séquestrés jusqu'à la signature authentique des baux.
            </p>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1 text-slate-700">
              <div>· Opérateurs certifiés : Wave, Orange Money, MTN MoMo, Moov Money</div>
              <div>· Taux de succès transactions : <strong>99.8%</strong></div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
