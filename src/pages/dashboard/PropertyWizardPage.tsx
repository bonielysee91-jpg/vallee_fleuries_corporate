import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore.ts';
import { api, formatFcfa } from '../../services/api.ts';
import { City, FurnishingStatus, PropertyImage, PropertyType, RentalCategory } from '../../types/index.ts';
import {
  ALLOWED_PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS,
  TRANSACTION_TYPE_LABELS
} from '../../constants/property.ts';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  ImagePlus,
  Loader2,
  MapPin,
  Ruler,
  Save,
  Sparkles,
  Send,
  Trash2
} from 'lucide-react';

// Natures d'offre autorisées : Vente & Location uniquement (cf. référentiel des biens).
const CATEGORIES: { id: RentalCategory; label: string; hint: string }[] = [
  { id: 'SALE', label: TRANSACTION_TYPE_LABELS.SALE, hint: 'Acquisition définitive' },
  { id: 'LONG_TERM_RENT', label: TRANSACTION_TYPE_LABELS.LONG_TERM_RENT, hint: 'Location d\'un an et plus' }
];

/**
 * Convertit un fichier image local en data URL redimensionnée (max 1600 px de large,
 * JPEG qualité 0,78). Sans redimensionnement, une photo de téléphone pèserait plusieurs
 * mégaoctets dans l'annonce ; ici le poids reste raisonnable pour le catalogue.
 */
function fileToResizedDataUrl(file: File, maxWidth = 1600, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Lecture de « ${file.name} » impossible`));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error(`Image « ${file.name} » illisible`));
      image.onload = () => {
        const scale = Math.min(1, maxWidth / image.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Traitement des images indisponible sur ce navigateur'));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

const TYPES: PropertyType[] = ALLOWED_PROPERTY_TYPES;
const FURNISHINGS: { id: FurnishingStatus; label: string }[] = [
  { id: 'UNFURNISHED', label: 'Non équipé' },
  { id: 'SEMI_FURNISHED', label: 'Partiellement équipé' },
  { id: 'FULLY_FURNISHED', label: 'Entièrement équipé' }
];

/** `/dashboard/properties/new` (création) & `/dashboard/properties/:id/edit` (édition) — wizard multi-étapes. */
export const PropertyWizardPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const addNotification = useAppStore((state) => state.addNotification);

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(isEdit);
  const [processingImages, setProcessingImages] = useState(false);
  // Référentiel géographique ivoirien servi par Neon : aucune ville n'est codée en dur.
  const [cities, setCities] = useState<City[]>([]);

  const [form, setForm] = useState({
    category: 'LONG_TERM_RENT' as RentalCategory,
    type: 'APARTMENT' as PropertyType,
    furnishing: 'FULLY_FURNISHED' as FurnishingStatus,
    title: '',
    description: '',
    city: 'Abidjan',
    commune: 'Cocody',
    neighborhood: '',
    address: '',
    latitude: 5.3485,
    longitude: -3.9723,
    images: [] as PropertyImage[],
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

  // Charge toutes les villes de Côte d'Ivoire (puis leurs communes/quartiers) au montage.
  useEffect(() => {
    let active = true;
    api
      .getGeography()
      .then((rows) => {
        if (!active) return;
        setCities(rows);
        // Aligne la sélection sur le référentiel (utile en édition si la ville a changé).
        setForm((prev) => {
          const current = rows.find((city) => city.name === prev.city) ?? rows[0];
          if (!current) return prev;
          const communes = current.communes ?? [];
          const commune = communes.some((item) => item.name === prev.commune)
            ? prev.commune
            : communes[0]?.name ?? '';
          return { ...prev, city: current.name, commune };
        });
      })
      .catch(() => setCities([]));
    return () => {
      active = false;
    };
  }, []);

  const selectedCity = cities.find((city) => city.name === form.city);
  const communeOptions = selectedCity?.communes ?? [];
  const neighborhoodOptions =
    communeOptions.find((commune) => commune.name === form.commune)?.neighborhoods ?? [];

  /** Changer de ville recentre la commune, le quartier et les coordonnées GPS sur la nouvelle ville. */
  const handleCityChange = (name: string) => {
    const city = cities.find((item) => item.name === name);
    setForm((prev) => ({
      ...prev,
      city: name,
      commune: city?.communes?.[0]?.name ?? '',
      neighborhood: '',
      latitude: city?.latitude ?? prev.latitude,
      longitude: city?.longitude ?? prev.longitude
    }));
  };

  /** Changer de commune vide le quartier (chaque commune a ses propres quartiers). */
  const handleCommuneChange = (name: string) => {
    setForm((prev) => ({ ...prev, commune: name, neighborhood: '' }));
  };

  // Mode édition : on charge le bien existant puis on préremplit l'assistant.
  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoadingExisting(true);
    api
      .getPropertyById(id)
      .then((property) => {
        if (!active) return;
        if (!property) {
          addNotification('Bien introuvable', 'error');
          navigate('/dashboard/properties/manage');
          return;
        }
        setForm({
          category: property.category as RentalCategory,
          type: property.type,
          furnishing: property.furnishing,
          title: property.title,
          description: property.description,
          city: property.city,
          commune: property.commune,
          neighborhood: property.neighborhood,
          address: property.address,
          latitude: property.latitude,
          longitude: property.longitude,
          images: property.images ?? [],
          surfaceM2: property.surfaceM2,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          priceFcfa: property.priceFcfa,
          serviceChargeFcfa: property.serviceChargeFcfa ?? 0,
          isNegotiable: property.isNegotiable,
          hasGenerator: property.hasGenerator,
          hasWaterReserve: property.hasWaterReserve,
          hasSecurity247: property.hasSecurity247,
          hasSwimmingPool: property.hasSwimmingPool,
          hasFiberInternet: property.hasFiberInternet
        });
      })
      .catch((err: any) => {
        addNotification(err?.message || 'Chargement du bien impossible', 'error');
        navigate('/dashboard/properties/manage');
      })
      .finally(() => {
        if (active) setLoadingExisting(false);
      });
    return () => {
      active = false;
    };
  }, [id, addNotification, navigate]);

  const steps = ['Produit', 'Localisation', 'Caractéristiques', 'Photos', 'Récapitulatif'];

  // ---- Gestion de la galerie photo (import local → data URL) ----
  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setProcessingImages(true);
    try {
      const drafted: PropertyImage[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        if (file.size > 8 * 1024 * 1024) {
          addNotification(`« ${file.name} » dépasse 8 Mo et a été ignorée`, 'warning');
          continue;
        }
        const url = await fileToResizedDataUrl(file);
        drafted.push({
          id: crypto.randomUUID(),
          url,
          caption: file.name.replace(/\.[^.]+$/, ''),
          isCover: false
        });
      }
      if (drafted.length === 0) return;
      setForm((prev) => {
        const images = [...prev.images, ...drafted];
        // Aucune couverture encore définie : la première photo du lot prend le rôle.
        return images.some((image) => image.isCover)
          ? { ...prev, images }
          : { ...prev, images: images.map((image, index) => ({ ...image, isCover: index === 0 })) };
      });
    } catch (err: any) {
      addNotification(err?.message || 'Ajout des images impossible', 'error');
    } finally {
      setProcessingImages(false);
    }
  };

  const removeImage = (index: number) => {
    setForm((prev) => {
      const images = prev.images.filter((_, position) => position !== index);
      // Supprimer la couverture promeut la première photo restante.
      if (images.length > 0 && !images.some((image) => image.isCover)) {
        images[0] = { ...images[0], isCover: true };
      }
      return { ...prev, images };
    });
  };

  const setCover = (index: number) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.map((image, position) => ({ ...image, isCover: position === index }))
    }));
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      addNotification('Le titre de l\'annonce est obligatoire', 'warning');
      setStep(1);
      return;
    }
    if (form.images.length === 0) {
      addNotification('Ajoutez au moins une photo du bien', 'warning');
      setStep(4);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        priceFcfa: Number(form.priceFcfa),
        depositMonths: 2,
        advanceMonths: 2,
        agencyFeeMonths: 1
      };
      const saved =
        isEdit && id
          ? await api.updateProperty(id, payload)
          : await api.createProperty(payload);
      addNotification(
        isEdit
          ? `Annonce « ${saved.title} » mise à jour`
          : `Annonce « ${saved.title} » transmise pour vérification VFC`,
        'success'
      );
      navigate('/dashboard/properties/manage');
    } catch (err: any) {
      addNotification(
        err?.message || (isEdit ? 'Mise à jour impossible' : 'Publication impossible'),
        'error'
      );
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

  if (loadingExisting) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-xs text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />
        Chargement de l'annonce…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-slate-900">
            {isEdit ? "Modifier l'annonce" : 'Publier une nouvelle location'}
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
                      {PROPERTY_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Équipement</label>
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
                <label className={labelClass}>Ville</label>
                <select
                  value={form.city}
                  onChange={(e) => handleCityChange(e.target.value)}
                  className={inputClass}
                >
                  {(cities.length > 0 ? cities.map((city) => city.name) : [form.city]).map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Commune</label>
                <select
                  value={form.commune}
                  onChange={(e) => handleCommuneChange(e.target.value)}
                  className={inputClass}
                  disabled={communeOptions.length === 0}
                >
                  {(communeOptions.length > 0 ? communeOptions.map((commune) => commune.name) : [form.commune])
                    .filter(Boolean)
                    .map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Quartier</label>
              <input
                list="wizard-neighborhoods"
                value={form.neighborhood}
                onChange={(e) => update('neighborhood', e.target.value)}
                placeholder="Ex : Riviera Golf"
                className={inputClass}
              />
              <datalist id="wizard-neighborhoods">
                {neighborhoodOptions.map((neighborhood) => (
                  <option key={neighborhood} value={neighborhood} />
                ))}
              </datalist>
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

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Latitude (GPS)</label>
                <input
                  type="number"
                  step="0.000001"
                  value={form.latitude}
                  onChange={(e) => update('latitude', Number(e.target.value))}
                  placeholder="5.348500"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Longitude (GPS)</label>
                <input
                  type="number"
                  step="0.000001"
                  value={form.longitude}
                  onChange={(e) => update('longitude', Number(e.target.value))}
                  placeholder="-3.972300"
                  className={inputClass}
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-700" />
              Les coordonnées (latitude / longitude) positionnent le bien sur la carte du catalogue.
            </p>

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
                  {form.category === 'SALE' ? 'Prix de vente (FCFA)' : 'Loyer mensuel (FCFA)'}
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
          <div className="space-y-5">
            <div>
              <label className={labelClass}>Photos du bien</label>
              <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 px-4 py-8 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void handleFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                {processingImages ? (
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
                ) : (
                  <ImagePlus className="w-6 h-6 text-emerald-700" />
                )}
                <span className="text-xs font-bold text-slate-700">
                  {processingImages ? 'Traitement des images…' : "Ajouter des photos depuis l'ordinateur"}
                </span>
                <span className="text-[10px] text-slate-500">
                  JPG, PNG ou WEBP · plusieurs fichiers possibles (8 Mo max par photo)
                </span>
              </label>
            </div>

            {form.images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {form.images.map((image, index) => (
                  <div
                    key={image.id}
                    className="relative rounded-2xl overflow-hidden border border-slate-200 group"
                  >
                    <img
                      src={image.url}
                      alt={image.caption || `Photo ${index + 1}`}
                      className="w-full h-28 object-cover"
                    />
                    {image.isCover && (
                      <span className="absolute top-1.5 left-1.5 rounded-full bg-amber-400 text-emerald-950 text-[9px] font-black px-2 py-0.5 uppercase tracking-wide">
                        Couverture
                      </span>
                    )}
                    <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-emerald-950/75 px-2 py-1.5">
                      {!image.isCover && (
                        <button
                          type="button"
                          onClick={() => setCover(index)}
                          className="text-[10px] font-bold text-amber-300 hover:text-white transition-colors"
                        >
                          Définir en couverture
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        aria-label="Supprimer la photo"
                        className="ml-auto text-white/80 hover:text-red-300 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              La première photo (couverture) sert de visuel principal sur le catalogue.
            </p>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h2 className="font-serif text-lg font-bold text-slate-900">Récapitulatif de l'annonce</h2>
            {form.images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.images.slice(0, 6).map((image) => (
                  <img
                    key={image.id}
                    src={image.url}
                    alt={image.caption || 'Photo du bien'}
                    className={`h-16 w-20 rounded-xl object-cover border-2 ${
                      image.isCover ? 'border-amber-400' : 'border-slate-200'
                    }`}
                  />
                ))}
              </div>
            )}
            <dl className="grid sm:grid-cols-2 gap-3">
              {[
                { label: 'Titre', value: form.title || '—' },
                { label: 'Offre', value: form.category === 'SALE' ? 'Vente' : 'Longue durée' },
                { label: 'Typologie', value: form.type },
                { label: 'Équipement', value: form.furnishing },
                { label: 'Ville', value: form.city },
                { label: 'Commune', value: form.commune || '—' },
                { label: 'Quartier', value: form.neighborhood || '—' },
                { label: 'Adresse', value: form.address || '—' },
                {
                  label: 'Coordonnées GPS',
                  value: `${Number(form.latitude).toFixed(5)}, ${Number(form.longitude).toFixed(5)}`
                },
                { label: 'Photos', value: `${form.images.length} photo(s)` },
                { label: 'Surface', value: `${form.surfaceM2} m²` },
                { label: 'Chambres / Salles d\'eau', value: `${form.bedrooms} / ${form.bathrooms}` },
                {
                  label: form.category === 'SALE' ? 'Prix de vente' : 'Loyer mensuel',
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
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-[#D97706] text-emerald-950 text-xs font-black hover:brightness-105 transition-all disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isEdit ? (
              <Save className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {isEdit ? 'Enregistrer les modifications' : "Publier l'annonce"}
          </button>
        )}
      </div>
    </div>
  );
};
