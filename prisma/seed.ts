/**
 * Vallées Fleuries Corporate — Neon PostgreSQL Production Seed
 * Idempotent migration script that populates the live Neon cloud database with
 * the full Ivorian rental catalogue: staff accounts, amenities, the four
 * certified geography hubs (Abidjan, Yamoussoukro, Bouaké, Assinie) and the
 * rental-only property inventory illustrated with external HTTPS image URLs.
 *
 * Safe to re-run: every write is an upsert keyed on a unique column, and child
 * rows (images / amenities) are reconciled per property.
 *
 * Commands to execute:
 *   npx prisma db push
 *   npx prisma generate
 *   npx prisma db seed        (or: npx tsx prisma/seed.ts)
 */

import 'dotenv/config';
import { PrismaClient, UserRole, RentalCategory, PropertyType, PropertyStatus, FurnishingStatus } from '@prisma/client';
import { hashPassword } from '../src/server/auth.ts';

const prisma = new PrismaClient();

/** Shared Unsplash CDN query so every image is delivered pre-optimised. */
const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&q=80`;

/** Validated external images — modern apartments, villas & furnished residences. */
const IMAGES = {
  modernVilla: img('photo-1600596542815-ffad4c1539a9'),
  villaPool: img('photo-1512917774080-9991f1c4c750'),
  luxuryInterior: img('photo-1600585154340-be6161a56a0c'),
  familyHouse: img('photo-1580587771525-78b9dba3b914'),
  duplexFacade: img('photo-1613490493576-7fde63acd811'),
  penthouseView: img('photo-1600607687939-ce8a6c25118c'),
  livingRoom: img('photo-1600566753086-00f18fb6b3ea'),
  furnishedApartment: img('photo-1560448204-e02f11c3d0e2'),
  cozyStudio: img('photo-1522708323590-d24dbb6b0267'),
  beachResidence: img('photo-1571003123894-1f0594d2b5d9'),
} as const;

export async function seedDatabase() {
  console.log('--- [VFC NEON SEED] Starting Database Synchronization ---');

  // -------------------------------------------------------------
  // 1. STAFF & SAMPLE ACCOUNTS
  // -------------------------------------------------------------
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@valleesfleuries.ci' },
    // Never clobber a password that was rotated in production.
    update: {},
    create: {
      email: 'admin@valleesfleuries.ci',
      phoneNumber: '+2250709887766',
      fullName: 'M. Jean-Philippe Brou',
      passwordHash: hashPassword('VFC_Admin_2026!'),
      role: UserRole.ADMIN,
      companyName: 'Vallées Fleuries Corporate Headquarters',
      isKycVerified: true,
    },
  });

  const owner = await prisma.user.upsert({
    where: { email: 'bailleur@valleesfleuries.ci' },
    update: {},
    create: {
      email: 'bailleur@valleesfleuries.ci',
      phoneNumber: '+2250707204745',
      fullName: 'Dr. Armand Kouassi',
      passwordHash: hashPassword('VFC_Bailleur_2026!'),
      role: UserRole.OWNER,
      companyName: 'Kouassi Patrimoine Immobilier',
      isKycVerified: true,
    },
  });

  const tenant = await prisma.user.upsert({
    where: { email: 'client@valleesfleuries.ci' },
    update: {},
    create: {
      email: 'client@valleesfleuries.ci',
      phoneNumber: '+2250708091011',
      fullName: 'Mme Sarah Koffi',
      passwordHash: hashPassword('VFC_Client_2026!'),
      role: UserRole.TENANT,
      isKycVerified: true,
    },
  });

  console.log(`[Seed] 3 accounts ready — admin: ${superAdmin.email}, bailleur: ${owner.email}, client: ${tenant.email}`);

  // -------------------------------------------------------------
  // 2. RENTAL AMENITIES
  // -------------------------------------------------------------
  const amenities = [
    { code: 'AC', name: 'Climatisation', category: 'COMFORT', iconName: 'Wind' },
    { code: 'GENERATOR', name: 'Groupe Électrogène', category: 'SECURITY', iconName: 'Zap' },
    { code: 'WATER_BOOSTER', name: "Surpresseur d'eau", category: 'COMFORT', iconName: 'Droplet' },
    { code: 'SECURITY_247', name: 'Sécurité 24/7', category: 'SECURITY', iconName: 'ShieldCheck' },
    { code: 'WIFI', name: 'Wi-Fi', category: 'CONNECTIVITY', iconName: 'Wifi' },
    { code: 'SWIMMING_POOL', name: 'Piscine', category: 'LUXURY', iconName: 'Waves' },
    { code: 'BALCONY', name: 'Balcon', category: 'COMFORT', iconName: 'Building2' },
    { code: 'GARAGE', name: 'Garage', category: 'COMFORT', iconName: 'Car' },
  ];
  const amenityIds = new Map<string, string>();
  for (const amenity of amenities) {
    const row = await prisma.amenity.upsert({
      where: { code: amenity.code },
      update: { name: amenity.name, category: amenity.category, iconName: amenity.iconName },
      create: amenity,
    });
    amenityIds.set(row.code, row.id);
  }
  console.log(`[Seed] ${amenities.length} amenities registered.`);

  // -------------------------------------------------------------
  // 3. CERTIFIED IVORIAN GEOGRAPHY (4 hubs → communes → neighbourhoods)
  // -------------------------------------------------------------
  const geography = [
    {
      code: 'ABIDJAN',
      name: 'Abidjan',
      region: 'Lagunes',
      description: 'Capitale économique — pôle locatif Premium de Côte d\'Ivoire.',
      latitude: 5.3599517,
      longitude: -4.0082563,
      communes: [
        { code: 'COCODY', name: 'Cocody', neighborhoods: ['Riviera Golf', 'Deux-Plateaux Vallons', 'Angré', 'Ambassades'] },
        { code: 'MARCORY', name: 'Marcory', neighborhoods: ['Zone 4', 'Biétry', 'Résidentiel'] },
        { code: 'YOPOUGON', name: 'Yopougon', neighborhoods: ['Niangon', 'Sicogi', 'Toit Rouge'] },
        { code: 'PLATEAU', name: 'Plateau', neighborhoods: ['Centre Administratif', 'Cité Administrative'] },
        { code: 'RIVIERA', name: 'Riviera', neighborhoods: ['Riviera Palmeraie', 'Riviera Bonoumin', 'Riviera 3'] },
      ],
    },
    {
      code: 'YAMOUSSOUKRO',
      name: 'Yamoussoukro',
      region: 'Lacs',
      description: 'Capitale politique — résidences administratives et villas familiales.',
      latitude: 6.8276228,
      longitude: -5.2893433,
      communes: [
        { code: 'YAM_HABITAT', name: 'Habitat', neighborhoods: ['Habitat Extension', 'Kokrenou'] },
        { code: 'YAM_CENTRE', name: 'Centre-Ville', neighborhoods: ['Millionnaire', 'Dioulakro'] },
      ],
    },
    {
      code: 'BOUAKE',
      name: 'Bouaké',
      region: 'Vallée du Bandama',
      description: 'Deuxième ville du pays — carrefour commercial du centre.',
      latitude: 7.6906055,
      longitude: -5.0302911,
      communes: [
        { code: 'BKE_AIR_FRANCE', name: 'Air France', neighborhoods: ['Air France 1', 'Air France 2'] },
        { code: 'BKE_BELLEVILLE', name: 'Belleville', neighborhoods: ['Belleville Nord', 'Koko'] },
      ],
    },
    {
      code: 'ASSINIE',
      name: 'Assinie',
      region: 'Comoé',
      description: 'Station balnéaire — résidences meublées pieds dans l\'eau.',
      latitude: 5.1333333,
      longitude: -3.4666667,
      communes: [
        { code: 'ASSINIE_MAFIA', name: 'Assinie-Mafia', neighborhoods: ['Pointe Mafia', 'Canal'] },
        { code: 'ASSINIE_FRANCE', name: 'Assinie-France', neighborhoods: ['Bord de Lagune', 'Plage Est'] },
      ],
    },
  ];

  for (const city of geography) {
    const cityRow = await prisma.city.upsert({
      where: { code: city.code },
      update: {
        name: city.name,
        region: city.region,
        description: city.description,
        latitude: city.latitude,
        longitude: city.longitude,
      },
      create: {
        code: city.code,
        name: city.name,
        region: city.region,
        description: city.description,
        latitude: city.latitude,
        longitude: city.longitude,
      },
    });

    for (const commune of city.communes) {
      const communeRow = await prisma.commune.upsert({
        where: { code: commune.code },
        update: { name: commune.name, cityId: cityRow.id },
        create: { code: commune.code, name: commune.name, cityId: cityRow.id },
      });

      for (const neighborhood of commune.neighborhoods) {
        await prisma.neighborhood.upsert({
          where: { communeId_name: { communeId: communeRow.id, name: neighborhood } },
          update: {},
          create: { communeId: communeRow.id, name: neighborhood },
        });
      }
    }
  }
  console.log(`[Seed] ${geography.length} cities populated with communes & neighbourhoods.`);

  // -------------------------------------------------------------
  // 4. RENTAL PROPERTY INVENTORY (rentals only — long-term & short-stay)
  // -------------------------------------------------------------
  type SeedProperty = {
    slug: string;
    title: string;
    description: string;
    category: RentalCategory;
    type: PropertyType;
    status: PropertyStatus;
    furnishing: FurnishingStatus;
    priceFcfa: number;
    city: string;
    commune: string;
    neighborhood: string;
    address: string;
    latitude: number;
    longitude: number;
    surfaceM2: number;
    bedrooms: number;
    bathrooms: number;
    floorNumber?: number;
    totalFloors?: number;
    hasElevator?: boolean;
    hasGenerator?: boolean;
    hasWaterReserve?: boolean;
    hasSwimmingPool?: boolean;
    hasSecurity247?: boolean;
    hasFiberInternet?: boolean;
    serviceChargeFcfa?: number;
    images: { url: string; caption: string; isCover: boolean }[];
    amenities: string[];
  };

  const properties: SeedProperty[] = [
    {
      slug: 'duplex-prestige-deux-plateaux-vallons-cocody',
      title: 'Duplex de Prestige — Deux-Plateaux Vallons',
      description:
        'Duplex haut standing de 4 chambres avec double séjour, cuisine américaine équipée et terrasse panoramique sur les Vallons. Résidence sécurisée avec groupe électrogène et surpresseur d\'eau.',
      category: RentalCategory.LONG_TERM_RENT,
      type: PropertyType.DUPLEX,
      status: PropertyStatus.PUBLISHED,
      furnishing: FurnishingStatus.SEMI_FURNISHED,
      priceFcfa: 350_000,
      city: 'Abidjan',
      commune: 'Cocody',
      neighborhood: 'Deux-Plateaux Vallons',
      address: 'Rue des Jardins, Deux-Plateaux Vallons, Cocody',
      latitude: 5.3942547,
      longitude: -3.9960471,
      surfaceM2: 220,
      bedrooms: 4,
      bathrooms: 3,
      floorNumber: 2,
      totalFloors: 3,
      hasElevator: true,
      hasGenerator: true,
      hasWaterReserve: true,
      hasSecurity247: true,
      hasFiberInternet: true,
      serviceChargeFcfa: 45_000,
      images: [
        { url: IMAGES.duplexFacade, caption: 'Façade du duplex', isCover: true },
        { url: IMAGES.luxuryInterior, caption: 'Double séjour lumineux', isCover: false },
        { url: IMAGES.livingRoom, caption: 'Salle à manger', isCover: false },
      ],
      amenities: ['AC', 'GENERATOR', 'WATER_BOOSTER', 'SECURITY_247', 'WIFI', 'BALCONY', 'GARAGE'],
    },
    {
      slug: 'appartement-standing-zone-4-marcory',
      title: 'Appartement de Standing — Zone 4',
      description:
        'Appartement de 3 chambres entièrement climatisé dans une résidence récente de Zone 4, à deux pas du Boulevard de Marseille. Balcon spacieux et parking couvert.',
      category: RentalCategory.LONG_TERM_RENT,
      type: PropertyType.APARTMENT,
      status: PropertyStatus.PUBLISHED,
      furnishing: FurnishingStatus.UNFURNISHED,
      priceFcfa: 280_000,
      city: 'Abidjan',
      commune: 'Marcory',
      neighborhood: 'Zone 4',
      address: 'Boulevard de Marseille, Zone 4, Marcory',
      latitude: 5.2931,
      longitude: -3.9967,
      surfaceM2: 120,
      bedrooms: 3,
      bathrooms: 2,
      floorNumber: 4,
      totalFloors: 6,
      hasElevator: true,
      hasGenerator: true,
      hasWaterReserve: true,
      hasSecurity247: true,
      hasFiberInternet: true,
      serviceChargeFcfa: 30_000,
      images: [
        { url: IMAGES.furnishedApartment, caption: 'Séjour principal', isCover: true },
        { url: IMAGES.luxuryInterior, caption: 'Suite parentale', isCover: false },
        { url: IMAGES.livingRoom, caption: 'Coin repas', isCover: false },
      ],
      amenities: ['AC', 'GENERATOR', 'WATER_BOOSTER', 'SECURITY_247', 'WIFI', 'BALCONY', 'GARAGE'],
    },
    {
      slug: 'villa-moderne-piscine-riviera-golf',
      title: 'Villa Moderne avec Piscine — Riviera Golf',
      description:
        'Villa individuelle de 5 chambres avec piscine privée, jardin arboré et studio indépendant pour le personnel. Quartier diplomatique calme et sécurisé.',
      category: RentalCategory.LONG_TERM_RENT,
      type: PropertyType.VILLA,
      status: PropertyStatus.PUBLISHED,
      furnishing: FurnishingStatus.FULLY_FURNISHED,
      priceFcfa: 1_200_000,
      city: 'Abidjan',
      commune: 'Riviera',
      neighborhood: 'Riviera Golf',
      address: 'Rue Mgr René Kouassi, Riviera Golf',
      latitude: 5.3567,
      longitude: -3.9508,
      surfaceM2: 400,
      bedrooms: 5,
      bathrooms: 4,
      totalFloors: 1,
      hasGenerator: true,
      hasWaterReserve: true,
      hasSwimmingPool: true,
      hasSecurity247: true,
      hasFiberInternet: true,
      serviceChargeFcfa: 75_000,
      images: [
        { url: IMAGES.villaPool, caption: 'Villa et piscine', isCover: true },
        { url: IMAGES.modernVilla, caption: 'Façade principale', isCover: false },
        { url: IMAGES.luxuryInterior, caption: 'Grand séjour', isCover: false },
      ],
      amenities: ['AC', 'GENERATOR', 'WATER_BOOSTER', 'SECURITY_247', 'WIFI', 'SWIMMING_POOL', 'GARAGE'],
    },
    {
      slug: 'studio-corporate-meuble-plateau',
      title: 'Studio Corporate Meublé — Plateau',
      description:
        'Studio entièrement meublé et équipé au cœur du quartier d\'affaires du Plateau. Idéal pour cadres en mission, facturation à la nuitée avec ménage inclus.',
      category: RentalCategory.SHORT_TERM_FURNISHED,
      type: PropertyType.STUDIO,
      status: PropertyStatus.PUBLISHED,
      furnishing: FurnishingStatus.FULLY_FURNISHED,
      priceFcfa: 35_000,
      city: 'Abidjan',
      commune: 'Plateau',
      neighborhood: 'Centre Administratif',
      address: 'Avenue Delafosse, Plateau',
      latitude: 5.3236,
      longitude: -4.0211,
      surfaceM2: 42,
      bedrooms: 1,
      bathrooms: 1,
      floorNumber: 8,
      totalFloors: 12,
      hasElevator: true,
      hasGenerator: true,
      hasWaterReserve: true,
      hasSecurity247: true,
      hasFiberInternet: true,
      serviceChargeFcfa: 0,
      images: [
        { url: IMAGES.cozyStudio, caption: 'Espace nuit', isCover: true },
        { url: IMAGES.furnishedApartment, caption: 'Coin bureau', isCover: false },
        { url: IMAGES.penthouseView, caption: 'Vue sur la ville', isCover: false },
      ],
      amenities: ['AC', 'GENERATOR', 'WATER_BOOSTER', 'SECURITY_247', 'WIFI', 'BALCONY'],
    },
    {
      slug: 'appartement-familial-niangon-yopougon',
      title: 'Appartement Familial — Niangon',
      description:
        'Appartement de 3 chambres à Niangon, proche des écoles et du marché. Résidence dotée d\'un surpresseur d\'eau et d\'un gardiennage permanent.',
      category: RentalCategory.LONG_TERM_RENT,
      type: PropertyType.APARTMENT,
      status: PropertyStatus.PUBLISHED,
      furnishing: FurnishingStatus.UNFURNISHED,
      priceFcfa: 150_000,
      city: 'Abidjan',
      commune: 'Yopougon',
      neighborhood: 'Niangon',
      address: 'Niangon Sud, Yopougon',
      latitude: 5.3364,
      longitude: -4.0847,
      surfaceM2: 100,
      bedrooms: 3,
      bathrooms: 2,
      floorNumber: 1,
      totalFloors: 4,
      hasWaterReserve: true,
      hasSecurity247: true,
      images: [
        { url: IMAGES.familyHouse, caption: 'Immeuble', isCover: true },
        { url: IMAGES.furnishedApartment, caption: 'Séjour', isCover: false },
        { url: IMAGES.livingRoom, caption: 'Cuisine', isCover: false },
      ],
      amenities: ['AC', 'WATER_BOOSTER', 'SECURITY_247', 'BALCONY'],
    },
    {
      slug: 'villa-du-lac-habitat-yamoussoukro',
      title: 'Villa du Lac — Habitat',
      description:
        'Villa de 4 chambres à Yamoussoukro, à proximité immédiate des lacs aux caïmans. Grand jardin, garage double et groupe électrogène automatique.',
      category: RentalCategory.LONG_TERM_RENT,
      type: PropertyType.VILLA,
      status: PropertyStatus.PUBLISHED,
      furnishing: FurnishingStatus.SEMI_FURNISHED,
      priceFcfa: 250_000,
      city: 'Yamoussoukro',
      commune: 'Habitat',
      neighborhood: 'Habitat Extension',
      address: 'Habitat Extension, Yamoussoukro',
      latitude: 6.8036,
      longitude: -5.2742,
      surfaceM2: 300,
      bedrooms: 4,
      bathrooms: 3,
      totalFloors: 1,
      hasGenerator: true,
      hasWaterReserve: true,
      hasSecurity247: true,
      hasFiberInternet: true,
      images: [
        { url: IMAGES.modernVilla, caption: 'Villa et jardin', isCover: true },
        { url: IMAGES.luxuryInterior, caption: 'Séjour', isCover: false },
        { url: IMAGES.livingRoom, caption: 'Salle à manger', isCover: false },
      ],
      amenities: ['AC', 'GENERATOR', 'WATER_BOOSTER', 'SECURITY_247', 'WIFI', 'GARAGE'],
    },
    {
      slug: 'residence-meublee-air-france-bouake',
      title: 'Résidence Meublée — Air France',
      description:
        'Appartement meublé de 2 chambres à Bouaké Air France, loué à la nuitée ou à la semaine pour les missions professionnelles. Wi-Fi fibre et climatisation inclus.',
      category: RentalCategory.SHORT_TERM_FURNISHED,
      type: PropertyType.APARTMENT,
      status: PropertyStatus.PUBLISHED,
      furnishing: FurnishingStatus.FULLY_FURNISHED,
      priceFcfa: 25_000,
      city: 'Bouaké',
      commune: 'Air France',
      neighborhood: 'Air France 1',
      address: 'Quartier Air France, Bouaké',
      latitude: 7.6906,
      longitude: -5.0303,
      surfaceM2: 80,
      bedrooms: 2,
      bathrooms: 1,
      floorNumber: 1,
      totalFloors: 3,
      hasGenerator: true,
      hasWaterReserve: true,
      hasSecurity247: true,
      hasFiberInternet: true,
      images: [
        { url: IMAGES.furnishedApartment, caption: 'Séjour meublé', isCover: true },
        { url: IMAGES.cozyStudio, caption: 'Chambre principale', isCover: false },
        { url: IMAGES.livingRoom, caption: 'Coin repas', isCover: false },
      ],
      amenities: ['AC', 'GENERATOR', 'WATER_BOOSTER', 'SECURITY_247', 'WIFI'],
    },
    {
      slug: 'villa-basse-belleville-bouake',
      title: 'Villa Basse — Belleville',
      description:
        'Villa basse de 4 chambres au quartier Belleville, idéale pour famille. Cour clôturée, garage et réserve d\'eau SODECI.',
      category: RentalCategory.LONG_TERM_RENT,
      type: PropertyType.VILLA,
      status: PropertyStatus.PUBLISHED,
      furnishing: FurnishingStatus.UNFURNISHED,
      priceFcfa: 180_000,
      city: 'Bouaké',
      commune: 'Belleville',
      neighborhood: 'Belleville Nord',
      address: 'Belleville Nord, Bouaké',
      latitude: 7.6811,
      longitude: -5.0251,
      surfaceM2: 260,
      bedrooms: 4,
      bathrooms: 2,
      totalFloors: 1,
      hasWaterReserve: true,
      hasSecurity247: true,
      images: [
        { url: IMAGES.familyHouse, caption: 'Villa basse', isCover: true },
        { url: IMAGES.luxuryInterior, caption: 'Séjour', isCover: false },
        { url: IMAGES.furnishedApartment, caption: 'Chambre', isCover: false },
      ],
      amenities: ['AC', 'WATER_BOOSTER', 'SECURITY_247', 'GARAGE', 'BALCONY'],
    },
    {
      slug: 'villa-pieds-dans-leau-assinie-mafia',
      title: 'Villa Pieds dans l\'Eau — Assinie-Mafia',
      description:
        'Villa balnéaire de 4 chambres entre lagune et océan à Assinie-Mafia. Piscine à débordement, ponton privé et service de ménage pour les séjours courts.',
      category: RentalCategory.SHORT_TERM_FURNISHED,
      type: PropertyType.VILLA,
      status: PropertyStatus.PUBLISHED,
      furnishing: FurnishingStatus.FULLY_FURNISHED,
      priceFcfa: 40_000,
      city: 'Assinie',
      commune: 'Assinie-Mafia',
      neighborhood: 'Pointe Mafia',
      address: 'Pointe Mafia, Assinie-Mafia',
      latitude: 5.1333,
      longitude: -3.4667,
      surfaceM2: 250,
      bedrooms: 4,
      bathrooms: 3,
      totalFloors: 1,
      hasGenerator: true,
      hasWaterReserve: true,
      hasSwimmingPool: true,
      hasSecurity247: true,
      hasFiberInternet: true,
      images: [
        { url: IMAGES.beachResidence, caption: 'Vue lagune', isCover: true },
        { url: IMAGES.villaPool, caption: 'Piscine à débordement', isCover: false },
        { url: IMAGES.luxuryInterior, caption: 'Séjour ouvert', isCover: false },
      ],
      amenities: ['AC', 'GENERATOR', 'WATER_BOOSTER', 'SECURITY_247', 'WIFI', 'SWIMMING_POOL', 'GARAGE'],
    },
    {
      slug: 'bungalow-balneaire-assinie-france',
      title: 'Bungalow Balnéaire — Assinie-France',
      description:
        'Bungalow meublé de 2 chambres en bord de lagune à Assinie-France. Terrasse en bois, accès plage direct et location à la nuitée.',
      category: RentalCategory.SHORT_TERM_FURNISHED,
      type: PropertyType.VILLA,
      status: PropertyStatus.PUBLISHED,
      furnishing: FurnishingStatus.FULLY_FURNISHED,
      priceFcfa: 30_000,
      city: 'Assinie',
      commune: 'Assinie-France',
      neighborhood: 'Bord de Lagune',
      address: 'Bord de Lagune, Assinie-France',
      latitude: 5.1215,
      longitude: -3.4432,
      surfaceM2: 110,
      bedrooms: 2,
      bathrooms: 2,
      totalFloors: 1,
      hasWaterReserve: true,
      hasSecurity247: true,
      hasFiberInternet: true,
      images: [
        { url: IMAGES.beachResidence, caption: 'Terrasse lagune', isCover: true },
        { url: IMAGES.cozyStudio, caption: 'Chambre', isCover: false },
        { url: IMAGES.livingRoom, caption: 'Espace de vie', isCover: false },
      ],
      amenities: ['AC', 'WATER_BOOSTER', 'SECURITY_247', 'WIFI', 'BALCONY'],
    },
  ];

  for (const property of properties) {
    const {
      images,
      amenities: amenityCodes,
      serviceChargeFcfa = 0,
      ...core
    } = property;

    const row = await prisma.property.upsert({
      where: { slug: property.slug },
      update: {
        ...core,
        serviceChargeFcfa,
        ownerId: owner.id,
        agentId: superAdmin.id,
      },
      create: {
        ...core,
        serviceChargeFcfa,
        ownerId: owner.id,
        agentId: superAdmin.id,
      },
    });

    // Reconcile child rows so re-running the seed never duplicates galleries.
    await prisma.propertyImage.deleteMany({ where: { propertyId: row.id } });
    await prisma.propertyImage.createMany({
      data: images.map((image, index) => ({
        propertyId: row.id,
        url: image.url,
        caption: image.caption,
        isCover: image.isCover,
        displayOrder: index,
      })),
    });

    await prisma.propertyAmenity.deleteMany({ where: { propertyId: row.id } });
    await prisma.propertyAmenity.createMany({
      data: amenityCodes.map((code) => ({
        propertyId: row.id,
        amenityId: amenityIds.get(code)!,
      })),
      skipDuplicates: true,
    });
  }
  console.log(`[Seed] ${properties.length} rental properties published with external image galleries.`);

  // -------------------------------------------------------------
  // 5. SYSTEM SETTINGS (Ivorian legal & financial parameters)
  // -------------------------------------------------------------
  const systemSettings = [
    { key: 'DEFAULT_CURRENCY', value: 'FCFA', description: 'Franc CFA UEMOA (XOF)' },
    { key: 'LEGAL_ADVANCE_MONTHS', value: '2', description: 'Plafond légal avance de loyer (Loi CI 2019-576)' },
    { key: 'LEGAL_DEPOSIT_MONTHS', value: '2', description: 'Plafond légal caution de garantie (Loi CI 2019-576)' },
    { key: 'AGENCY_FEE_MONTHS', value: '1', description: 'Honoraires agence standard' },
    { key: 'WHATSAPP_CONTACT', value: 'https://wa.me/2250707204745', description: 'Contact WhatsApp direct VFC' },
    { key: 'WAVE_WEBHOOK_URL', value: 'https://valleesfleuries.ci/api/payments/webhook', description: 'Webhook Mobile Money Wave' },
    { key: 'ORANGE_MONEY_WEBHOOK_URL', value: 'https://valleesfleuries.ci/api/payments/webhook', description: 'Webhook Orange Money CI' },
  ];
  for (const setting of systemSettings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value, description: setting.description },
      create: setting,
    });
  }
  console.log(`[Seed] ${systemSettings.length} Ivorian legal parameters configured.`);

  console.log('--- [VFC NEON SEED] Database Synchronization Complete ---');
}

// Execute when invoked directly
if (process.argv[1]?.includes('seed.ts')) {
  seedDatabase()
    .catch((err) => {
      console.error('Seed execution failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
