import React from 'react';
import { MapPin } from 'lucide-react';
import { useAppStore } from '../store/useAppStore.ts';
import { useShallow } from 'zustand/react/shallow';

/**
 * `/avant-propos` — page institutionnelle présentant les entités et agréments
 * du groupe Vallées Fleuries Corporate (VFC).
 * Contenu fourni par la Direction.
 */

interface Section {
  id: string;
  badge: string;
  title: string;
  agrement: string | null;
  imageUrl: string;
  imageAlt: string;
  imageCaption: string;
  content: string;
}

const SECTIONS: Section[] = [
  {
    id: 'vfc',
    badge: 'Présentation • Depuis le 07 Mai 2012',
    title: 'Vallées Fleuries Corporate (VFC)',
    agrement: null,
    imageUrl: '/images/avant-propos/vfc-siege.jpg',
    imageAlt: 'Siège et architecture moderne — Vallées Fleuries Corporate',
    imageCaption: 'Siège et architecture moderne — Vallées Fleuries Corporate',
    content:
      "La société Vallées Fleuries Corporate (VFC) est une société à responsabilité limitée (SARL) au capital de 5.000.000 FCFA créée le 07 Mai 2012, spécialisée dans les travaux publics, le génie civil, le génie rural, la construction, l’aménagement foncier et la gestion immobilière. Elle regroupe trois (03) secteurs d’activités pour lesquels la société Vallées Fleuries Corporate s’est vue délivrer par le Ministère de la Construction, du Logement, de l’Assainissement et de l’Urbanisme de la Côte d’Ivoire (MCLAU) un agrément pour chacun des trois (03) domaines, à savoir :",
  },
  {
    id: 'vfi',
    badge: 'Pôle Construction & Promotion',
    title: 'Vallées Fleuries Immobilier (VFI)',
    agrement: 'Agrément N° 0125/MCLAU/DGLCV/DLC/SDH/KFT',
    imageUrl: '/images/avant-propos/vfi-logements.jpg',
    imageAlt: 'Logements sociaux, économiques et de standing avec espaces verts',
    imageCaption: 'Logements sociaux, économiques et de standing avec espaces verts',
    content:
      "Vallées Fleuries Immobilier (VFI) : Agréée par l’arrêté numéro 0125/MCLAU/DGLCV/DLC/SDH/KFT du 28 octobre 2013, délivré par le Ministre de la Construction, du Logement, de l’Assainissement et de l’Urbanisme de la Côte d’Ivoire (MCLAU). Suite à la décision gouvernementale de réaliser des logements sociaux, économiques et de standing pour les Ivoiriens, la société Vallées Fleuries Corporate (VFC) a été retenue pour apporter son expertise et sa contribution à ce projet d’envergure. C’est ainsi que la société Vallées Fleuries Corporate (VFC) est attributaire de trois (03) sites qui se trouvent à Bingerville, Songon et Yamoussoukro, sur lesquels elle réalise des logements sociaux, économiques et de standing. Elle conçoit des sites paisibles, agréables et sécurisés qui tiennent compte du bien-être de chaque client. La société Vallées Fleuries Corporate prévoit également des espaces verts, des aires de jeux, des écoles, des centres de santé, des espaces commerciaux et des parkings dans ses différentes promotions. La société Vallées Fleuries Corporate procède aussi, à la demande du client, à la construction clé en main et à l’aménagement intérieur de certaines constructions.",
  },
  {
    id: 'vfa',
    badge: 'Pôle Foncier & Urbanisme',
    title: 'Vallées Fleuries Aménageur Foncier (VFA)',
    agrement: 'Agrément N° 15-0026 MCLAU/DGLCV/DLC/SDH/OGLA',
    imageUrl: '/images/avant-propos/vfa-lotissement.jpg',
    imageAlt: 'Aménagement foncier et terrains urbains avec ACD',
    imageCaption: 'Aménagement foncier et terrains urbains avec ACD',
    content:
      "Vallées Fleuries Aménageur Foncier (VFA) : Elle bénéficie de l’arrêté numéro 15-0026 MCLAU/DGLCV/DLC/SDH/OGLA du 22 Octobre 2015 pour exercer la profession d’aménageur foncier. En cette qualité, la société Vallées Fleuries Corporate aménage des terrains urbains et met à la disposition de ceux qui en font la demande divers lots conformément aux prescriptions urbanistiques. Le statut d’aménageur agréé de VFC garantit à l’acquéreur l’établissement des actes de pleine propriété pour tout terrain aménagé acheté auprès de notre société : il s’agit de l’ACD (Arrêté de Concession Définitive) délivré par le Ministère de la Construction et de l’Urbanisme. De plus, la société Vallées Fleuries Corporate opère conformément au plan d’urbanisation des villes de Côte d’Ivoire, comme en témoignent les projets déjà réalisés à Yamoussoukro et Abidjan.",
  },
  {
    id: 'vfg',
    badge: 'Pôle Gestion & Patrimoine',
    title: 'Vallées Fleuries Gestion Immobilière (VFG)',
    agrement: 'Agrément N° 15-0001/MCLAU/DGUF/CAAF',
    imageUrl: '/images/avant-propos/vfg-remise-cles.jpg',
    imageAlt: 'Gestion immobilière, remise de clés et sécurisation de patrimoine',
    imageCaption: 'Gestion immobilière, remise de clés et sécurisation de patrimoine',
    content:
      "Vallées Fleuries Gestion Immobilière (VFG), soucieuse de se conformer aux prescriptions légales de chaque secteur d’activité dans lequel elle exerce, bénéficie de l’arrêté numéro 15-0001/MCLAU/DGUF/CAAF pour avoir la qualité d’agent immobilier. À ce titre, elle sécurise le patrimoine immobilier qui lui est confié et maintient le bien en bon état locatif. La société Vallées Fleuries Corporate, en collaboration avec des experts partenaires du secteur, conseille dans l’établissement du prix du bien en location ou en vente. La société Vallées Fleuries Corporate est un partenaire qui met à l’abri de tout risque dans une transaction immobilière, par son expérience dans l’acquisition des sites immobiliers et des pièces administratives afférentes. En somme, la société Vallées Fleuries Corporate est la synthèse d’un savoir-faire et d’une innovation permanente qui se traduit par une plus-value pour nos clients. La recherche constante d’une valeur ajoutée dans l’exercice de sa profession, quel que soit le secteur d’activité, reste son leitmotiv pour la plus grande satisfaction du client.",
  },
];

interface Perimeter {
  id: string;
  city: string;
  label: string;
  zones: string[];
}

/**
 * Périmètres d'intervention. Les communes sont nommées exactement comme dans le
 * référentiel géographique de l'application (prisma/seed.ts) afin que le clic
 * ouvre une recherche réellement filtrée.
 */
const PERIMETERS: Perimeter[] = [
  {
    id: 'abidjan',
    city: 'Abidjan',
    label: 'Capitale économique',
    zones: ['Cocody', 'Plateau', 'Marcory', 'Yopougon', 'Riviera'],
  },
  {
    id: 'yamoussoukro',
    city: 'Yamoussoukro',
    label: 'Capitale politique',
    zones: ['Habitat', 'Centre-Ville'],
  },
  {
    id: 'bouake',
    city: 'Bouaké',
    label: 'Carrefour commercial du centre',
    zones: ['Air France', 'Belleville'],
  },
  {
    id: 'assinie',
    city: 'Assinie',
    label: 'Station balnéaire — bord de mer',
    zones: ['Assinie-Mafia', 'Assinie-France'],
  },
];

export const AvantProposPage: React.FC = () => {
  const { setFilters, setView } = useAppStore(useShallow((s) => ({
    setFilters: s.setFilters,
    setView: s.setView,
  })));

  const handleSelectZone = (city: string, commune: string) => {
    setFilters({ city, commune });
    setView('properties');
  };

  return (
    <section className="bg-[#F6F7F4] py-16 px-4 sm:px-6 lg:px-8 text-slate-800">
      <div className="max-w-6xl mx-auto">
        {/* En-tête de la page */}
        <header className="text-center mb-16">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">
            Notre Institution
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-slate-900">
            À propos
          </h1>
          <div className="mt-4 mx-auto h-1 w-20 rounded bg-emerald-600" />
        </header>

        {/* Sections alternées Texte / Image */}
        <div className="space-y-20">
          {SECTIONS.map((section, index) => {
            const isReversed = index % 2 === 1;

            return (
              <article
                key={section.id}
                className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
                  {/* Bloc Image */}
                  <div
                    className={`lg:col-span-5 relative min-h-[280px] sm:min-h-[360px] bg-slate-200 ${
                      isReversed ? 'lg:order-2' : 'lg:order-1'
                    }`}
                  >
                    <img
                      src={section.imageUrl}
                      alt={section.imageAlt}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-4">
                      <p className="text-xs sm:text-sm font-medium text-white">
                        {section.imageCaption}
                      </p>
                    </div>
                  </div>

                  {/* Bloc Texte */}
                  <div
                    className={`lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center ${
                      isReversed ? 'lg:order-1' : 'lg:order-2'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                        {section.badge}
                      </span>
                      {section.agrement && (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 border border-amber-200">
                          {section.agrement}
                        </span>
                      )}
                    </div>

                    <h2 className="text-2xl font-bold text-slate-900 mb-4">
                      {section.title}
                    </h2>

                    <p className="text-slate-600 leading-relaxed text-justify text-sm sm:text-base">
                      {section.content}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Périmètres d'intervention */}
        <section className="mt-20">
          <header className="text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">
              Couverture nationale
            </p>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900">
              Périmètres d'intervention
            </h2>
            <div className="mt-4 mx-auto h-1 w-20 rounded bg-emerald-600" />
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {PERIMETERS.map((perimeter) => (
              <article
                key={perimeter.id}
                className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-700" />
                  <h3 className="text-lg font-semibold text-slate-900">{perimeter.city}</h3>
                </div>
                <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                  {perimeter.label}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {perimeter.zones.map((zone) => (
                    <button
                      key={zone}
                      type="button"
                      onClick={() => handleSelectZone(perimeter.city, zone)}
                      className="px-3 py-1.5 rounded-full border border-emerald-200 bg-emerald-50 text-xs font-medium text-emerald-800 transition-colors hover:bg-emerald-100 cursor-pointer"
                    >
                      {zone}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-slate-600">
            Couverture nationale — <strong className="font-semibold text-slate-900">57 villes</strong> sur
            l'ensemble du territoire ivoirien.
          </p>
        </section>
      </div>
    </section>
  );
};
