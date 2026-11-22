import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore.ts';
import { useShallow } from 'zustand/react/shallow';
import { api, formatFcfa } from '../../services/api.ts';
import { Property, VisitAppointment, VisitStatus } from '../../types/index.ts';
import { VFC_MEDIA } from '../../constants/media.ts';
import { PROPERTY_TYPE_OPTIONS, TRANSACTION_TYPE_OPTIONS } from '../../constants/property.ts';
import { 
  BarChart3, PlusCircle, CheckCircle2, XCircle, Loader2, Clock, Calendar, 
  MapPin, ShieldCheck, ArrowRight, Zap, Droplets, Shield, ExternalLink
} from 'lucide-react';

/** Libellés et couleurs des statuts de visite côté propriétaire. */
const VISIT_STATUS_STYLES: Record<VisitStatus, { label: string; className: string }> = {
  PENDING: { label: 'En attente de validation', className: 'bg-amber-100 text-amber-800' },
  CONFIRMED: { label: 'Visite acceptée', className: 'bg-emerald-100 text-emerald-800' },
  COMPLETED: { label: 'Visite effectuée', className: 'bg-blue-100 text-blue-800' },
  CANCELLED: { label: 'Visite refusée', className: 'bg-rose-100 text-rose-700' },
};

export const LandlordDashboard: React.FC = () => {
  const { addNotification, setView, visitsRefreshToken, openConfirmation } =
    useAppStore(useShallow((s) => ({
      addNotification: s.addNotification,
      setView: s.setView,
      visitsRefreshToken: s.visitsRefreshToken,
      openConfirmation: s.openConfirmation,
    })));
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'NEW_LISTING' | 'VISITS'>('OVERVIEW');
  const [properties, setProperties] = useState<Property[]>([]);
  const [visits, setVisits] = useState<VisitAppointment[]>([]);
  /** Identifiant de la visite en cours de traitement (acceptation / refus). */
  const [busyVisitId, setBusyVisitId] = useState<string | null>(null);

  // Wizard State (Steps 1 to 4)
  const [wizardStep, setWizardStep] = useState(1);
  const [formData, setFormData] = useState({
    title: '',
    category: 'LONG_TERM_RENT',
    type: 'VILLA',
    city: 'Abidjan',
    commune: 'Cocody',
    neighborhood: 'Riviera Golf',
    address: '',
    surfaceM2: 450,
    bedrooms: 4,
    bathrooms: 4,
    priceFcfa: 3500000,
    depositMonths: 2,
    advanceMonths: 2,
    agencyFeeMonths: 1,
    furnishing: 'UNFURNISHED',
    description: '',
    featuredImage: VFC_MEDIA.modernVilla,
    hasGenerator: true,
    hasWaterReserve: true,
    hasSecurity247: true,
    hasSwimmingPool: true,
    hasAirConditioning: true,
  });

  useEffect(() => {
    api.getProperties().then(setProperties);
  }, []);

  // Recharge le carnet de rendez-vous dès qu'une visite est confirmée (signal global du store).
  useEffect(() => {
    api.getVisits().then(setVisits);
  }, [visitsRefreshToken]);

  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await api.createProperty(formData as any);
      setProperties(prev => [created, ...prev]);
      addNotification('Bien enregistré et publié avec certification préliminaire !', 'success');
      setActiveTab('OVERVIEW');
      setWizardStep(1);
    } catch (err: any) {
      addNotification(err.message || 'Erreur lors de la publication', 'error');
    }
  };

  /** Décision du propriétaire : accepte (CONFIRMED) ou refuse (CANCELLED) une demande de visite. */
  const handleVisitDecision = (visitId: string, status: VisitStatus) => {
    const isConfirming = status === 'CONFIRMED';
    openConfirmation({
      title: isConfirming ? 'Valider la demande de visite' : 'Refuser la demande de visite',
      message: isConfirming
        ? 'Confirmez-vous la visite de ce bien aux date et heure demandées ? Vous pouvez joindre un message ou des consignes pour le client.'
        : 'Indiquez le motif du refus ou de l\'indisponibilité à transmettre au client :',
      confirmLabel: isConfirming ? 'Valider la visite' : 'Refuser la visite',
      cancelLabel: 'Annuler',
      variant: isConfirming ? 'info' : 'danger',
      inputPlaceholder: isConfirming
        ? 'Message facultatif (ex: Sonner à l\'interphone Villa 12)'
        : 'Motif du refus (ex: Bien déjà loué, propriétaire en déplacement)',
      onConfirm: async (adminMessage) => {
        setBusyVisitId(visitId);
        try {
          const updated = await api.updateVisitStatus(visitId, status, undefined, adminMessage?.trim() || undefined);
          setVisits((prev) => prev.map((v) => (v.id === visitId ? updated : v)));
          addNotification(
            isConfirming
              ? 'Visite acceptée — le client a été notifié de la confirmation.'
              : 'Visite refusée — le client a été notifié.',
            isConfirming ? 'success' : 'warning'
          );
        } catch (err: any) {
          addNotification(err.message || 'Erreur lors de la mise à jour de la visite', 'error');
        } finally {
          setBusyVisitId(null);
        }
      }
    });
  };

  const pendingVisits = visits.filter((v) => v.status === 'PENDING').length;
  const totalRentSecured = properties
    .filter((p) => p.category === 'LONG_TERM_RENT' || p.category === 'SHORT_TERM_FURNISHED')
    .reduce((sum, p) => sum + (p.priceFcfa || 0), 0);
  const activePublishedCount = properties.filter((p) => p.status === 'PUBLISHED' || p.status === 'AVAILABLE').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Dashboard Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl liquid-glass border border-white/60 shadow-lg">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-800 block">
            Espace Propriétaire & Gestion Immobilière Agréée
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-emerald-950 font-serif">
            Portefeuille Patrimonial VFC
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Supervision des baux, suivi des annonces et conformité Loi N° 2019-576.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('NEW_LISTING')}
            className="px-4 py-2.5 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-semibold shadow-md flex items-center gap-2 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-amber-300" />
            <span>Nouveau Mandat de Bien</span>
          </button>
        </div>
      </div>

      {/* Segmented Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('OVERVIEW')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'OVERVIEW' ? 'bg-emerald-900 text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Vue d'ensemble & KPIs
        </button>
        <button
          onClick={() => setActiveTab('VISITS')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'VISITS' ? 'bg-emerald-900 text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Demandes de Visites</span>
          <span className="w-5 h-5 rounded-full bg-amber-400 text-emerald-950 font-mono text-[10px] font-bold flex items-center justify-center">
            {visits.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('NEW_LISTING')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'NEW_LISTING' ? 'bg-emerald-900 text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Assistant de Publication (Wizard)
        </button>
      </div>

      {/* TAB 1: OVERVIEW & KPIS */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-8">
          
          {/* Real Live KPI Analytics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl liquid-glass-card border border-white/60">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Loyers Mensuels Gérés
              </span>
              <div className="text-xl sm:text-2xl font-black font-mono text-emerald-950 mt-1 tabular-nums">
                {formatFcfa(totalRentSecured)}
              </div>
              <span className="text-[10px] text-emerald-700 font-semibold mt-1 block">
                Total des biens locatifs actifs
              </span>
            </div>

            <div className="p-5 rounded-2xl liquid-glass-card border border-white/60">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Biens Publiés &amp; Visibles
              </span>
              <div className="text-xl sm:text-2xl font-black font-mono text-emerald-950 mt-1 tabular-nums">
                {activePublishedCount} / {properties.length}
              </div>
              <span className="text-[10px] text-emerald-700 font-semibold mt-1 block">
                {properties.length > 0
                  ? `${Math.round((activePublishedCount / properties.length) * 100)} % du portefeuille au catalogue`
                  : 'Aucun mandat enregistré'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('VISITS')}
              className="text-left p-5 rounded-2xl liquid-glass-card border border-white/60 hover:border-amber-300 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Demandes de Visite
                </span>
                <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-amber-600 transition-all" />
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-emerald-950 mt-1 tabular-nums">
                {visits.length} rendez-vous
              </div>
              <span className={`text-[10px] font-semibold mt-1 block ${pendingVisits > 0 ? 'text-amber-600 font-bold' : 'text-emerald-700'}`}>
                {pendingVisits > 0 ? `${pendingVisits} en attente de décision` : 'Toutes les visites traitées'}
              </span>
            </button>
          </div>

          {/* Properties Under Management List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-emerald-950 font-serif">
                Biens sous Gestion Immobilière ({properties.length})
              </h3>
              <span className="text-xs text-slate-500">Mise à jour en direct</span>
            </div>

            <div className="divide-y divide-slate-100 rounded-2xl liquid-glass border border-white/60 overflow-hidden shadow-sm">
              {properties.map((prop) => (
                <div key={prop.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <img
                      src={prop.coverImage || prop.featuredImage || prop.images?.[0]?.url || VFC_MEDIA.modernVilla}
                      alt={prop.title}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-xl object-cover shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span>{prop.commune}</span>
                        <span aria-hidden="true">·</span>
                        <span>{prop.neighborhood}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-800 font-semibold">
                          {prop.category === 'SALE' ? 'Vente' : 'Location longue durée'}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mt-0.5">{prop.title}</h4>
                      <span className="text-xs font-mono font-bold text-emerald-900 mt-0.5 block">
                        {formatFcfa(prop.priceFcfa)}
                        {prop.category === 'LONG_TERM_RENT' ? ' / mois' : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                      {prop.status}
                    </span>
                    <button
                      onClick={() => {
                        useAppStore.getState().setSelectedPropertyId(prop.id);
                        setView('property-detail', prop.id);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      Aperçu Public
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: VISITS MANAGEMENT */}
      {activeTab === 'VISITS' && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-emerald-950 font-serif">
            Demandes de Visite Guidée & Rendez-vous Clients
          </h3>
          <div className="divide-y divide-slate-100 rounded-2xl liquid-glass border border-white/60 overflow-hidden shadow-sm">
            {visits.map((vis) => (
              <div key={vis.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/50">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-slate-900">{vis.userName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-slate-500">{vis.clientPhone}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-emerald-700 font-semibold">{vis.visitType === 'IN_PERSON' ? 'Sur Site' : 'Visio Directe'}</span>
                  </div>
                  <h4 className="text-sm font-bold text-emerald-950">{vis.propertyTitle}</h4>
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                    <span>{vis.scheduledDate} à {vis.scheduledTime}</span>
                    {vis.notes && <span className="italic">— « {vis.notes} »</span>}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {vis.status === 'PENDING' && (
                    <>
                      <button
                        type="button"
                        disabled={busyVisitId === vis.id}
                        onClick={() => handleVisitDecision(vis.id, 'CONFIRMED')}
                        title="Accepter la visite"
                        className="px-3 py-1.5 rounded-lg bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        {busyVisitId === vis.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" />
                        )}
                        <span>Accepter</span>
                      </button>
                      <button
                        type="button"
                        disabled={busyVisitId === vis.id}
                        onClick={() => handleVisitDecision(vis.id, 'CANCELLED')}
                        title="Refuser la visite"
                        className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Refuser</span>
                      </button>
                    </>
                  )}

                  <a
                    href={vis.whatsAppNotifyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-[#25D366] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                  >
                    <span>Contacter WhatsApp</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <span className={`px-2.5 py-1 rounded text-[11px] font-bold ${VISIT_STATUS_STYLES[vis.status].className}`}>
                    {VISIT_STATUS_STYLES[vis.status].label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: MULTI-STEP LISTING WIZARD */}
      {activeTab === 'NEW_LISTING' && (
        <div className="liquid-glass-card rounded-3xl p-6 sm:p-8 border border-white/60 max-w-3xl mx-auto space-y-6">
          
          {/* Wizard Progress Bar */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-2">
              <span>Étape {wizardStep} sur 4</span>
              <span>
                {wizardStep === 1 && '1. Localisation & Caractéristiques'}
                {wizardStep === 2 && '2. Visuels & Visite Virtuelle'}
                {wizardStep === 3 && '3. Barème Financier & Caution 2+2'}
                {wizardStep === 4 && '4. Dossier Propriétaire & Validation'}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-700 transition-all duration-300"
                style={{ width: `${(wizardStep / 4) * 100}%` }}
              />
            </div>
          </div>

          <form onSubmit={handleCreateProperty} className="space-y-5">
            {/* STEP 1 */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-emerald-950 font-serif">
                  Localisation & Type de Bien
                </h3>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Titre de l'annonce</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                    placeholder="Ex: Villa Contemporaine Les Palmiers — Cocody Riviera 3"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Catégorie</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                    >
                      {TRANSACTION_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Typologie</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                    >
                      {PROPERTY_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Commune</label>
                    <input
                      type="text"
                      required
                      value={formData.commune}
                      onChange={(e) => setFormData({ ...formData, commune: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                      placeholder="Cocody"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Quartier</label>
                    <input
                      type="text"
                      required
                      value={formData.neighborhood}
                      onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                      placeholder="Riviera Golf"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Surface (m²)</label>
                    <input
                      type="number"
                      required
                      value={formData.surfaceM2}
                      onChange={(e) => setFormData({ ...formData, surfaceM2: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (!formData.title) return addNotification('Veuillez renseigner le titre', 'warning');
                      setWizardStep(2);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-emerald-900 text-white text-xs font-semibold flex items-center gap-2"
                  >
                    <span>Continuer vers Médias</span>
                    <ArrowRight className="w-4 h-4 text-amber-300" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2 */}
            {wizardStep === 2 && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-emerald-950 font-serif">
                  Médias & Descriptif du Bien
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Visuel Principal (URL ou Galerie certifiée)</label>
                  <select
                    value={formData.featuredImage}
                    onChange={(e) => setFormData({ ...formData, featuredImage: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                  >
                    <option value={VFC_MEDIA.modernVilla}>Villa Riviera Golf & Piscine</option>
                    <option value={VFC_MEDIA.penthouseView}>Tour & Skyline Le Plateau</option>
                    <option value={VFC_MEDIA.beachResidence}>Assinie Pieds dans l'Eau</option>
                    <option value={VFC_MEDIA.luxuryInterior}>Intérieur Penthouse & Marbre</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Descriptif détaillé</label>
                  <textarea
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                    placeholder="Détaillez les hauteurs sous plafond, la provenance des matériaux, le groupe de relève..."
                  />
                </div>

                <div className="flex justify-between pt-3">
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold"
                  >
                    Retour
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep(3)}
                    className="px-5 py-2.5 rounded-xl bg-emerald-900 text-white text-xs font-semibold flex items-center gap-2"
                  >
                    <span>Continuer vers Conditions Financières</span>
                    <ArrowRight className="w-4 h-4 text-amber-300" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-emerald-950 font-serif">
                  Barème Financier & Plafonnement Légal
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Loyer mensuel ou Prix Total (FCFA)</label>
                  <input
                    type="number"
                    step="50000"
                    required
                    value={formData.priceFcfa}
                    onChange={(e) => setFormData({ ...formData, priceFcfa: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-mono font-bold text-emerald-900 text-base"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                  <span className="font-bold block">Application de la Loi N° 2019-576 :</span>
                  <div>· Caution de garantie : plafonnée à 2 mois ({formatFcfa(formData.priceFcfa * 2)})</div>
                  <div>· Avance de loyer : plafonnée à 2 mois ({formatFcfa(formData.priceFcfa * 2)})</div>
                </div>

                <div className="flex justify-between pt-3">
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold"
                  >
                    Retour
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep(4)}
                    className="px-5 py-2.5 rounded-xl bg-emerald-900 text-white text-xs font-semibold flex items-center gap-2"
                  >
                    <span>Continuer vers Titres Fonciers</span>
                    <ArrowRight className="w-4 h-4 text-amber-300" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4 */}
            {wizardStep === 4 && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-emerald-950 font-serif">
                  Dossier Propriétaire & Validation
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Équipement</label>
                    <select
                      value={formData.furnishing}
                      onChange={(e) => setFormData({ ...formData, furnishing: e.target.value as any })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                    >
                      <option value="UNFURNISHED">Non équipé</option>
                      <option value="SEMI_FURNISHED">Partiellement équipé</option>
                      <option value="FULLY_FURNISHED">Entièrement équipé</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Statut de publication</label>
                    <div className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
                      Vérification VFC puis publication automatique
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold mb-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <span>Engagement de conformité Vallées Fleuries Corporate</span>
                  </div>
                  En publiant ce bien, vous certifiez l'exactitude des pièces fournies sous réserve de l'audit notarié contradictoire de la direction juridique VFC.
                </div>

                <div className="flex justify-between pt-3">
                  <button
                    type="button"
                    onClick={() => setWizardStep(3)}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold"
                  >
                    Retour
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-bold shadow-lg flex items-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-amber-300" />
                    <span>Confirmer & Publier le Mandat</span>
                  </button>
                </div>
              </div>
            )}
          </form>

        </div>
      )}

    </div>
  );
};
