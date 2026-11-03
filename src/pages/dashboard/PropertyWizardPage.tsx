import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore.ts';
import { api, formatFcfa } from '../../services/api.ts';
import { FurnishingStatus, PropertyType, RentalCategory } from '../../types/index.ts';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Loader2,
  MapPin,
  Ruler,
  Sparkles,
  Send
} from 'lucide-react';

const CATEGORIES: { id: RentalCategory; label: string; hint: string }[] = [
  { id: 'LONG_TERM_RENT', label: 'Location longue durée', hint: 'Bail d\'un an et plus' },
  { id: 'SHORT_TERM_FURNISHED', label: 'Résidence meublée', hint: 'Nuitée / semaine' }
];

const TYPES: PropertyType[] = ['APARTMENT', 'VILLA', 'STUDIO', 'DUPLEX', 'PENTHOUSE', 'COMMERCIAL'];
const FURNISHINGS: { id: FurnishingStatus; label: string }[] = [
  { id: 'UNFURNISHED', label: 'Non meublé' },
  { id: 'SEMI_FURNISHED', label: 'Semi-meublé' },
  { id: 'FULLY_FURNISHED', label: 'Entièrement meublé' }
];
const COMMUNES = ['Cocody', 'Marcory', 'Yopougon', 'Plateau', 'Riviera'];

/** `/dashboard/properties/new` — multi-step publication wizard. */
export const PropertyWizardPage: React.FC = () => {
  const navigate = useNavigate();
  const addNotification = useAppStore((state) => state.addNotification);

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    category: 'LONG_TERM_RENT' as RentalCategory,
    type: 'APARTMENT' as PropertyType,
    furnishing: 'FULLY_FURNISHED' as FurnishingStatus,
    title: '',
    description: '',
    commune: 'Cocody',
    neighborhood: '',
    address: '',
    surfaceM2: 85,
    bedrooms: 2,
    bathrooms: 2,
    priceFcfa: 450000,
    serviceChargeFcfa: 50000,
    isNegotiable: false,
    hasGenerator: true,
    hasWaterReserve: true,
    hasSecurity247: true,
    hasSwimmingPool: false,
    hasFiberInternet: true
  });

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const steps = ['Produit', 'Localisation', 'Caractéristiques', 'Récapitulatif'];

  const handlePublish = async () => {
    if (!form.title.trim()) {
      addNotification('Le titre de l\'annonce est obligatoire', 'warning');
      setStep(1);
      return;
    }

    setSubmitting(true);
    try {
      const created = await api.createProperty({
        ...form,
        city: 'Abidjan',
        priceFcfa: Number(form.priceFcfa),
        depositMonths: 2,
        advanceMonths: 2,
        agencyFeeMonths: 1
      });
      addNotification(
        `Annonce « ${created.title} » transmise pour vérification VFC`,
        'success'
      );
      navigate('/dashboard/properties/manage');
    } catch (err: any) {
      addNotification(err?.message || 'Publication impossible', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 text-sm text-slate-900 outline-none transition-all focus:ring-2 focus:ring-[#D97706] focus:border-transparent';
  const labelClass = 'block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5';

  const featureToggles: { key: keyof typeof form; label: string }[] = [
    { key: 'hasGenerator', label: 'Groupe électrogène' },
    { key: 'hasWaterReserve', label: 'Surpresseur / réserve d\'eau' },
    { key: 'hasSecurity247', label: 'Sécurité & gardiennage 24/7' },
    { key: 'hasSwimmingPool', label: 'Piscine' },
    { key: 'hasFiberInternet', label: 'Fibre optique' }
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-slate-900">
            Publier une nouvelle location
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Étape {step} sur {steps.length} · {steps[step - 1]}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {steps.map((label, index) => (
            <span
              key={label}
              className={`h-1.5 rounded-full transition-all ${
                index + 1 <= step ? 'w-10 bg-emerald-800' : 'w-6 bg-slate-200'
              }`}
            />
          ))}
        </div>
      </header>

      <div className="liquid-glass-card rounded-3xl p-6 border border-white/60 space-y-5">
        {step === 1 && (
          <>
            <div>
              <label className={labelClass}>Type d'offre locative</label>
              <div className="grid sm:grid-cols-2 gap-3">
                {CATEGORIES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => update('category', item.id)}
                    className={`text-left rounded-2xl border p-4 transition-all ${
                      form.category === item.id
                        ? 'border-emerald-800 bg-emerald-50'
                        : 'border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-xs font-bold text-slate-900">
                      <Building2 className="w-4 h-4 text-emerald-800" />
                      {item.label}
                    </span>
                    <span className="block mt-1 text-[11px] text-slate-500">{item.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Typologie</label>
                <select
                  value={form.type}
                  onChange={(e) => update('type', e.target.value as PropertyType)}
                  className={inputClass}
                >
                  {TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Ameublement</label>
                <select
                  value={form.furnishing}
                  onChange={(e) => update('furnishing', e.target.value as FurnishingStatus)}
                  className={inputClass}
                >
                  {FURNISHINGS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Titre de l'annonce</label>
              <input
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="Ex : Duplex haut standing Riviera Golf"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                rows={4}
                placeholder="Décrivez les atouts du bien, la vue, la proximité, les équipements…"
                className={`${inputClass} resize-none`}
              />
            </div>
          </>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Commune d'Abidjan</label>
                <select
                  value={form.commune}
                  onChange={(e) => update('commune', e.target.value)}
                  className={inputClass}
                >
                  {COMMUNES.map((commune) => (
                    <option key={commune} value={commune}>
                      {commune}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Quartier</label>
                <input
                  value={form.neighborhood}
                  onChange={(e) => update('neighborhood', e.target.value)}
                  placeholder="Ex : Riviera Golf"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Adresse complète</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-700" />
                <input
                  value={form.address}
                  onChange={(e) => update('address', e.target.value)}
                  placeholder="Rue, repère, lot…"
                  className={`${inputClass} pl-11`}
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Les biens publiés dans les communes desservies sont éligibles à la vérification VFC.
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Surface (m²)</label>
                <div className="relative">
                  <Ruler className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-700" />
                  <input
                    type="number"
                    value={form.surfaceM2}
                    onChange={(e) => update('surfaceM2', Number(e.target.value))}
                    className={`${inputClass} pl-11`}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Chambres</label>
                <input
                  type="number"
                  value={form.bedrooms}
                  onChange={(e) => update('bedrooms', Number(e.target.value))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Salles d'eau</label>
                <input
                  type="number"
                  value={form.bathrooms}
                  onChange={(e) => update('bathrooms', Number(e.target.value))}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>
                  {form.category === 'LONG_TERM_RENT' ? 'Loyer mensuel (FCFA)' : 'Tarif par nuit (FCFA)'}
                </label>
                <input
                  type="number"
                  value={form.priceFcfa}
                  onChange={(e) => update('priceFcfa', Number(e.target.value))}
                  className={inputClass}
                />
                <p className="mt-1.5 text-[10px] text-slate-500">{formatFcfa(form.priceFcfa)}</p>
              </div>
              <div>
                <label className={labelClass}>Charges mensuelles (FCFA)</label>
                <input
                  type="number"
                  value={form.serviceChargeFcfa}
                  onChange={(e) => update('serviceChargeFcfa', Number(e.target.value))}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Équipements</label>
              <div className="grid sm:grid-cols-2 gap-2">
                {featureToggles.map((item) => {
                  const active = Boolean(form[item.key]);
                  return (
                    <button
                      key={String(item.key)}
                      type="button"
                      onClick={() => update(item.key, !active as never)}
                      className={`flex items-center justify-between px-4 py-3 rounded-2xl border text-[11px] font-semibold transition-all ${
                        active
                          ? 'border-emerald-800 bg-emerald-50 text-emerald-900'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      {item.label}
                      <CheckCircle2
                        className={`w-4 h-4 ${active ? 'text-emerald-700' : 'text-slate-300'}`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex items-center gap-2.5 text-[11px] font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={form.isNegotiable}
                onChange={(e) => update('isNegotiable', e.target.checked)}
                className="w-4 h-4 accent-emerald-800"
              />
              Loyer négociable
            </label>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="font-serif text-lg font-bold text-slate-900">Récapitulatif de l'annonce</h2>
            <dl className="grid sm:grid-cols-2 gap-3">
              {[
                { label: 'Titre', value: form.title || '—' },
                { label: 'Offre', value: form.category === 'LONG_TERM_RENT' ? 'Longue durée' : 'Meublé court séjour' },
                { label: 'Typologie', value: form.type },
                { label: 'Ameublement', value: form.furnishing },
                { label: 'Commune', value: `${form.commune} · ${form.neighborhood || 'Abidjan'}` },
                { label: 'Adresse', value: form.address || '—' },
                { label: 'Surface', value: `${form.surfaceM2} m²` },
                { label: 'Chambres / Salles d\'eau', value: `${form.bedrooms} / ${form.bathrooms}` },
                {
                  label: form.category === 'LONG_TERM_RENT' ? 'Loyer mensuel' : 'Tarif nocturne',
                  value: formatFcfa(form.priceFcfa)
                },
                { label: 'Charges', value: formatFcfa(form.serviceChargeFcfa) }
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {item.label}
                  </dt>
                  <dd className="text-xs font-bold text-slate-900 mt-0.5">{item.value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-[11px] text-slate-500">
              Conformément à la Loi N° 2019-576, l'avance et la caution sont plafonnées à 2 mois
              chacune. La régie VFC applique automatiquement ce plafond légal.
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setStep((prev) => Math.max(1, prev - 1))}
          disabled={step === 1}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Précédent
        </button>

        {step < steps.length ? (
          <button
            onClick={() => setStep((prev) => Math.min(steps.length, prev + 1))}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-900 text-amber-400 text-xs font-bold hover:bg-emerald-800 transition-colors"
          >
            Suivant
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handlePublish}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-[#D97706] text-emerald-950 text-xs font-black hover:brightness-105 transition-all disabled:opacity-60"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Publier l'annonce
          </button>
        )}
      </div>
    </div>
  );
};
