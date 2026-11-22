// Vallées Fleuries Corporate - Domain Types & Interfaces
// Plateforme immobilière ivoirienne : VENTE et LOCATION de maisons & villas.
// (Offre publique limitée à la Vente et à la Location longue durée.)

export type UserRole = 'TENANT' | 'OWNER' | 'AGENT' | 'ADMIN' | 'SUPER_ADMIN';

/**
 * Nature de l'offre publiée au catalogue.
 *  - SALE                  : Vente (acquisition définitive d'une maison / villa)
 *  - LONG_TERM_RENT        : Location Longue Durée (bail 1 an+)
 *  - SHORT_TERM_FURNISHED  : héritage — conservée en base, retirée du catalogue public
 */
export type ListingCategory =
  | 'SALE'                  // Vente (acquisition définitive)
  | 'LONG_TERM_RENT'        // Location Longue Durée (Bail 1 an+)
  | 'SHORT_TERM_FURNISHED'; // Héritage (retirée du catalogue public)

/** Alias historique conservé pour les modules encore nommés « rental ». */
export type RentalCategory = ListingCategory;

export type PropertyType = 
  | 'APARTMENT'
  | 'VILLA'
  | 'STUDIO'
  | 'DUPLEX'
  | 'PENTHOUSE'
  | 'COMMERCIAL';

export type FurnishingStatus = 
  | 'UNFURNISHED'
  | 'SEMI_FURNISHED'
  | 'FULLY_FURNISHED';

export type PropertyStatus = 
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'RESERVED'
  | 'UNDER_MAINTENANCE'
  | 'PENDING_REVIEW'
  | 'PUBLISHED'
  | 'RENTED';

export type VisitType = 'IN_PERSON' | 'VIRTUAL_3D' | 'PHYSICAL' | 'VIDEO_CALL';
export type VisitStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type LeaseStatus = 'DRAFT' | 'PENDING_SIGNATURE' | 'ACTIVE' | 'TERMINATED' | 'EXPIRED';

export interface User {
  id: string;
  email: string;
  phoneNumber: string; // e.g. "+225 07 08 09 10 11"
  fullName: string;
  role: UserRole;
  avatarUrl?: string;
  companyName?: string;
  isKycVerified: boolean;
  createdAt: string;
}

export interface PropertyImage {
  id: string;
  url: string;
  caption?: string;
  isCover: boolean;
  displayOrder?: number;
}

/**
 * Normalised Ivorian geography served by the Neon cloud database.
 * Drives every city / commune / neighbourhood filter in the catalogue.
 */
export interface Commune {
  id: string;
  code: string;
  name: string;
  neighborhoods: string[];
}

export interface City {
  id: string;
  code: string;
  name: string;
  region: string;
  description?: string;
  latitude: number;
  longitude: number;
  communes: Commune[];
}

export interface Amenity {
  id: string;
  code: string;
  name: string;
  category?: 'SECURITY' | 'COMFORT' | 'LUXURY' | 'CONNECTIVITY';
  iconName: string;
}

export interface Property {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: ListingCategory;
  type: PropertyType;
  status: PropertyStatus;
  furnishing: FurnishingStatus;
  
  // Pricing in West African CFA Francs (FCFA / XOF)
  // For Long-Term: priceFcfa is Monthly Rent
  // For Short-Term: priceFcfa is Nightly Rate
  priceFcfa: number;
  depositMonths: number;    // Standard Ivorian Legal Rule: 2 mois de caution
  advanceMonths: number;    // Standard Ivorian Legal Rule: 2 mois d'avance
  agencyFeeMonths: number;  // Standard Ivorian Agency Fee: 1 mois d'honoraires
  keyMoneyFcfa?: number;    // Pas de porte éventuel
  serviceChargeFcfa?: number; // Charges copropriété mensuelles
  cleaningFeeFcfa?: number; // Frais de ménage (héritage)
  isNegotiable: boolean;

  // Geographical Location (Abidjan & Côte d'Ivoire)
  city: string;             // "Abidjan", "Assinie", "Yamoussoukro"
  commune: string;          // "Cocody", "Marcory", "Plateau", "Riviera"
  neighborhood: string;     // "Riviera Golf", "Zone 4", "Deux-Plateaux Vallons"
  address: string;
  latitude: number;
  longitude: number;

  // Structural Specifications
  surfaceM2: number;
  bedrooms: number;
  bathrooms: number;
  floorNumber?: number;
  totalFloors?: number;
  hasElevator: boolean;
  hasGenerator: boolean;     // Groupe électrogène
  hasWaterReserve: boolean;  // Réserve d'eau SODECI
  hasSwimmingPool: boolean;  // Piscine
  hasSecurity247: boolean;   // Sécurité & Gardiennage 24/7
  hasFiberInternet: boolean; // Connexion Fibre Optique

  // Convenience aliases for backward compatibility with UI components
  featuredImage?: string;
  coverImage?: string;
  galleryImages?: string[];
  hasBackupGenerator?: boolean;
  hasAirConditioning?: boolean;
  livingRooms?: number;

  // Media
  virtualTourUrl?: string;
  images: PropertyImage[];
  amenities: Amenity[];

  // Landlord / Owner info
  ownerId?: string;
  ownerName?: string;
  ownerPhone?: string;
  agent?: {
    fullName: string;
    phoneNumber: string;
    companyName?: string;
  };
  landlord?: {
    id: string;
    fullName: string;
    phoneNumber: string;
    isKycVerified: boolean;
    companyName?: string;
  };

  createdAt: string;
  updatedAt?: string;
}

export interface MoveInCostBreakdown {
  monthlyRent: number;
  monthlyRentFcfa?: number;
  advanceMonths: number;
  advanceAmount: number;
  advanceAmountFcfa?: number;
  depositMonths: number;
  depositAmount: number;
  depositAmountFcfa?: number;
  agencyFeeMonths: number;
  agencyFeeAmount: number;
  agencyFeeAmountFcfa?: number;
  keyMoney: number;
  keyMoneyFcfa?: number;
  serviceCharges: number;
  serviceChargeFcfa?: number;
  leaseDraftingFeeFcfa?: number;
  stampDutyAndRegistration: number; // Enregistrement fiscal légal CI (2.5%)
  totalUpfrontCost: number;
  totalInitialPayoutFcfa?: number;
  legalNotice?: string;
  currency: 'FCFA';
}

export interface Booking {
  id: string;
  bookingNumber: string;
  propertyId: string;
  propertyTitle?: string;
  propertyCommune?: string;
  propertyImage?: string;
  tenantId: string;
  tenantName: string;
  tenantPhone: string;
  checkInDate: string;
  checkOutDate: string;
  startDate?: string;
  endDate?: string;
  numberOfNights: number;
  nightsOrMonths?: number;
  numberOfGuests: number;
  nightlyRateFcfa: number;
  cleaningFeeFcfa: number;
  totalAmountFcfa: number;
  status: BookingStatus;
  specialRequests?: string;
  createdAt: string;
}

export interface LeaseAgreement {
  id: string;
  leaseNumber: string;
  propertyId: string;
  propertyTitle?: string;
  tenantId: string;
  tenantName: string;
  tenantPhone: string;
  ownerId: string;
  ownerName: string;
  startDate: string;
  endDate: string;
  monthlyRentFcfa: number;
  depositAmountFcfa: number;
  advanceAmountFcfa: number;
  agencyFeeFcfa: number;
  keyMoneyFcfa: number;
  totalMoveInFcfa: number;
  status: LeaseStatus;
  contractPdfUrl?: string;
  signedAt?: string;
  createdAt: string;
}

export interface VisitAppointment {
  id: string;
  propertyId: string;
  propertyTitle: string;
  propertyImage?: string;
  commune: string;
  tenantId: string;
  userId?: string;
  userName?: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  visitDate: string;
  scheduledDate?: string;
  scheduledTime?: string;
  timeSlot: string;
  type: VisitType;
  visitType?: VisitType;
  status: VisitStatus;
  notes?: string;
  adminMessage?: string;
  whatsAppNotifyUrl?: string;
  createdAt: string;
}

export interface FilterState {
  category?: ListingCategory | 'ALL';
  commune?: string;
  type?: PropertyType | 'ALL';
  propertyType?: PropertyType | 'ALL';
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number | 'ALL';
  furnishing?: FurnishingStatus | 'ALL';
  amenities?: string[];
  searchQuery?: string;
  city?: string;
  hasBackupGenerator?: boolean;
  hasWaterReserve?: boolean;
  hasSecurity247?: boolean;
  hasSwimmingPool?: boolean;
}

/** Alerte persistante du Command Center, rechargée par la cloche admin. */
export interface AdminNotification {
  id: string;
  type: string;
  propertyTitle: string;
  commune: string;
  clientName: string;
  clientPhone: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  message: string;
  read: boolean;
  receivedAt: string;
}
