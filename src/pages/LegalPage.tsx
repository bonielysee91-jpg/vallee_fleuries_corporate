import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, ShieldCheck, Scale, Info } from 'lucide-react';
import { VFC_WEBSITE_URL, VFC_WEBSITE_DISPLAY } from '../constants/contact.ts';

/**
 * Rend un paragraphe en transformant l'adresse du site officiel en lien cliquable.
 * Les textes juridiques restent de simples chaînes ; on met en valeur le seul
 * canal réellement actionnable sans introduire de balisage lourd dans les données.
 */
const renderParagraph = (paragraph: string, key: number): React.ReactNode => {
  const parts = paragraph.split(VFC_WEBSITE_DISPLAY);
  if (parts.length === 1) {
    return (
      <p key={key} className="text-sm text-slate-600 leading-relaxed">
        {paragraph}
      </p>
    );
  }
  return (
    <p key={key} className="text-sm text-slate-600 leading-relaxed">
      {parts.map((part, index) => (
        <React.Fragment key={index}>
          {part}
          {index < parts.length - 1 && (
            <a
              href={VFC_WEBSITE_URL}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-emerald-800 underline decoration-emerald-300 underline-offset-2 hover:text-amber-600 hover:decoration-amber-400 transition-colors"
            >
              {VFC_WEBSITE_DISPLAY}
            </a>
          )}
        </React.Fragment>
      ))}
    </p>
  );
};

/**
 * `/legal/:section` — pages réglementaires du pied de page.
 * Trois documents : Conditions Générales, Barème Honoraires Agence,
 * Confidentialité & Données.
 *
 * ⚠️ Les textes ci-dessous sont des MODÈLES. Ils doivent être relus et validés
 * par un juriste ivoirien avant publication (droit OHADA / Code de la
 * construction et de l'habitat) et adaptés aux mentions R.C.M. réelles.
 */

type LegalBlock = { heading: string; paragraphs: string[] };

interface LegalDoc {
  key: string;
  title: string;
  eyebrow: string;
  intro: string;
  icon: React.ComponentType<{ className?: string }>;
  blocks: LegalBlock[];
}

const DOCS: Record<string, LegalDoc> = {
  conditions: {
    key: 'conditions',
    title: 'Conditions Générales',
    eyebrow: 'Conditions Générales d’Utilisation',
    intro:
      'Les présentes conditions régissent l’accès et l’utilisation de la plateforme Vallées Fleuries Corporate ainsi que les prestations de courtage immobilier fournies par la société.',
    icon: FileText,
    blocks: [
      {
        heading: '1. Objet et champ d’application',
        paragraphs: [
          'La plateforme Vallées Fleuries Corporate met en relation des propriétaires, bailleurs et acquéreurs pour la vente et la location de maisons et villas sur l’ensemble du territoire ivoirien.',
          'Toute utilisation du site vaut acceptation pleine et entière des présentes conditions. L’offre publique se limite aux opérations de Vente et de Location longue durée (bail d’un an et plus).'
        ]
      },
      {
        heading: '2. Compte utilisateur',
        paragraphs: [
          'La création d’un compte requiert une adresse e-mail valide et un numéro de téléphone ivoirien unique. L’accès aux fonctionnalités est immédiat après l’inscription.',
          'L’utilisateur s’engage à fournir des informations exactes et à maintenir la confidentialité de ses identifiants. Toute action réalisée depuis un compte est réputée effectuée par son titulaire.'
        ]
      },
      {
        heading: '3. Publication d’annonces',
        paragraphs: [
          'Seuls les biens de type Vente ou Location sont admis au catalogue. Les annonces de type résidence meublée courte durée ou « bail maison bailleur » sont exclues.',
          'Le déposant garantit détenir un titre ou un mandat valable sur le bien publié. Au moins une photographie est exigée pour toute mise en ligne. Vallées Fleuries Corporate se réserve le droit de modérer, suspendre ou retirer toute annonce non conforme.'
        ]
      },
      {
        heading: '4. Rôle de l’agence',
        paragraphs: [
          'Vallées Fleuries Corporate agit en qualité d’intermédiaire. Elle facilite la mise en relation, la préparation des dossiers et la sécurisation juridique des actes et des baux, sans devenir partie aux engagements de vente ou de bail conclus entre les utilisateurs.',
          'Les informations descriptives des biens sont fournies par les déposants ; l’agence ne saurait être tenue responsable des inexactitudes non signalées.'
        ]
      },
      {
        heading: '5. Droit applicable',
        paragraphs: [
          'Les présentes conditions sont soumises au droit ivoirien. Tout litige relève de la compétence exclusive des tribunaux d’Abidjan, sauf disposition légale contraire.'
        ]
      }
    ]
  },
  honoraires: {
    key: 'honoraires',
    title: 'Barème Honoraires Agence',
    eyebrow: 'Barème des Honoraires de Courtage',
    intro:
      'Le présent barème présente les honoraires pratiqués par Vallées Fleuries Corporate pour ses prestations de courtage immobilier. Montants indicatifs exprimés en francs CFA (XOF).',
    icon: Scale,
    blocks: [
      {
        heading: '1. Vente immobilière',
        paragraphs: [
          'Honoraires de courtage : commission assise sur le prix de vente, à la charge de l’acquéreur, sauf convention contraire formalisée dans le mandat.',
          'Aucun honoraire n’est dû tant que la vente n’est pas effective. Le montant définitif figure au mandat signé avec le vendeur et sur le mandat de recherche de l’acquéreur.'
        ]
      },
      {
        heading: '2. Location longue durée (bail 1 an et plus)',
        paragraphs: [
          'Frais d’entrée locative : composition et sécurisation du dossier, état des lieux contradictoire et formalisation du bail.',
          'Les frais d’entrée sont calculés et affichés de manière transparente via le calculateur de frais d’entrée de la plateforme, avant tout engagement.'
        ]
      },
      {
        heading: '3. Prestations de conciergerie et de mise en relation',
        paragraphs: [
          'La visite d’un bien, la constitution d’un dossier de candidature ou la mise en relation avec un professionnel (notaire, géomètre, syndic) peuvent donner lieu à des frais de service forfaitaires.',
          'Ces frais sont communiqués à l’utilisateur avant tout engagement, directement dans l’interface, en application du principe de transparence tarifaire.'
        ]
      }
    ]
  },
  confidentialite: {
    key: 'confidentialite',
    title: 'Confidentialité & Données',
    eyebrow: 'Politique de Confidentialité et de Protection des Données',
    intro:
      'Cette politique décrit les données personnelles collectées par Vallées Fleuries Corporate, la finalité de leur traitement et les droits dont disposent les utilisateurs, conformément à la loi ivoirienne relative à la protection des données à caractère personnel (ARTCI).',
    icon: ShieldCheck,
    blocks: [
      {
        heading: '1. Données collectées',
        paragraphs: [
          'Informations d’identification : nom complet, adresse e-mail, numéro de téléphone, rôle sur la plateforme.',
          'Données d’usage : biens consultés, demandes de visite, échanges avec la conciergerie et historique des échanges. Les échanges téléphoniques de vérification sont limités au strict nécessaire à la validation du compte.'
        ]
      },
      {
        heading: '2. Finalités du traitement',
        paragraphs: [
          'Gestion des comptes et de l’authentification (identifiant et mot de passe).',
          'Mise en relation, traitement des demandes de visite, édition des baux, prévention de la fraude et respect des obligations légales.'
        ]
      },
      {
        heading: '3. Conservation et sécurité',
        paragraphs: [
          'Les données sont hébergées sur une base PostgreSQL sécurisée (Neon), avec chiffrement des échanges. Les mots de passe sont stockés sous forme de condensats (hash) non réversibles.',
          'Les données ne sont conservées que pendant la durée nécessaire aux finalités décrites, majorée des délais légaux de conservation.'
        ]
      },
      {
        heading: '4. Partage des données',
        paragraphs: [
          'Aucune donnée n’est cédée ni vendue à des tiers. Elles ne sont partagées qu’avec les prestataires strictement nécessaires (opérateurs SMS pour la délivrance des codes de validation d’accès) et pour la seule exécution de la prestation.',
          'Les codes de validation envoyés par SMS ne sont jamais affichés à l’écran ni renvoyés au navigateur.'
        ]
      },
      {
        heading: '5. Vos droits',
        paragraphs: [
          'Vous disposez d’un droit d’accès, de rectification, d’effacement et d’opposition sur vos données personnelles.',
          'Pour exercer ces droits, contactez la direction à l’adresse WWW.valleesfleuries.com. Une réponse est apportée dans les meilleurs délais.'
        ]
      }
    ]
  }
};

const FALLBACK: LegalDoc = DOCS.conditions;

export const LegalPage: React.FC = () => {
  const { section } = useParams<{ section: string }>();
  const doc = useMemo(() => (section && DOCS[section]) || FALLBACK, [section]);
  const Icon = doc.icon;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-800 hover:text-amber-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour à l’accueil
      </Link>

      <header className="space-y-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-800 block">
          {doc.eyebrow}
        </span>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-900/90 text-amber-400 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5" />
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-emerald-950">{doc.title}</h1>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">{doc.intro}</p>
      </header>

      <div className="flex items-start gap-3 rounded-2xl border border-amber-300/60 bg-amber-50/70 px-4 py-3 text-xs text-amber-900">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Document modèle fourni à titre indicatif. Il sera finalisé et validé par un juriste avant
          sa publication définitive.
        </span>
      </div>

      <article className="space-y-7">
        {doc.blocks.map((block) => (
          <section key={block.heading} className="space-y-2">
            <h2 className="font-serif text-lg font-bold text-emerald-950">{block.heading}</h2>
            {block.paragraphs.map((paragraph, index) => renderParagraph(paragraph, index))}
          </section>
        ))}
      </article>

      <nav className="pt-6 border-t border-slate-200 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-emerald-800">
        {Object.values(DOCS).map((item) => (
          <Link
            key={item.key}
            to={`/legal/${item.key}`}
            className={`transition-colors hover:text-amber-600 ${
              item.key === doc.key ? 'text-amber-600' : ''
            }`}
          >
            {item.title}
          </Link>
        ))}
      </nav>
    </div>
  );
};
