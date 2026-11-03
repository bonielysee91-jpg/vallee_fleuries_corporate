import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore.ts';
import { api, formatFcfa } from '../../services/api.ts';
import { Property, VisitAppointment, RentQuittance } from '../../types/index.ts';
import { VFC_MEDIA } from '../../constants/media.ts';
import { 
  BarChart3, PlusCircle, FileText, CheckCircle2, Clock, Calendar, 
  MapPin, ShieldCheck, ArrowRight, Zap, Droplets, Shield, ExternalLink, Printer
} from 'lucide-react';

export const LandlordDashboard: React.FC = () => {
  const { openQuittanceModal, addNotification, setView } = useAppStore();
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'NEW_LISTING' | 'VISITS' | 'QUITTANCES'>('OVERVIEW');
  const [properties, setProperties] = useState<Property[]>([]);
  const [visits, setVisits] = useState<VisitAppointment[]>([]);
  const [quittances, setQuittances] = useState<RentQuittance[]>([]);

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
    hasBackupGenerator: true,
    hasWaterReserve: true,
    hasSecurity247: true,
    hasSwimmingPool: true,
    hasAirConditioning: true,
  });

  useEffect(() => {
    api.getProperties().then(setProperties);
    api.getVisits().then(setVisits);
    api.getQuittances().then(setQuittances);
  }, []);

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Dashboard Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl liquid-glass border border-white/60 shadow-lg">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-800 block">
            Espace Bailleur & Gestion Immobilière Agréée
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-emerald-950 font-serif">
            Portefeuille Patrimonial VFC
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Supervision des baux, encaissement loyers Wave / Orange Money et conformité Loi N° 2019-576.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openQuittanceModal}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-200/90 text-slate-800 hover:text-emerald-900 text-xs font-semibold shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <FileText className="w-4 h-4 text-emerald-700" />
            <span>Générer Quittance Loyer</span>
          </button>

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
          onClick={() => setActiveTab('QUITTANCES')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'QUITTANCES' ? 'bg-emerald-900 text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Registre des Quittances
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
          
          {/* KPI Analytics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl liquid-glass-card border border-white/60">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Loyers Mensuels Sécurisés
              </span>
              <div className="text-2xl font-black font-mono text-emerald-950 mt-1 tabular-nums">
                24 850 000 FCFA
              </div>
              <span className="text-[10px] text-emerald-700 font-semibold mt-1 block">
                +12% par rapport au mois précédent
              </span>
            </div>

            <div className="p-5 rounded-2xl liquid-glass-card border border-white/60">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Taux d'Occupation Global
              </span>
              <div className="text-2xl font-black font-mono text-emerald-950 mt-1 tabular-nums">
                96.4 %
              </div>
              <span className="text-[10px] text-emerald-700 font-semibold mt-1 block">
                Cocody & Plateau à 100%
              </span>
            </div>

            <div className="p-5 rounded-2xl liquid-glass-card border border-white/60">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Visites Guidées ce mois
              </span>
              <div className="text-2xl font-black font-mono text-emerald-950 mt-1 tabular-nums">
                38 rendez-vous
              </div>
              <span className="text-[10px] text-amber-600 font-semibold mt-1 block">
                {visits.length} en attente de confirmation
              </span>
            </div>

            <div className="p-5 rounded-2xl liquid-glass-card border border-white/60">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Dossiers Bailleurs Conformes
              </span>
              <div className="text-2xl font-black font-mono text-emerald-950 mt-1 tabular-nums">
                100 %
              </div>
              <span className="text-[10px] text-emerald-700 font-semibold mt-1 block">
                Mandats locatifs signés & vérifiés
              </span>
            </div>
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
                          {prop.category === 'LONG_TERM_RENT' ? 'Bail long terme' : 'Meublé courte durée'}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mt-0.5">{prop.title}</h4>
                      <span className="text-xs font-mono font-bold text-emerald-900 mt-0.5 block">
                        {formatFcfa(prop.priceFcfa)}
                        {prop.category === 'LONG_TERM_RENT' ? ' / mois' : ' / nuitée'}
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
                    <span className="text-emerald-700 font-semibold">{vis.visitType === 'PHYSICAL' ? 'Sur Site' : 'Visio Directe'}</span>
                  </div>
                  <h4 className="text-sm font-bold text-emerald-950">{vis.propertyTitle}</h4>
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                    <span>{vis.scheduledDate} à {vis.scheduledTime}</span>
                    {vis.notes && <span className="italic">— « {vis.notes} »</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={vis.whatsAppNotifyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-[#25D366] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                  >
                    <span>Contacter WhatsApp</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                    {vis.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: REGISTER DES QUITTANCES */}
      {activeTab === 'QUITTANCES' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-emerald-950 font-serif">
              Registre Officiel des Quittances de Loyer Émises
            </h3>
            <button
              onClick={openQuittanceModal}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-900 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Éditer Nouvelle Quittance</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100 rounded-2xl liquid-glass border border-white/60 overflow-hidden shadow-sm">
            {quittances.map((qt) => (
              <div key={qt.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/50">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono font-bold text-emerald-900">{qt.quittanceNumber}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-slate-800">{qt.periodMonth}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-500">Locataire : {qt.tenantName}</span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">{qt.propertyTitle}</h4>
                  <div className="text-xs font-mono text-emerald-950">
                    Total Quittancé : <strong>{formatFcfa(qt.totalPaidFcfa || 0)}</strong> (Loyer {formatFcfa(qt.baseRentFcfa || qt.rentAmountFcfa || 0)} + Charges {formatFcfa(qt.chargesFcfa || 0)})
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={openQuittanceModal}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Réimprimer</span>
                  </button>
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
                {wizardStep === 4 && '4. Dossier Bailleur & Validation'}
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
                      <option value="LONG_TERM_RENT">Location Longue Durée</option>
                      <option value="SHORT_TERM_FURNISHED">Résidence Meublée (Courte durée)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Typologie</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                    >
                      <option value="VILLA">Villa d'Architecte</option>
                      <option value="DUPLEX">Duplex Haut Standing</option>
                      <option value="PENTHOUSE">Penthouse & Rooftop</option>
                      <option value="APARTMENT">Appartement Exécutif</option>
                      <option value="STUDIO">Studio Meublé</option>
                      <option value="COMMERCIAL">Local Professionnel</option>
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
                  Dossier Bailleur & Validation
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Ameublement</label>
                    <select
                      value={formData.furnishing}
                      onChange={(e) => setFormData({ ...formData, furnishing: e.target.value as any })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                    >
                      <option value="UNFURNISHED">Non meublé (location longue durée)</option>
                      <option value="SEMI_FURNISHED">Semi-meublé</option>
                      <option value="FULLY_FURNISHED">Entièrement meublé (courte durée)</option>
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
