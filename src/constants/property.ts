// Vallées Fleuries Corporate — Référentiel des biens autorisés au catalogue.
// Source unique de vérité pour les filtres, le wizard de publication et les formulaires.
// Les valeurs restent alignées sur les énumérations Prisma / Neon : aucune migration requise.

import type { PropertyType, RentalCategory } from '../types/index.ts';

/** Typologies autorisées — uniquement du bâti (aucun terrain / parcelle). */
export const ALLOWED_PROPERTY_TYPES: PropertyType[] = [
  'APARTMENT',
  'VILLA',
  'STUDIO',
  'DUPLEX',
  'PENTHOUSE',
  'COMMERCIAL'
];

/** Natures d'offre autorisées : Vente et Location longue durée uniquement. */
export const ALLOWED_TRANSACTION_TYPES: RentalCategory[] = ['SALE', 'LONG_TERM_RENT'];

/** Libellés d'affichage français. */
export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  APARTMENT: 'Appartement',
  VILLA: 'Villa',
  STUDIO: 'Studio',
  DUPLEX: 'Duplex',
  PENTHOUSE: 'Penthouse',
  COMMERCIAL: 'Immeuble / Local professionnel'
};

export const TRANSACTION_TYPE_LABELS: Record<RentalCategory, string> = {
  SALE: 'Vente',
  LONG_TERM_RENT: 'Location',
  // Valeur historique conservée en base, retirée du catalogue public.
  SHORT_TERM_FURNISHED: 'Location'
};

/** Options prêtes à l'emploi pour les listes déroulantes et les filtres. */
export const PROPERTY_TYPE_OPTIONS: { value: PropertyType; label: string }[] =
  ALLOWED_PROPERTY_TYPES.map((value) => ({ value, label: PROPERTY_TYPE_LABELS[value] }));

export const TRANSACTION_TYPE_OPTIONS: { value: RentalCategory; label: string }[] =
  ALLOWED_TRANSACTION_TYPES.map((value) => ({ value, label: TRANSACTION_TYPE_LABELS[value] }));

/** Garde-fous à utiliser avant toute publication pour rejeter une valeur non autorisée. */
export const isAllowedPropertyType = (value: string): value is PropertyType =>
  ALLOWED_PROPERTY_TYPES.includes(value as PropertyType);

export const isAllowedTransactionType = (value: string): value is RentalCategory =>
  ALLOWED_TRANSACTION_TYPES.includes(value as RentalCategory);
