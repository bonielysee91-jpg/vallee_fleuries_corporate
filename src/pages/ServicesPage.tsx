import React from 'react';
import { HardHat, Building2, KeyRound, Ruler, Sofa, Trees } from 'lucide-react';

/**
 * `/services` — page dédiée présentant les autres activités de construction
 * de Vallées Fleuries Corporate (BTP, construction, gestion, aménagements).
 * Contenu fourni par la Direction.
 */

interface Service {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const SERVICES: Service[] = [
  {
    id: 'btp',
    label: 'BTP',
    icon: HardHat,
    description:
      "Travaux publics, génie civil et génie rural : voirie, assainissement, réseaux et ouvrages d'infrastructure réalisés selon les normes en vigueur.",
  },
  {
    id: 'construction',
    label: 'Construction',
    icon: Building2,
    description:
      "Logements sociaux, économiques et de standing, ainsi que la construction clé en main réalisée à la demande du client.",
  },
  {
    id: 'gestion-immobiliere',
    label: 'Gestion Immobilière',
    icon: KeyRound,
    description:
      "Sécurisation du patrimoine confié, maintien du bien en bon état locatif et conseil sur l'établissement du prix de vente ou de location.",
  },
  {
    id: 'amenagement-foncier',
    label: 'Aménagement Foncier',
    icon: Ruler,
    description:
      "Aménagement de terrains urbains et mise à disposition de lots conformes aux prescriptions urbanistiques, avec établissement des actes de pleine propriété (ACD).",
  },
  {
    id: 'amenagement-interieur',
    label: "Aménagement d'Intérieur",
    icon: Sofa,
    description:
      "Aménagement intérieur des constructions, réalisé à la demande du client pour un rendu fonctionnel et soigné.",
  },
  {
    id: 'amenagement-paysager',
    label: 'Aménagement Paysager',
    icon: Trees,
    description:
      "Conception d'espaces verts, d'aires de jeux et d'aménagements extérieurs au sein des promotions immobilières.",
  },
];

export const ServicesPage: React.FC = () => {
  return (
    <section className="bg-[#F6F7F4] py-16 px-4 sm:px-6 lg:px-8 text-slate-800">
      <div className="max-w-6xl mx-auto">
        {/* En-tête de la page */}
        <header className="text-center mb-14">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">
            Savoir-faire
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-slate-900">
            Nos Services
          </h1>
          <div className="mt-4 mx-auto h-1 w-20 rounded bg-emerald-600" />
          <p className="mt-6 max-w-3xl mx-auto text-slate-600 leading-relaxed text-sm sm:text-base">
            Vallées Fleuries Corporate s’est également orientée dans plusieurs autres
            activités de la construction, à savoir :
          </p>
        </header>

        {/* Grille des services */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {SERVICES.map((service) => {
            const Icon = service.icon;

            return (
              <article
                key={service.id}
                className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8 flex flex-col items-start gap-4 transition-shadow hover:shadow-md"
              >
                <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Icon className="w-7 h-7" />
                </span>
                <h2 className="text-lg font-semibold text-slate-900">{service.label}</h2>
                <p className="text-sm text-slate-600 leading-relaxed">{service.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
