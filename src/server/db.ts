/**
 * Vallées Fleuries Corporate — Neon PostgreSQL Data Repository
 * Dedicated EXCLUSIVELY to Property Rentals (Long-Term Rentals & Short-Stay Furnished Residences).
 *
 * Every read and write goes through Prisma to the Neon cloud database: there is
 * no in-memory fallback and no static catalogue. This module owns the mapping
 * between the persisted relational rows and the domain models consumed by the
 * Express API and the React client.
 */

import { Prisma } from '@prisma/client';
import { prisma } from './prisma.ts';
import {
  Amenity,
  Booking,
  LeaseAgreement,
  MoveInCostBreakdown,
  PaymentMethod,
  Property,
  QuittanceLoyer,
  Transaction,
  TransactionPurpose,
  VisitAppointment,
} from '../types/index.ts';

// -------------------------------------------------------------
// SHARED INCLUDE SHAPES & ROW TYPES
// -------------------------------------------------------------
const propertyInclude = {
  images: { orderBy: { displayOrder: 'asc' } },
  amenities: { include: { amenity: true } },
  owner: true,
  agent: true,
} satisfies Prisma.PropertyInclude;

const bookingInclude = {
  property: { include: { images: true } },
  tenant: true,
} satisfies Prisma.BookingInclude;

const visitInclude = {
  property: true,
  tenant: true,
} satisfies Prisma.VisitAppointmentInclude;

const transactionInclude = { property: true } satisfies Prisma.TransactionInclude;

type PropertyRow = Prisma.PropertyGetPayload<{ include: typeof propertyInclude }>;
type BookingRow = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;
type VisitRow = Prisma.VisitAppointmentGetPayload<{ include: typeof visitInclude }>;
type TransactionRow = Prisma.TransactionGetPayload<{ include: typeof transactionInclude }>;
type LeaseRow = Prisma.LeaseAgreementGetPayload<{
  include: { property: true; tenant: true; owner: true };
}>;
type QuittanceRow = Prisma.QuittanceGetPayload<Record<string, never>>;

// -------------------------------------------------------------
// ENUM NORMALISERS (arbitrary client strings → strict DB enums)
// -------------------------------------------------------------
const PAYMENT_METHODS: PaymentMethod[] = [
  'WAVE',
  'ORANGE_MONEY',
  'MTN_MOMO',
  'MOOV_MONEY',
  'CARD_CINETPAY',
  'CARD_PAYSTACK',
  'BANK_TRANSFER',
];

function toPaymentMethod(value: unknown): PaymentMethod {
  const candidate = String(value ?? '').toUpperCase().replace(/\s+/g, '_');
  return (PAYMENT_METHODS as string[]).includes(candidate) ? (candidate as PaymentMethod) : 'WAVE';
}

const TRANSACTION_PURPOSES: TransactionPurpose[] = [
  'SHORT_STAY_BOOKING',
  'MOVE_IN_PACKAGE',
  'MONTHLY_RENT',
  'VISIT_FEE',
  'SECURITY_DEPOSIT',
];

function toTransactionPurpose(value: unknown): TransactionPurpose {
  const candidate = String(value ?? '').toUpperCase().replace(/\s+/g, '_');
  return (TRANSACTION_PURPOSES as string[]).includes(candidate)
    ? (candidate as TransactionPurpose)
    : 'MOVE_IN_PACKAGE';
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function randomRef(prefix: string, width: number): string {
  return `${prefix}${Math.floor(Math.random() * Math.pow(10, width))
    .toString()
    .padStart(width, '0')}`;
}

// -------------------------------------------------------------
// ROW → DOMAIN MAPPERS
// -------------------------------------------------------------
function toDomainProperty(row: PropertyRow): Property {
  const images = row.images ?? [];
  const cover = images.find((i) => i.isCover) ?? images[0];

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    category: row.category,
    type: row.type,
    status: row.status,
    furnishing: row.furnishing,
    priceFcfa: row.priceFcfa,
    depositMonths: row.depositMonths,
    advanceMonths: row.advanceMonths,
    agencyFeeMonths: row.agencyFeeMonths,
    keyMoneyFcfa: row.keyMoneyFcfa,
    serviceChargeFcfa: row.serviceChargeFcfa,
    cleaningFeeFcfa: row.cleaningFeeFcfa,
    isNegotiable: row.isNegotiable,
    city: row.city,
    commune: row.commune,
    neighborhood: row.neighborhood,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    surfaceM2: row.surfaceM2,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    floorNumber: row.floorNumber ?? undefined,
    totalFloors: row.totalFloors ?? undefined,
    hasElevator: row.hasElevator,
    hasGenerator: row.hasGenerator,
    hasWaterReserve: row.hasWaterReserve,
    hasSwimmingPool: row.hasSwimmingPool,
    hasSecurity247: row.hasSecurity247,
    hasFiberInternet: row.hasFiberInternet,
    featuredImage: cover?.url,
    coverImage: cover?.url,
    galleryImages: images.map((i) => i.url),
    virtualTourUrl: row.virtualTourUrl ?? undefined,
    images: images.map((i) => ({
      id: i.id,
      url: i.url,
      caption: i.caption ?? undefined,
      isCover: i.isCover,
      displayOrder: i.displayOrder,
    })),
    amenities: (row.amenities ?? []).map(
      (link): Amenity => ({
        id: link.amenity.id,
        code: link.amenity.code,
        name: link.amenity.name,
        category: link.amenity.category as Amenity['category'],
        iconName: link.amenity.iconName,
      })
    ),
    ownerId: row.ownerId,
    ownerName: row.owner?.fullName,
    ownerPhone: row.owner?.phoneNumber,
    agent: row.agent
      ? {
          fullName: row.agent.fullName,
          phoneNumber: row.agent.phoneNumber,
          companyName: row.agent.companyName ?? undefined,
        }
      : undefined,
    landlord: row.owner
      ? {
          id: row.owner.id,
          fullName: row.owner.fullName,
          phoneNumber: row.owner.phoneNumber,
          isKycVerified: row.owner.isKycVerified,
          companyName: row.owner.companyName ?? undefined,
        }
      : undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDomainBooking(row: BookingRow): Booking {
  const cover = row.property?.images?.find((i) => i.isCover) ?? row.property?.images?.[0];

  return {
    id: row.id,
    bookingNumber: row.bookingNumber,
    propertyId: row.propertyId,
    propertyTitle: row.property?.title,
    propertyCommune: row.property?.commune,
    propertyImage: cover?.url,
    tenantId: row.tenantId,
    tenantName: row.tenant?.fullName ?? '',
    tenantPhone: row.tenant?.phoneNumber ?? '',
    checkInDate: row.checkInDate.toISOString().split('T')[0],
    checkOutDate: row.checkOutDate.toISOString().split('T')[0],
    startDate: row.checkInDate.toISOString().split('T')[0],
    endDate: row.checkOutDate.toISOString().split('T')[0],
    numberOfNights: row.numberOfNights,
    nightsOrMonths: row.numberOfNights,
    numberOfGuests: row.numberOfGuests,
    nightlyRateFcfa: row.nightlyRateFcfa,
    cleaningFeeFcfa: row.cleaningFeeFcfa,
    totalAmountFcfa: row.totalAmountFcfa,
    status: row.status,
    specialRequests: row.specialRequests ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

function toDomainVisit(row: VisitRow): VisitAppointment {
  return {
    id: row.id,
    propertyId: row.propertyId,
    propertyTitle: row.property?.title ?? 'Visite Propriété VFC',
    commune: row.property?.commune ?? '',
    tenantId: row.tenantId,
    clientName: row.tenant?.fullName ?? '',
    clientPhone: row.whatsappPhone,
    visitDate: row.visitDate.toISOString().split('T')[0],
    scheduledDate: row.visitDate.toISOString().split('T')[0],
    timeSlot: row.timeSlot,
    scheduledTime: row.timeSlot,
    type: row.type,
    visitType: row.type,
    status: row.status,
    notes: row.notes ?? undefined,
    whatsAppNotifyUrl: `https://wa.me/${row.whatsappPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
      `Confirmation de visite VFC — ${row.property?.title ?? ''} le ${row.visitDate.toISOString().split('T')[0]}`
    )}`,
    createdAt: row.createdAt.toISOString(),
  };
}

function toDomainTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    reference: row.reference,
    amountFcfa: row.amountFcfa,
    feeFcfa: row.feeFcfa,
    netAmountFcfa: row.netAmountFcfa,
    currency: row.currency === 'FCFA' ? 'FCFA' : 'XOF',
    paymentMethod: row.paymentMethod as PaymentMethod,
    paymentProvider: row.gatewayReference ?? row.paymentMethod,
    purpose: row.purpose as TransactionPurpose,
    status: row.status,
    payerPhone: row.payerPhone,
    payerName: row.payerName,
    clientName: row.payerName,
    clientPhone: row.payerPhone,
    propertyTitle: row.property?.title,
    createdAt: row.createdAt.toISOString(),
  };
}

function toDomainLease(row: LeaseRow): LeaseAgreement {
  return {
    id: row.id,
    leaseNumber: row.leaseNumber,
    propertyId: row.propertyId,
    propertyTitle: row.property?.title,
    tenantId: row.tenantId,
    tenantName: row.tenant?.fullName ?? '',
    tenantPhone: row.tenant?.phoneNumber ?? '',
    ownerId: row.ownerId,
    ownerName: row.owner?.fullName ?? '',
    startDate: row.startDate.toISOString().split('T')[0],
    endDate: row.endDate.toISOString().split('T')[0],
    monthlyRentFcfa: row.monthlyRentFcfa,
    depositAmountFcfa: row.depositAmountFcfa,
    advanceAmountFcfa: row.advanceAmountFcfa,
    agencyFeeFcfa: row.agencyFeeFcfa,
    keyMoneyFcfa: row.keyMoneyFcfa,
    totalMoveInFcfa: row.totalMoveInFcfa,
    status: row.status,
    contractPdfUrl: row.contractPdfUrl ?? undefined,
    signedAt: row.signedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function toDomainQuittance(row: QuittanceRow): QuittanceLoyer {
  return {
    id: row.id,
    quittanceNumber: row.quittanceNumber,
    month: row.month,
    periodMonth: row.month,
    year: row.year,
    tenantName: row.tenantName,
    tenantPhone: row.tenantPhone,
    ownerName: row.ownerName,
    landlordName: row.ownerName,
    propertyTitle: row.propertyTitle,
    propertyAddress: row.propertyAddress,
    commune: row.commune,
    rentAmountFcfa: row.rentAmountFcfa,
    baseRentFcfa: row.rentAmountFcfa,
    chargesFcfa: row.chargesFcfa,
    totalPaidFcfa: row.totalPaidFcfa,
    paymentDate: row.paymentDate.toISOString().split('T')[0],
    paymentMethod: row.paymentMethod as PaymentMethod,
    transactionReference: row.transactionReference,
    qrCodeVerificationUrl: row.qrCodeVerificationUrl,
  };
}

// -------------------------------------------------------------
// REPOSITORY
// -------------------------------------------------------------
export interface PropertyFilters {
  category?: string;
  commune?: string;
  city?: string;
  type?: string;
  minPrice?: number | string;
  maxPrice?: number | string;
  furnishing?: string;
  bedrooms?: string | number;
  searchQuery?: string;
}

class PrismaRepository {
  // ---- PROPERTIES (RENTALS ONLY) ----
  public async getProperties(filters?: PropertyFilters): Promise<Property[]> {
    const where: Prisma.PropertyWhereInput = {};

    if (filters?.category && filters.category !== 'ALL') {
      where.category = filters.category as Prisma.PropertyWhereInput['category'];
    }
    if (filters?.type && filters.type !== 'ALL') {
      where.type = filters.type as Prisma.PropertyWhereInput['type'];
    }
    if (filters?.furnishing && filters.furnishing !== 'ALL') {
      where.furnishing = filters.furnishing as Prisma.PropertyWhereInput['furnishing'];
    }
    if (filters?.city && filters.city !== 'ALL') {
      where.city = { equals: filters.city, mode: 'insensitive' };
    }
    if (filters?.commune && filters.commune !== 'ALL') {
      where.commune = { contains: filters.commune, mode: 'insensitive' };
    }
    if (filters?.bedrooms && String(filters.bedrooms) !== 'ALL') {
      where.bedrooms = { gte: Number(filters.bedrooms) };
    }

    const price: Prisma.IntFilter = {};
    if (filters?.minPrice) price.gte = Number(filters.minPrice);
    if (filters?.maxPrice) price.lte = Number(filters.maxPrice);
    if (price.gte !== undefined || price.lte !== undefined) where.priceFcfa = price;

    if (filters?.searchQuery) {
      const q = filters.searchQuery;
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { commune: { contains: q, mode: 'insensitive' } },
        { neighborhood: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    const rows = await prisma.property.findMany({
      where,
      include: propertyInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDomainProperty);
  }

  public async getPropertyById(id: string): Promise<Property | undefined> {
    const row = await prisma.property.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include: propertyInclude,
    });
    return row ? toDomainProperty(row) : undefined;
  }

  public async addProperty(
    data: Partial<Property> & { ownerId?: string }
  ): Promise<Property> {
    if (!data.ownerId) {
      throw new Error("Le propriétaire (ownerId) est requis pour publier une annonce locative");
    }

    const baseSlug = slugify(data.title || 'propriete-locative');
    const gallery = data.images?.length
      ? data.images
      : data.coverImage || data.featuredImage
        ? [{ id: 'cover', url: (data.coverImage || data.featuredImage)!, isCover: true, caption: 'Vue principale' }]
        : [];

    const amenityCodes = (data.amenities ?? []).map((a) => a.code).filter(Boolean);
    const amenityRows = amenityCodes.length
      ? await prisma.amenity.findMany({ where: { code: { in: amenityCodes } } })
      : [];

    const created = await prisma.property.create({
      data: {
        title: data.title || 'Nouvelle Propriété en Location',
        slug: `${baseSlug}-${Math.floor(Math.random() * 10000)}`,
        description: data.description || '',
        category: (data.category as Prisma.PropertyCreateInput['category']) || 'LONG_TERM_RENT',
        type: (data.type as Prisma.PropertyCreateInput['type']) || 'APARTMENT',
        status: 'PENDING_REVIEW',
        furnishing: (data.furnishing as Prisma.PropertyCreateInput['furnishing']) || 'UNFURNISHED',
        priceFcfa: Number(data.priceFcfa) || 500_000,
        depositMonths: Number(data.depositMonths ?? 2),
        advanceMonths: Number(data.advanceMonths ?? 2),
        agencyFeeMonths: Number(data.agencyFeeMonths ?? 1),
        keyMoneyFcfa: Number(data.keyMoneyFcfa) || 0,
        serviceChargeFcfa: Number(data.serviceChargeFcfa) || 0,
        cleaningFeeFcfa: Number(data.cleaningFeeFcfa) || 0,
        isNegotiable: Boolean(data.isNegotiable),
        city: data.city || 'Abidjan',
        commune: data.commune || 'Cocody',
        neighborhood: data.neighborhood || 'Riviera',
        address: data.address || "Abidjan, Côte d'Ivoire",
        latitude: Number(data.latitude) || 5.3485,
        longitude: Number(data.longitude) || -3.9723,
        surfaceM2: Number(data.surfaceM2) || 120,
        bedrooms: Number(data.bedrooms) || 2,
        bathrooms: Number(data.bathrooms) || 2,
        floorNumber: data.floorNumber !== undefined ? Number(data.floorNumber) : null,
        totalFloors: data.totalFloors !== undefined ? Number(data.totalFloors) : null,
        hasElevator: Boolean(data.hasElevator),
        hasGenerator: Boolean(data.hasGenerator),
        hasWaterReserve: Boolean(data.hasWaterReserve),
        hasSwimmingPool: Boolean(data.hasSwimmingPool),
        hasSecurity247: Boolean(data.hasSecurity247 ?? true),
        hasFiberInternet: Boolean(data.hasFiberInternet),
        virtualTourUrl: data.virtualTourUrl || null,
        ownerId: data.ownerId,
        images: {
          create: gallery.map((image, index) => ({
            url: image.url,
            caption: image.caption ?? null,
            isCover: Boolean(image.isCover) || index === 0,
            displayOrder: index,
          })),
        },
        amenities: {
          create: amenityRows.map((amenity) => ({ amenityId: amenity.id })),
        },
      },
      include: propertyInclude,
    });

    return toDomainProperty(created);
  }

  public async updatePropertyStatus(id: string, status: string): Promise<Property | null> {
    const existing = await prisma.property.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true },
    });
    if (!existing) return null;

    const updated = await prisma.property.update({
      where: { id: existing.id },
      data: { status: status as Prisma.PropertyUpdateInput['status'] },
      include: propertyInclude,
    });
    return toDomainProperty(updated);
  }

  // ---- IVORIAN LEGAL MOVE-IN COST CALCULATOR (Loi 2019-576) ----
  public calculateMoveInCost(
    monthlyRent: number,
    advanceMonths = 2,
    depositMonths = 2,
    agencyFeeMonths = 1,
    keyMoney = 0
  ): MoveInCostBreakdown {
    const advanceAmount = monthlyRent * advanceMonths;
    const depositAmount = monthlyRent * depositMonths;
    const agencyFeeAmount = monthlyRent * agencyFeeMonths;
    const stampDuty = Math.round(monthlyRent * 12 * 0.025); // 2,5 % droit de bail DGI
    const totalUpfrontCost = advanceAmount + depositAmount + agencyFeeAmount + keyMoney + stampDuty;

    return {
      monthlyRent,
      monthlyRentFcfa: monthlyRent,
      advanceMonths,
      advanceAmount,
      advanceAmountFcfa: advanceAmount,
      depositMonths,
      depositAmount,
      depositAmountFcfa: depositAmount,
      agencyFeeMonths,
      agencyFeeAmount,
      agencyFeeAmountFcfa: agencyFeeAmount,
      keyMoney,
      keyMoneyFcfa: keyMoney,
      serviceCharges: 0,
      stampDutyAndRegistration: stampDuty,
      leaseDraftingFeeFcfa: stampDuty,
      totalUpfrontCost,
      totalInitialPayoutFcfa: totalUpfrontCost,
      legalNotice:
        "Conforme à la Loi N° 2019-576 du 26 juin 2019 relative au bail à usage d'habitation en Côte d'Ivoire.",
      currency: 'FCFA',
    };
  }

  // ---- VISITS & APPOINTMENTS ----
  public async getVisits(): Promise<VisitAppointment[]> {
    const rows = await prisma.visitAppointment.findMany({
      include: visitInclude,
      orderBy: { visitDate: 'desc' },
    });
    return rows.map(toDomainVisit);
  }

  public async scheduleVisit(data: Partial<VisitAppointment>): Promise<VisitAppointment> {
    const whatsappPhone = data.clientPhone || '+2250700000000';
    const visitDate = new Date(data.visitDate || data.scheduledDate || Date.now());

    const created = await prisma.visitAppointment.create({
      data: {
        propertyId: data.propertyId!,
        tenantId: data.tenantId || data.userId!,
        visitDate,
        timeSlot: data.timeSlot || data.scheduledTime || '10:00 - 11:00',
        type: (data.type || data.visitType || 'IN_PERSON') as Prisma.VisitAppointmentCreateInput['type'],
        status: 'CONFIRMED',
        notes: data.notes || null,
        whatsappPhone,
      },
      include: visitInclude,
    });
    return toDomainVisit(created);
  }

  // ---- BOOKINGS (SHORT-STAY FURNISHED RESIDENCES) ----
  public async getBookings(): Promise<Booking[]> {
    const rows = await prisma.booking.findMany({
      include: bookingInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDomainBooking);
  }

  public async createBooking(data: Partial<Booking>): Promise<Booking> {
    const property = data.propertyId
      ? await prisma.property.findUnique({ where: { id: data.propertyId } })
      : null;

    const nights = Number(data.numberOfNights || data.nightsOrMonths || 1);
    const nightlyRate = property?.priceFcfa ?? Number(data.nightlyRateFcfa || 150_000);
    const cleaningFee = property?.cleaningFeeFcfa ?? Number(data.cleaningFeeFcfa || 0);

    const created = await prisma.booking.create({
      data: {
        bookingNumber: randomRef(`VFC-BK-${new Date().getFullYear()}-`, 4),
        propertyId: data.propertyId!,
        tenantId: data.tenantId!,
        checkInDate: new Date(data.checkInDate || data.startDate || Date.now()),
        checkOutDate: new Date(data.checkOutDate || data.endDate || Date.now()),
        numberOfNights: nights,
        numberOfGuests: Number(data.numberOfGuests) || 1,
        nightlyRateFcfa: nightlyRate,
        cleaningFeeFcfa: cleaningFee,
        totalAmountFcfa: nights * nightlyRate + cleaningFee,
        status: 'CONFIRMED',
        specialRequests: data.specialRequests ?? null,
      },
      include: bookingInclude,
    });
    return toDomainBooking(created);
  }

  // ---- LEASES (LONG-TERM) ----
  public async getLeases(): Promise<LeaseAgreement[]> {
    const rows = await prisma.leaseAgreement.findMany({
      include: { property: true, tenant: true, owner: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDomainLease);
  }

  // ---- TRANSACTIONS & MOBILE MONEY ----
  public async getTransactions(): Promise<Transaction[]> {
    const rows = await prisma.transaction.findMany({
      include: transactionInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDomainTransaction);
  }

  public async processMobileMoneyPayment(payload: {
    userId: string;
    phoneNumber: string;
    provider: string;
    amountFcfa: number;
    purpose: string;
    clientName?: string;
    propertyTitle?: string;
  }): Promise<Transaction> {
    const fee = Math.round(payload.amountFcfa * 0.01); // 1 % frais Wave / Orange
    const created = await prisma.transaction.create({
      data: {
        reference: randomRef('TX-VFC-', 8),
        gatewayReference: payload.provider,
        userId: payload.userId,
        amountFcfa: payload.amountFcfa,
        feeFcfa: fee,
        netAmountFcfa: payload.amountFcfa - fee,
        currency: 'XOF',
        paymentMethod: toPaymentMethod(payload.provider) as Prisma.TransactionCreateInput['paymentMethod'],
        purpose: toTransactionPurpose(payload.purpose) as Prisma.TransactionCreateInput['purpose'],
        status: 'SUCCESSFUL',
        payerPhone: payload.phoneNumber,
        payerName: payload.clientName || 'Client VFC',
      },
      include: transactionInclude,
    });
    return toDomainTransaction(created);
  }

  // ---- QUITTANCES DE LOYER ----
  public async getQuittances(): Promise<QuittanceLoyer[]> {
    const rows = await prisma.quittance.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map(toDomainQuittance);
  }

  public async generateQuittance(payload: Partial<QuittanceLoyer>): Promise<QuittanceLoyer> {
    const now = new Date();
    const rent = Number(payload.rentAmountFcfa) || 500_000;
    const charges = Number(payload.chargesFcfa) || 0;
    const number = randomRef(
      `QUIT-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-`,
      4
    );

    const created = await prisma.quittance.create({
      data: {
        quittanceNumber: number,
        month: payload.month || now.toLocaleDateString('fr-FR', { month: 'long' }),
        year: payload.year || now.getFullYear(),
        tenantName: payload.tenantName || 'Locataire VFC',
        tenantPhone: payload.tenantPhone || '+225 07 00 00 00 00',
        ownerName: payload.ownerName || 'Bailleur VFC',
        propertyTitle: payload.propertyTitle || 'Appartement VFC',
        propertyAddress: payload.propertyAddress || "Abidjan, Côte d'Ivoire",
        commune: payload.commune || 'Cocody',
        rentAmountFcfa: rent,
        chargesFcfa: charges,
        totalPaidFcfa: Number(payload.totalPaidFcfa) || rent + charges,
        paymentDate: new Date(payload.paymentDate || Date.now()),
        paymentMethod: toPaymentMethod(
          payload.paymentMethod
        ) as Prisma.QuittanceCreateInput['paymentMethod'],
        transactionReference: payload.transactionReference || randomRef('TX-VFC-', 8),
        qrCodeVerificationUrl: `https://valleesfleuries.ci/verify/quittance/${number}`,
      },
    });
    return toDomainQuittance(created);
  }

  // ---- REFERENCE DATA (amenities & Ivorian geography) ----
  public async getAmenities(): Promise<Amenity[]> {
    const rows = await prisma.amenity.findMany({ orderBy: { name: 'asc' } });
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      category: row.category as Amenity['category'],
      iconName: row.iconName,
    }));
  }

  public async getGeography() {
    const cities = await prisma.city.findMany({
      orderBy: { name: 'asc' },
      include: {
        communes: {
          orderBy: { name: 'asc' },
          include: { neighborhoods: { orderBy: { name: 'asc' } } },
        },
      },
    });

    return cities.map((city) => ({
      id: city.id,
      code: city.code,
      name: city.name,
      region: city.region,
      description: city.description ?? undefined,
      latitude: city.latitude,
      longitude: city.longitude,
      communes: city.communes.map((commune) => ({
        id: commune.id,
        code: commune.code,
        name: commune.name,
        neighborhoods: commune.neighborhoods.map((n) => n.name),
      })),
    }));
  }
}

export const db = new PrismaRepository();
