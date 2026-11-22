import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore.ts';
import { useShallow } from 'zustand/react/shallow';
import { api, formatFcfa } from '../../services/api.ts';
import { Property } from '../../types/index.ts';
import { FALLBACK_PROPERTY_IMAGE, optimizedImageUrl } from '../../constants/media.ts';
import { VFC_WHATSAPP_NUMBER, VFC_WHATSAPP_MESSAGE } from '../../constants/contact.ts';
import {
  ArrowLeft, Heart, Share2, ShieldCheck, Zap, Droplets, Shield,
  Bed, Bath, Maximize, Calendar, MapPin, Phone, MessageSquare,
  Sparkles, Compass, ChevronLeft, ChevronRight, RefreshCw, Home, AlertTriangle
} from 'lucide-react';

export const PropertyDetail: React.FC = () => {
  // L'identifiant fait foi depuis l'URL (`/properties/:id`) : un accès direct,
  // un rafraîchissement ou un partage de lien charge toujours le bon bien. Le
  // store ne sert que de repli lorsque le composant est monté hors route.
  const { id: routeId } = useParams<{ id: string }>();
  const {
    selectedPropertyId, setView, favorites, toggleFavorite,
    openVisitModal, openVirtualTour, addNotification
  } = useAppStore(useShallow((s) => ({
    selectedPropertyId: s.selectedPropertyId,
    setView: s.setView,
    favorites: s.favorites,
    toggleFavorite: s.toggleFavorite,
    openVisitModal: s.openVisitModal,
    openVirtualTour: s.openVirtualTour,
    addNotification: s.addNotification,
  })));

  const propertyId = routeId && routeId.trim() ? routeId : selectedPropertyId;

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);

  // Chargement du bien. Toute issue est explicite : succès, introuvable (404),
  // ou erreur réseau/serveur — jamais un spinner infini.
  useEffect(() => {
    if (!propertyId) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setNotFound(false);
    setActiveImageIndex(0);

    (async () => {
      try {
        const data = await api.getPropertyById(propertyId);
        if (cancelled) return;
        if (!data) {
          setNotFound(true);
        } else {
          setProperty(data);
        }
      } catch (err: any) {
        if (cancelled) return;
        if (err?.status === 404) {
          setNotFound(true);
        } else {
          setError(err?.message || 'Impossible de charger les informations de ce bien.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [propertyId, reloadToken]);

  // Préchargement du reste de la galerie dès l'affichage de la fiche : sans cela,
  // chaque clic sur une vignette déclenche le téléchargement de l'image pleine
  // résolution au moment même où l'utilisateur veut la voir (délai visible).
  useEffect(() => {
    if (!property) return;
    const sources = property.galleryImages?.length
      ? property.galleryImages
      : property.images?.map((image) => image.url) ?? [];
    sources.forEach((src) => {
      const preloaded = new Image();
      preloaded.src = src;
    });
  }, [property]);

  const isFav = property ? favorites.includes(property.id) : false;

  const gallery = useMemo<string[]>(() => {
    if (!property) return [];
    const raw = property.galleryImages?.length
      ? property.galleryImages
      : property.images?.map((image) => image.url) ?? [];
    return raw.length > 0
      ? raw
      : [property.coverImage || property.featuredImage || property.images?.[0]?.url || FALLBACK_PROPERTY_IMAGE];
  }, [property]);

  const handlePrevImage = useCallback(() => {
    setActiveImageIndex((prev) => (gallery.length ? (prev > 0 ? prev - 1 : gallery.length - 1) : 0));
  }, [gallery.length]);

  const handleNextImage = useCallback(() => {
    setActiveImageIndex((prev) => (gallery.length ? (prev < gallery.length - 1 ? prev + 1 : 0) : 0));
  }, [gallery.length]);

  // Navigation clavier de la galerie. Ce hook est déclaré AVANT tout retour
  // conditionnel : l'ordre des hooks reste stable entre chaque rendu.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrevImage();
      if (e.key === 'ArrowRight') handleNextImage();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevImage, handleNextImage]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="w-12 h-12 border-4 border-emerald-800 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-500 mt-4">Chargement des données certifiées du bien...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
          <Home className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold text-emerald-950 font-serif">Bien introuvable</h1>
        <p className="text-sm text-slate-600">
          Cette offre n'existe pas ou n'est plus disponible au catalogue. Elle a peut-être été retirée du marché.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            to="/properties"
            className="px-4 py-2.5 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors"
          >
            Consulter tout le catalogue
          </Link>
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold text-emerald-950 font-serif">Fiche momentanément indisponible</h1>
        <p className="text-sm text-slate-600">
          {error || 'Une erreur est survenue lors du chargement de ce bien.'}
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setReloadToken((token) => token + 1)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Réessayer</span>
          </button>
          <Link
            to="/properties"
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:border-slate-300 transition-colors"
          >
            Retour au catalogue
          </Link>
        </div>
      </div>
    );
  }

  const isSale = property.category === 'SALE';

  // Referent contact resolved from the agent / landlord persisted in Neon — never a local placeholder.
  const referent = property.agent ?? property.landlord;
  const referentName = referent?.fullName ?? 'Conciergerie Vallées Fleuries';
  const referentRole = referent?.companyName ?? (property.agent ? 'Conseiller Immobilier VFC' : 'Propriétaire Vérifié VFC');
  const referentPhone = referent?.phoneNumber ?? '';
  const referentWhatsAppHref = `https://wa.me/${(referentPhone || `+${VFC_WHATSAPP_NUMBER}`).replace(/\D/g, '')}?text=${encodeURIComponent(VFC_WHATSAPP_MESSAGE)}`;

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    addNotification('Lien de la propriété copié dans le presse-papier !', 'info');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

      {/* Top Navigation & Breadcrumbs */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setView('properties')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-900 hover:text-emerald-700 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour à l'exploration</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            title="Partager"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => toggleFavorite(property.id)}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-rose-500 transition-colors cursor-pointer"
            title="Favori"
          >
            <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Lightbox Gallery */}
      <div className="space-y-4">
        <div className="relative h-[480px] sm:h-[560px] rounded-3xl overflow-hidden shadow-2xl border border-white/60 bg-black">
          <img
            src={gallery[activeImageIndex] || property.featuredImage || FALLBACK_PROPERTY_IMAGE}
            alt={property.title}
            referrerPolicy="no-referrer"
            decoding="async"
            className="w-full h-full object-cover transition-all duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

          {/* Gallery Navigation Arrows */}
          {gallery.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrevImage}
                aria-label="Photo précédente"
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-md text-white flex items-center justify-center transition-all cursor-pointer border border-white/20 hover:scale-110 shadow-lg"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleNextImage}
                aria-label="Photo suivante"
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-md text-white flex items-center justify-center transition-all cursor-pointer border border-white/20 hover:scale-110 shadow-lg"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Floating Action: 3D Virtual Tour & Photo Counter */}
          <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between gap-3">
            <button
              onClick={openVirtualTour}
              className="px-4 py-2.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 text-amber-300 backdrop-blur-md border border-amber-400/30 text-xs font-bold shadow-xl flex items-center gap-2 transition-transform hover:scale-105 cursor-pointer"
            >
              <Compass className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '8s' }} />
              <span>Visite Immersive 360° Matterport</span>
            </button>

            {gallery.length > 1 && (
              <span className="px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md text-white text-xs font-mono font-bold border border-white/20">
                {activeImageIndex + 1} / {gallery.length}
              </span>
            )}
          </div>

          {/* Verification Watermark */}
          <div className="absolute top-6 right-6 px-3 py-1.5 rounded-xl bg-white/90 backdrop-blur-md border border-white/60 text-emerald-950 text-xs font-bold flex items-center gap-2 shadow-lg">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <span>{isSale ? "Acte de Vente Certifié Côte d'Ivoire" : "Contrat de Location Certifié Côte d'Ivoire"}</span>
          </div>
        </div>

        {/* Thumbnail Selector */}
        {gallery.length > 1 && (
          <div className="flex items-center gap-3 overflow-x-auto pb-2">
            {gallery.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setActiveImageIndex(idx)}
                className={`relative w-24 h-20 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                  activeImageIndex === idx ? 'border-emerald-600 scale-105 shadow-md' : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <img
                  src={optimizedImageUrl(img, 240)}
                  alt={`Aperçu ${idx + 1}`}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Grid: Details on Left, Contact & Visit Widget on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">

        {/* Left Column: Specs, Description, Land Title & Amenities */}
        <div className="lg:col-span-8 space-y-8">

          {/* Header & Meta */}
          <div className="space-y-3">
            {/* Zero-pill clean unboxed metadata */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-emerald-900">{property.city}</span>
              <span aria-hidden="true">·</span>
              <span>{property.commune}</span>
              <span aria-hidden="true">·</span>
              <span>{property.neighborhood}</span>
              <span aria-hidden="true">·</span>
              <span>Réf. {property.id.toUpperCase()}</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold text-emerald-950 font-serif leading-tight">
              {property.title}
            </h1>

            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{property.address}</span>
            </p>
          </div>

          {/* Quick Specifications Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-2xl liquid-glass border border-white/60">
            {property.bedrooms > 0 && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Bed className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Chambres</span>
                  <span className="text-sm font-bold text-slate-900">{property.bedrooms} suites</span>
                </div>
              </div>
            )}

            {property.bathrooms > 0 && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Bath className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Salles d'eau</span>
                  <span className="text-sm font-bold text-slate-900">{property.bathrooms} bains</span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <Maximize className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Superficie</span>
                <span className="text-sm font-bold text-slate-900">{property.surfaceM2} m²</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Certification</span>
                <span className="text-sm font-bold text-emerald-900">{isSale ? 'Vente Ferme' : 'Location Vérifiée CI'}</span>
              </div>
            </div>
          </div>

          {/* Detailed Description */}
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-emerald-950 font-serif">
              Présentation architecturale & Caractéristiques
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {property.description}
            </p>
          </div>

          {/* Amenities from Neon (only what the property actually declares) */}
          {property.amenities?.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-emerald-950 font-serif">
                Équipements & Prestations
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {property.amenities.map((amenity) => (
                  <div
                    key={amenity.id}
                    className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-2.5"
                  >
                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-xs font-semibold text-slate-800">{amenity.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ivorian Specific Utilities (Crucial for Abidjan) */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-emerald-950 font-serif">
              Autonomie & Équipements de Sécurité Garantie
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm flex items-start gap-3">
                <Zap className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Groupe Électrogène de Relève</span>
                  <span className="text-xs text-slate-500">Alimentation continue automatique sans coupure lors des variations du réseau national.</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm flex items-start gap-3">
                <Droplets className="w-5 h-5 text-cyan-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Cuve à Eau & Surpresseur DAB</span>
                  <span className="text-xs text-slate-500">Réserve d'eau tampon garantissant une pression optimale 24h/24.</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm flex items-start gap-3">
                <Shield className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Gardiennage Armé & Vidéosurveillance</span>
                  <span className="text-xs text-slate-500">Poste de garde d'entrée, caméras dômes infrarouges et clôture électrique certifiée.</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Climatisation Inverter Intégrale</span>
                  <span className="text-xs text-slate-500">Splits silencieux basse consommation dans chaque suite et séjour de réception.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Legal & Title Panel — Vente (Acte / Titre Foncier) ou Location (Bail Loi 2019-576) */}
          <div className="p-6 rounded-2xl liquid-glass-card bg-emerald-950 text-white space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-800/80 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <h4 className="text-base font-bold font-serif">
                  Dossier Foncier & Juridique Certifié
                </h4>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-300 bg-emerald-900 px-2.5 py-1 rounded">
                Statut : Conforme & Opposable
              </span>
            </div>

            {isSale ? (
              <>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Le titre de propriété, l'état des droits réels et les diagnostics techniques sont rigoureusement audités avant toute promesse de vente en République de Côte d'Ivoire.
                </p>

                <div className="p-3.5 rounded-xl bg-emerald-900/60 border border-emerald-700/50 text-xs font-mono space-y-1 text-emerald-200">
                  <div>Cadre Juridique : <strong className="text-white">Promesse Synallagmatique de Vente</strong></div>
                  <div>Dossier Foncier : <strong className="text-amber-300">Titre Foncier / ACD Vérifié</strong></div>
                  <div>Juridiction Territoriale : <strong className="text-white">Tribunal de Commerce d'Abidjan</strong></div>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Le contrat de bail et les diagnostics sont rigoureusement audités conformément à la Loi N° 2019-576 du 26 juin 2019 régissant les baux d'habitation en République de Côte d'Ivoire.
                </p>

                <div className="p-3.5 rounded-xl bg-emerald-900/60 border border-emerald-700/50 text-xs font-mono space-y-1 text-emerald-200">
                  <div>Cadre Légal : <strong className="text-white">Bail d'Habitation Conforme Loi 2019-576</strong></div>
                  <div>Plafond Légal : <strong className="text-amber-300">2 Mois Avance + 2 Mois Caution Maximum</strong></div>
                  <div>Juridiction Territoriale : <strong className="text-white">Tribunal de Commerce d'Abidjan</strong></div>
                </div>
              </>
            )}
          </div>

        </div>

        {/* Right Column: Pricing, Visit & Contact widget */}
        <div className="lg:col-span-4 sticky top-28 space-y-6">

          {/* Main Action Card */}
          <div className="liquid-glass-card bg-white/95 rounded-3xl p-6 shadow-2xl border border-white/70 space-y-5">

            {/* Price display */}
            <div className="border-b border-slate-100 pb-4">
              <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider block">
                {isSale ? 'Prix de vente' : 'Loyer mensuel conventionné'}
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-950 tabular-nums">
                  {formatFcfa(property.priceFcfa)}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {isSale ? 'FCFA' : '/ mois'}
                </span>
              </div>
              <p className="text-[11px] text-emerald-700 font-medium mt-1">
                {isSale
                  ? "Frais de notaire & droits d'enregistrement en sus"
                  : 'Caution : 2 mois · Avance : 2 mois (Loi 2019-576)'}
              </p>
            </div>

            {/* Vente & Location longue durée : prise de rendez-vous uniquement. */}
            <div className="space-y-3">
              <button
                onClick={openVisitModal}
                className="w-full py-3 px-4 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white font-semibold text-xs tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-amber-300" />
                <span>Programmer une Visite Exclusive</span>
              </button>
            </div>

          </div>

          {/* Referent Contact Box — resolved from the cloud agent / landlord record */}
          <div className="liquid-glass rounded-2xl p-5 border border-white/60 space-y-4">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Conseiller Immobilier Référent
            </span>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-900 text-amber-400 flex items-center justify-center text-lg font-bold border-2 border-emerald-700">
                {referentName.charAt(0)}
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">{referentName}</h4>
                <p className="text-[11px] text-emerald-800 font-medium">{referentRole}</p>
                {referentPhone && (
                  <p className="text-[10px] text-slate-400 font-mono">{referentPhone}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <a
                href={referentWhatsAppHref}
                target="_blank"
                rel="noreferrer"
                className="py-2 px-3 rounded-lg bg-[#25D366] text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 shadow-sm hover:opacity-95 transition-opacity"
              >
                <MessageSquare className="w-3.5 h-3.5 fill-white" />
                <span>WhatsApp Direct</span>
              </a>

              <a
                href={referentPhone ? `tel:${referentPhone.replace(/\s/g, '')}` : `tel:+${VFC_WHATSAPP_NUMBER}`}
                className="py-2 px-3 rounded-lg bg-emerald-900 text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 shadow-sm hover:bg-emerald-800 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Appel Vocal</span>
              </a>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
