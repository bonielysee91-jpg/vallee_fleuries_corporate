import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore.ts';
import { api, formatFcfa } from '../../services/api.ts';
import { Property } from '../../types/index.ts';
import { FALLBACK_PROPERTY_IMAGE } from '../../constants/media.ts';
import { VFC_WHATSAPP_NUMBER, VFC_WHATSAPP_MESSAGE } from '../../constants/contact.ts';
import { 
  ArrowLeft, Heart, Share2, ShieldCheck, Zap, Droplets, Shield, 
  Bed, Bath, Maximize, Calendar, Clock, MapPin, Phone, MessageSquare, 
  Sparkles, CheckCircle2, FileText, Compass, CreditCard
} from 'lucide-react';

export const PropertyDetail: React.FC = () => {
  const { 
    selectedPropertyId, setView, favorites, toggleFavorite, 
    openVisitModal, openPaymentModal, openVirtualTour, addNotification 
  } = useAppStore();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    if (selectedPropertyId) {
      setLoading(true);
      api.getPropertyById(selectedPropertyId).then((data) => {
        setProperty(data);
        setLoading(false);
      });
    }
  }, [selectedPropertyId]);

  if (loading || !property) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="w-12 h-12 border-4 border-emerald-800 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-500 mt-4">Chargement des données certifiées du bien...</p>
      </div>
    );
  }

  const isFav = favorites.includes(property.id);
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

  const rawGallery = property.galleryImages || (property.images ? property.images.map(i => i.url) : []);
  const gallery: string[] = rawGallery.length > 0 
    ? rawGallery 
    : [property.coverImage || property.featuredImage || property.images?.[0]?.url || FALLBACK_PROPERTY_IMAGE];

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
            src={gallery[activeImageIndex] || property.featuredImage}
            alt={property.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-all duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

          {/* Floating Action: 3D Virtual Tour */}
          <div className="absolute bottom-6 left-6 flex flex-wrap gap-3">
            <button
              onClick={openVirtualTour}
              className="px-4 py-2.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 text-amber-300 backdrop-blur-md border border-amber-400/30 text-xs font-bold shadow-xl flex items-center gap-2 transition-transform hover:scale-105 cursor-pointer"
            >
              <Compass className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '8s' }} />
              <span>Visite Immersive 360° Matterport</span>
            </button>
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
                <img src={img} alt={`Aperçu ${idx + 1}`} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Grid: Details on Left, Booking / Pricing Widget on Right */}
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
            {property.bedrooms && (
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

            {property.bathrooms && (
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
                  <span className="text-xs text-slate-500">Réserve d'eau tampon de 5 000 Litres garantissant une pression optimale 24h/24.</span>
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

        {/* Right Column: Pricing, Move-In Simulator / Booking Widget & Agent */}
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

            {/* Vente & Location longue durée : visites et réservation uniquement, aucun calcul « par nuit ». */}
            <div className="space-y-3">
              <button
                onClick={openVisitModal}
                className="w-full py-3 px-4 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white font-semibold text-xs tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-amber-300" />
                <span>Programmer une Visite Exclusive</span>
              </button>

              <button
                onClick={() => {
                  openPaymentModal({
                    amountFcfa: property.priceFcfa,
                    purpose: isSale
                      ? `Dépôt d'offre d'achat : ${property.title}`
                      : `Acompte de réservation : ${property.title}`,
                    propertyTitle: property.title,
                    // Rattache le paiement au bien : à l'encaissement confirmé, une location
                    // est automatiquement retirée du marché.
                    propertyId: property.id
                  });
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs tracking-wide shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <CreditCard className="w-4 h-4 text-white" />
                <span>{isSale ? "Déposer une Offre d'Achat" : 'Poser une Option de Réservation'}</span>
              </button>
            </div>

            <div className="pt-2 text-center">
              <span className="text-[11px] text-slate-400">
                Paiements certifiés sans frais Wave, Orange Money, MTN, Visa
              </span>
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
