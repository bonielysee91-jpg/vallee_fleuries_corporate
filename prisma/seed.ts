/**
 * Vallées Fleuries Corporate — Neon PostgreSQL Production Seed
 * Idempotent migration script that populates the live Neon cloud database with
 * the full Ivorian rental catalogue: staff accounts, amenities, the national
 * geography reference (57 Ivorian cities → communes → neighbourhoods) and the
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
import crypto from 'node:crypto';
import { UserRole, RentalCategory, PropertyType, PropertyStatus, FurnishingStatus } from '@prisma/client';
import { hashPassword } from '../src/server/auth.ts';
import { prisma } from '../src/server/prisma.ts';

/** Shared Unsplash CDN query so every image is delivered pre-optimised. */
const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&q=80`;

/**
 * Resolve a sample-account password without ever hardcoding a secret in the repo.
 * The value comes from the given env var; otherwise a random password is generated
 * and printed once, so no known credential is stored in source control.
 */
const resolveSeedPassword = (envKey: string): string => {
  const provided = process.env[envKey]?.trim();
  if (provided) return provided;
  const generated = `VFC-${crypto.randomBytes(9).toString('base64url')}!`;
  console.warn(
    `[Seed] ${envKey} non défini — mot de passe aléatoire généré pour cet environnement : ${generated}`
  );
  return generated;
};

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
  // Passwords are sourced from the environment (never hardcoded in the repo).
  const adminSeedPassword = resolveSeedPassword('SEED_ADMIN_PASSWORD');
  const ownerSeedPassword = resolveSeedPassword('SEED_OWNER_PASSWORD');
  const tenantSeedPassword = resolveSeedPassword('SEED_TENANT_PASSWORD');

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@valleesfleuries.ci' },
    // Never clobber a password that was rotated in production.
    update: { fullName: 'BONI ELYSEE' },
    create: {
      email: 'admin@valleesfleuries.ci',
      phoneNumber: '+2250173839518',
      fullName: 'BONI ELYSEE',
      passwordHash: hashPassword(adminSeedPassword),
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
      passwordHash: hashPassword(ownerSeedPassword),
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
      passwordHash: hashPassword(tenantSeedPassword),
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
  // 3. IVORIAN GEOGRAPHY (villes → communes → quartiers)
  // -------------------------------------------------------------
  // Référentiel national : chefs-lieux de région et principales villes de Côte
  // d'Ivoire. Chaque écriture est un upsert par `code`, donc rejouable sans doublon.
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
        { code: 'TREICHVILLE', name: 'Treichville', neighborhoods: ['Zone 3', 'Arras'] },
        { code: 'ADJAME', name: 'Adjamé', neighborhoods: ['Bracodi', 'Liberté'] },
        { code: 'ABOBO', name: 'Abobo', neighborhoods: ['Abobo Baoulé', 'Sagbé'] },
        { code: 'KOUMASSI', name: 'Koumassi', neighborhoods: ['Remblais', 'SICOGI'] },
        { code: 'PORT_BOUET', name: 'Port-Bouët', neighborhoods: ['Vridi', 'Gonzagueville'] },
        { code: 'ATTECOUBE', name: 'Attécoubé', neighborhoods: ['Locodjro', 'Agban'] },
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
        { code: 'BKE_COMMERCE', name: 'Commerce', neighborhoods: ['Grand Marché', 'Centre'] },
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
    {
      code: 'SAN_PEDRO',
      name: 'San-Pédro',
      region: 'Bas-Sassandra',
      description: 'Premier port cacaoyer — pôle industriel et logistique du Sud-Ouest.',
      latitude: 4.7485,
      longitude: -6.6363,
      communes: [
        { code: 'SP_BARDOT', name: 'Bardot', neighborhoods: ['Centre Commercial', 'Bardot Est'] },
        { code: 'SP_BALMER', name: 'Balmer', neighborhoods: ['Balmer Centre', 'Cité Portuaire'] },
        { code: 'SP_SEWEKE', name: 'Séwéké', neighborhoods: ['Séwéké Nord', 'Zone Industrielle'] },
      ],
    },
    {
      code: 'KORHOGO',
      name: 'Korhogo',
      region: 'Savanes',
      description: 'Capitale du Nord — carrefour commercial et culturel sénoufo.',
      latitude: 9.4578,
      longitude: -5.6294,
      communes: [
        { code: 'KOR_SOBA', name: 'Soba', neighborhoods: ['Soba Centre', 'Koko'] },
        { code: 'KOR_PETIT_PARIS', name: 'Petit Paris', neighborhoods: ['Petit Paris', 'Sinistré'] },
        { code: 'KOR_COMMERCE', name: 'Commerce', neighborhoods: ['Grand Marché', 'Centre'] },
      ],
    },
    {
      code: 'DALOA',
      name: 'Daloa',
      region: 'Haut-Sassandra',
      description: 'Cœur de la boucle du cacao — marché régional majeur du Centre-Ouest.',
      latitude: 6.877,
      longitude: -6.4502,
      communes: [
        { code: 'DAL_TAZIBOUO', name: 'Tazibouo', neighborhoods: ['Tazibouo 1', 'Tazibouo 2'] },
        { code: 'DAL_LOBIA', name: 'Lobia', neighborhoods: ['Lobia Gare', 'Lobia Centre'] },
        { code: 'DAL_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Dioulabougou'] },
      ],
    },
    {
      code: 'MAN',
      name: 'Man',
      region: 'Montagnes',
      description: 'Cité des dix-huit montagnes — tourisme et paysages du Tonkpi.',
      latitude: 7.4125,
      longitude: -7.5537,
      communes: [
        { code: 'MAN_LIBREVILLE', name: 'Libreville', neighborhoods: ['Libreville Centre', 'Kennedy'] },
        { code: 'MAN_GBAPLEU', name: 'Grand Gbapleu', neighborhoods: ['Grand Gbapleu Nord', 'Dioulabougou'] },
        { code: 'MAN_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'GAGNOA',
      name: 'Gagnoa',
      region: 'Gôh',
      description: 'Grand marché du cacao — plaque tournante du Centre-Ouest.',
      latitude: 6.1319,
      longitude: -5.9506,
      communes: [
        { code: 'GAG_DIOULABOUGOU', name: 'Dioulabougou', neighborhoods: ['Dioulabougou 1', 'Dioulabougou 2'] },
        { code: 'GAG_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'ABENGOUROU',
      name: 'Abengourou',
      region: 'Indénié-Djuablin',
      description: 'Capitale de l\'Indénié — théâtre du royaume Agni.',
      latitude: 6.7297,
      longitude: -3.4964,
      communes: [
        { code: 'ABE_AMELEKIA', name: 'Amelekia', neighborhoods: ['Amelekia Centre', 'Amelekia Nord'] },
        { code: 'ABE_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'DIVO',
      name: 'Divo',
      region: 'Lôh-Djiboua',
      description: 'Chef-lieu du Lôh-Djiboua, au cœur du pays Dida.',
      latitude: 5.8394,
      longitude: -5.3572,
      communes: [
        { code: 'DIVO_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'GRAND_BASSAM',
      name: 'Grand-Bassam',
      region: 'Sud-Comoé',
      description: 'Ancienne capitale coloniale, patrimoine UNESCO et bord de mer.',
      latitude: 5.1959,
      longitude: -3.738,
      communes: [
        { code: 'GB_FRANCE', name: 'Quartier France', neighborhoods: ['Quartier France', 'Bord de Mer'] },
        { code: 'GB_MOOSSOU', name: 'Moossou', neighborhoods: ['Moossou Centre', 'Mockeyville'] },
        { code: 'GB_VITRE', name: 'Vitré', neighborhoods: ['Vitré 1', 'Vitré 2'] },
      ],
    },
    {
      code: 'BINGERVILLE',
      name: 'Bingerville',
      region: 'Lagunes',
      description: 'Commune résidentielle et verdoyante du district d\'Abidjan.',
      latitude: 5.3556,
      longitude: -3.8853,
      communes: [
        { code: 'BIN_CENTRE', name: 'Centre', neighborhoods: ['Centre', 'Marché'] },
        { code: 'BIN_ADJAME', name: 'Adjamé-Bingerville', neighborhoods: ['Adjamé-Bingerville', 'Anna'] },
      ],
    },
    {
      code: 'DABOU',
      name: 'Dabou',
      region: 'Grands-Ponts',
      description: 'Cité lagunaire des Grands-Ponts, au bord de la lagune Ébrié.',
      latitude: 5.3226,
      longitude: -4.3768,
      communes: [
        { code: 'DAB_LOPOU', name: 'Lopou', neighborhoods: ['Lopou Centre', 'Lopou Sud'] },
        { code: 'DAB_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'AGBOVILLE',
      name: 'Agboville',
      region: 'Agnéby-Tiassa',
      description: 'Chef-lieu de l\'Agnéby-Tiassa, axe agricole Abidjan–Yamoussoukro.',
      latitude: 5.928,
      longitude: -4.213,
      communes: [
        { code: 'AGB_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'ADZOPE',
      name: 'Adzopé',
      region: 'La Mé',
      description: 'Carrefour forestier du Sud-Est, riche en plantations.',
      latitude: 6.107,
      longitude: -3.862,
      communes: [
        { code: 'ADZ_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'ABOISSO',
      name: 'Aboisso',
      region: 'Sud-Comoé',
      description: 'Chef-lieu du Sud-Comoé, proche des lagunes Aby.',
      latitude: 5.4675,
      longitude: -3.2072,
      communes: [
        { code: 'ABS_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'BONDOUKOU',
      name: 'Bondoukou',
      region: 'Gontougo',
      description: 'Cité historique du royaume Abron, carrefour du Nord-Est.',
      latitude: 8.04,
      longitude: -2.8,
      communes: [
        { code: 'BON_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'FERKESSEDOUGOU',
      name: 'Ferkessédougou',
      region: 'Tchologo',
      description: 'Porte du Nord — nœud routier vers le Mali et le Burkina Faso.',
      latitude: 9.5928,
      longitude: -5.1944,
      communes: [
        { code: 'FER_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'SEGUELA',
      name: 'Séguéla',
      region: 'Worodougou',
      description: 'Chef-lieu du Worodougou, cœur historique du pays Mahou.',
      latitude: 7.9611,
      longitude: -6.6731,
      communes: [
        { code: 'SEG_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'ODIENNE',
      name: 'Odienné',
      region: 'Kabadougou',
      description: 'Capitale du Kabadougou, dans le Nord-Ouest.',
      latitude: 9.51,
      longitude: -7.564,
      communes: [
        { code: 'ODI_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'BOUNDIALI',
      name: 'Boundiali',
      region: 'Bagoué',
      description: 'Chef-lieu du Bagoué, pays Senoufo du Nord.',
      latitude: 9.5217,
      longitude: -6.4869,
      communes: [
        { code: 'BOU_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'KATIOLA',
      name: 'Katiola',
      region: 'Hambol',
      description: 'Cité de la poterie, carrefour du centre-nord.',
      latitude: 8.137,
      longitude: -5.101,
      communes: [
        { code: 'KAT_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'BOUAFLE',
      name: 'Bouaflé',
      region: 'Marahoué',
      description: 'Chef-lieu de la Marahoué, grand marché vivrier.',
      latitude: 6.9904,
      longitude: -5.7442,
      communes: [
        { code: 'BFL_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'SOUBRE',
      name: 'Soubré',
      region: 'Nawa',
      description: 'Boucle du cacao du Sud-Ouest, près du barrage de Soubré.',
      latitude: 5.7853,
      longitude: -6.5934,
      communes: [
        { code: 'SOU_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'SASSANDRA',
      name: 'Sassandra',
      region: 'Gbôklé',
      description: 'Port de pêche et station balnéaire de l\'Ouest.',
      latitude: 4.95,
      longitude: -6.0833,
      communes: [
        { code: 'SAS_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'GUIGLO',
      name: 'Guiglo',
      region: 'Cavally',
      description: 'Chef-lieu du Cavally, pays Guéré à l\'ouest.',
      latitude: 6.5436,
      longitude: -7.4936,
      communes: [
        { code: 'GUI_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'DUEKOUE',
      name: 'Duékoué',
      region: 'Guémon',
      description: 'Carrefour de l\'Ouest forestier, pays Guéré et Wobé.',
      latitude: 6.7419,
      longitude: -7.3494,
      communes: [
        { code: 'DUE_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'DANANE',
      name: 'Danané',
      region: 'Tonkpi',
      description: 'Cité frontalière du Nord-Ouest, pays Yacouba.',
      latitude: 7.2594,
      longitude: -8.1547,
      communes: [
        { code: 'DAN_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'TOUMODI',
      name: 'Toumodi',
      region: 'Bélier',
      description: 'Chef-lieu du Bélier, au sud de Yamoussoukro.',
      latitude: 6.5583,
      longitude: -5.0139,
      communes: [
        { code: 'TOM_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'TIASSALE',
      name: 'Tiassalé',
      region: 'Agnéby-Tiassa',
      description: 'Cité du fleuve Bandama, carrefour Abidjan–Centre.',
      latitude: 5.8983,
      longitude: -4.8228,
      communes: [
        { code: 'TIA_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'GRAND_LAHOU',
      name: 'Grand-Lahou',
      region: 'Grands-Ponts',
      description: 'Cité lagunaire au confluent du Bandama et de la lagune.',
      latitude: 5.138,
      longitude: -5.018,
      communes: [
        { code: 'GLA_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'ADIAKE',
      name: 'Adiaké',
      region: 'Sud-Comoé',
      description: 'Cité lagunaire proche de la lagune Aby, Sud-Est.',
      latitude: 5.286,
      longitude: -3.304,
      communes: [
        { code: 'ADI_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'VAVOUA',
      name: 'Vavoua',
      region: 'Haut-Sassandra',
      description: 'Carrefour du Haut-Sassandra entre Daloa et Séguéla.',
      latitude: 7.38,
      longitude: -6.48,
      communes: [
        { code: 'VAV_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'SINFRA',
      name: 'Sinfra',
      region: 'Marahoué',
      description: 'Chef-lieu de la Marahoué forestière, pays Gouro.',
      latitude: 6.6167,
      longitude: -5.9167,
      communes: [
        { code: 'SIN_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'ISSIA',
      name: 'Issia',
      region: 'Haut-Sassandra',
      description: 'Cité cacaoyère du Haut-Sassandra, pays Bété.',
      latitude: 6.4924,
      longitude: -6.5856,
      communes: [
        { code: 'ISS_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'LAKOTA',
      name: 'Lakota',
      region: 'Lôh-Djiboua',
      description: 'Chef-lieu du Lôh-Djiboua, pays Dida.',
      latitude: 5.847,
      longitude: -5.682,
      communes: [
        { code: 'LAK_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'OUME',
      name: 'Oumé',
      region: 'Gôh',
      description: 'Cité du Gôh, carrefour agricole du Centre-Ouest.',
      latitude: 6.383,
      longitude: -5.518,
      communes: [
        { code: 'OUM_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'BOUNA',
      name: 'Bouna',
      region: 'Gontougo',
      description: 'Cité frontalière du Nord-Est, pays Koulango.',
      latitude: 9.2667,
      longitude: -2.9833,
      communes: [
        { code: 'BNO_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'TANDA',
      name: 'Tanda',
      region: 'Gontougo',
      description: 'Carrefour du Nord-Est entre Bondoukou et Bouna.',
      latitude: 7.8,
      longitude: -3.1667,
      communes: [
        { code: 'TAN_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'TOUBA',
      name: 'Touba',
      region: 'Bafing',
      description: 'Chef-lieu du Bafing, pays Mahou du Nord-Ouest.',
      latitude: 8.284,
      longitude: -7.683,
      communes: [
        { code: 'TBU_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'ZUENOULA',
      name: 'Zuénoula',
      region: 'Marahoué',
      description: 'Cité du Marahoué, pays Gouro au centre-ouest.',
      latitude: 7.431,
      longitude: -6.051,
      communes: [
        { code: 'ZUE_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'BONOUA',
      name: 'Bonoua',
      region: 'Sud-Comoé',
      description: 'Cité agricole du Sud-Comoé, pays Abouré.',
      latitude: 5.4,
      longitude: -3.6,
      communes: [
        { code: 'BNU_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'BONGOUANOU',
      name: 'Bongouanou',
      region: 'Moronou',
      description: 'Chef-lieu du Moronou, pays Agni du Sud-Est.',
      latitude: 6.65,
      longitude: -4.2,
      communes: [
        { code: 'BGN_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'ARRAH',
      name: 'Arrah',
      region: 'Moronou',
      description: 'Cité du Moronou, carrefour au sud de Bongouanou.',
      latitude: 6.6667,
      longitude: -3.9667,
      communes: [
        { code: 'ARR_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'DAOUKRO',
      name: 'Daoukro',
      region: 'Iffou',
      description: 'Cité natale de Félix Houphouët-Boigny, pays N\'Gban.',
      latitude: 7.05,
      longitude: -3.9667,
      communes: [
        { code: 'DAK_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'MBAHIAKRO',
      name: 'M\'Bahiakro',
      region: 'Iffou',
      description: 'Cité du pays Baoulé, sur l\'axe Abidjan–Bouaké.',
      latitude: 7.45,
      longitude: -4.3333,
      communes: [
        { code: 'MBA_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'BEOUMI',
      name: 'Béoumi',
      region: 'Gbêkê',
      description: 'Cité du lac de Kossou, pays Baoulé du centre.',
      latitude: 7.6667,
      longitude: -5.5833,
      communes: [
        { code: 'BEO_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'SAKASSOU',
      name: 'Sakassou',
      region: 'Gbêkê',
      description: 'Cité royale Baoulé au nord-est de Bouaké.',
      latitude: 7.45,
      longitude: -5.2833,
      communes: [
        { code: 'SAK_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'TENGRELA',
      name: 'Tengréla',
      region: 'Bagoué',
      description: 'Cité frontalière du Nord, sur la route du Mali.',
      latitude: 10.4833,
      longitude: -6.4,
      communes: [
        { code: 'TEN_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'OUANGOLODOUGOU',
      name: 'Ouangolodougou',
      region: 'Tchologo',
      description: 'Poste frontière du Nord vers le Burkina Faso.',
      latitude: 9.9667,
      longitude: -5.15,
      communes: [
        { code: 'OUA_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'MINIGNAN',
      name: 'Minignan',
      region: 'Kabadougou',
      description: 'Cité du Kabadougou, extrême Nord-Ouest du pays.',
      latitude: 9.997,
      longitude: -7.7,
      communes: [
        { code: 'MIN_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'JACQUEVILLE',
      name: 'Jacqueville',
      region: 'Grands-Ponts',
      description: 'Station balnéaire lagunaire, à l\'ouest d\'Abidjan.',
      latitude: 5.2,
      longitude: -4.4167,
      communes: [
        { code: 'JAC_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'ALEPE',
      name: 'Alépé',
      region: 'La Mé',
      description: 'Cité forestière de La Mé, sur la rive du Comoé.',
      latitude: 5.5,
      longitude: -3.65,
      communes: [
        { code: 'ALE_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'SIKENSI',
      name: 'Sikensi',
      region: 'Agnéby-Tiassa',
      description: 'Carrefour de l\'Agnéby-Tiassa, axe Abidjan–Divo.',
      latitude: 5.6667,
      longitude: -4.5667,
      communes: [
        { code: 'SIK_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'FRESCO',
      name: 'Fresco',
      region: 'Gbôklé',
      description: 'Port de pêche du littoral ouest.',
      latitude: 5.0833,
      longitude: -5.6667,
      communes: [
        { code: 'FRE_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
      ],
    },
    {
      code: 'MEAGUI',
      name: 'Méagui',
      region: 'Nawa',
      description: 'Cité cacaoyère de la Nawa, au sud-ouest.',
      latitude: 5.4167,
      longitude: -6.5667,
      communes: [
        { code: 'MEA_CENTRE', name: 'Centre', neighborhoods: ['Marché Central', 'Centre'] },
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
    // ---------------------------------------------
    // Maisons (Vente & Location) — 5 villes : Abidjan, Yamoussoukro, Bouaké,
    // San-Pédro et Korhogo. 1 bien en Vente + 1 bien en Location par ville.
    // ---------------------------------------------
    {
      slug: 'villa-moderne-vente-angre-cocody',
      title: 'Villa Moderne en Vente — Angré',
      description:
        'Villa individuelle de 5 chambres à Angré 7e Tranche, sur un terrain de 500 m² avec titre foncier. Double séjour, cuisine équipée, dépendance et garage double. Quartier résidentiel calme et proche des commerces.',
      category: RentalCategory.SALE,
      type: PropertyType.VILLA,
      status: PropertyStatus.PUBLISHED,
      furnishing: FurnishingStatus.UNFURNISHED,
      priceFcfa: 165_000_000,
      city: 'Abidjan',
      commune: 'Cocody',
      neighborhood: 'Angré',
      address: 'Angré 7e Tranche, Cocody',
      latitude: 5.4001,
      longitude: -3.9792,
      surfaceM2: 320,
      bedrooms: 5,
      bathrooms: 4,
      totalFloors: 1,
      hasGenerator: true,
      hasWaterReserve: true,
      hasSecurity247: true,
      hasFiberInternet: true,
      images: [
        { url: IMAGES.modernVilla, caption: 'Façade de la villa', isCover: true },
        { url: IMAGES.luxuryInterior, caption: 'Double séjour', isCover: false },
        { url: IMAGES.livingRoom, caption: 'Salle à manger', isCover: false },
      ],
      amenities: ['AC', 'GENERATOR', 'WATER_BOOSTER', 'SECURITY_247', 'WIFI', 'GARAGE'],
    },
    {
      slug: 'villa-avec-piscine-location-riviera-palmeraie',
      title: 'Villa avec Piscine en Location — Riviera Palmeraie',
      description:
        'Villa de 5 chambres avec piscine privée et jardin arboré à Riviera Palmeraie. Studio indépendant pour le personnel, groupe électrogène et gardiennage permanent. Bail résidentiel longue durée.',
      category: RentalCategory.LONG_TERM_RENT,
      type: PropertyType.VILLA,
      status: PropertyStatus.PUBLISHED,
      furnishing: FurnishingStatus.SEMI_FURNISHED,
      priceFcfa: 750_000,
      city: 'Abidjan',
      commune: 'Riviera',
      neighborhood: 'Riviera Palmeraie',
      address: 'Riviera Palmeraie, Cocody',
      latitude: 5.3702,
      longitude: -3.9448,
      surfaceM2: 350,
      bedrooms: 5,
      bathrooms: 4,
      totalFloors: 1,
      hasGenerator: true,
      hasWaterReserve: true,
      hasSwimmingPool: true,
      hasSecurity247: true,
      hasFiberInternet: true,
      serviceChargeFcfa: 60_000,
      images: [
        { url: IMAGES.villaPool, caption: 'Villa et piscine', isCover: true },
        { url: IMAGES.modernVilla, caption: 'Façade principale', isCover: false },
        { url: IMAGES.luxuryInterior, caption: 'Grand séjour', isCover: false },
      ],
      amenities: ['AC', 'GENERATOR', 'WATER_BOOSTER', 'SECURITY_247', 'WIFI', 'SWIMMING_POOL', 'GARAGE'],
    },
    {
      slug: 'villa-familiale-vente-habitat-yamoussoukro',
      title: 'Villa Familiale en Vente — Habitat',
      description:
        'Villa de 4 chambres à vendre au quartier Habitat de Yamoussoukro, à proximité des lacs. Grand jardin clos, garage double et groupe électrogène. Idéale pour résidence principale.',
      category: RentalCategory.SALE,
      type: PropertyType.VILLA,
      status: PropertyStatus.PUBLISHED,
      furnishing: FurnishingStatus.UNFURNISHED,
      priceFcfa: 75_000_000,
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
      images: [
        { url: IMAGES.familyHouse, caption: 'Villa et jardin', isCover: true },
        { url: IMAGES.luxuryInterior, caption: 'Séjour', isCover: false },
        { url: IMAGES.livingRoom, caption: 'Salle à manger', isCover: false },
      ],
      amenities: ['AC', 'GENERATOR', 'WATER_BOOSTER', 'SECURITY_247', 'GARAGE'],
    },
    {
      slug: 'duplex-location-centre-ville-yamoussoukro',
      title: 'Duplex en Location — Centre-Ville',
      description:
        'Duplex de 3 chambres au quartier Millionnaire, en plein centre de Yamoussoukro. Séjour spacieux, balcon et parking privatif. Proche des administrations et des commerces.',
      category: RentalCategory.LONG_TERM_RENT,
      type: PropertyType.DUPLEX,
      status: PropertyStatus.PUBLISHED,
      furnishing: FurnishingStatus.UNFURNISHED,
      priceFcfa: 220_000,
      city: 'Yamoussoukro',
      commune: 'Centre-Ville',
      neighborhood: 'Millionnaire',
      address: 'Quartier Millionnaire, Yamoussoukro',
      latitude: 6.8132,
      longitude: -5.2761,
      surfaceM2: 180,
      bedrooms: 3,
      bathrooms: 2,
      floorNumber: 1,
      totalFloors: 2,
      hasGenerator: true,
      hasWaterReserve: true,
      hasSecurity247: true,
      images: [
        { url: IMAGES.duplexFacade, caption: 'Façade du duplex', isCover: true },
        { url: IMAGES.luxuryInterior, caption: 'Séjour', isCover: false },
        { url: IMAGES.livingRoom, caption: 'Coin repas', isCover: false },
      ],
      amenities: ['AC', 'GENERATOR', 'WATER_BOOSTER', 'SECURITY_247', 'BALCONY', 'GARAGE'],
    },
    {
      slug: 'villa-basse-vente-belleville-bouake',
      title: 'Villa Basse en Vente — Belleville',
      description:
        'Villa basse de 4 chambres à vendre à Belleville, Bouaké. Cour clôturée, garage et réserve d\'eau. Titre foncier disponible, quartier résidentiel recherché.',
      category: RentalCategory.SALE,
      type: PropertyType.VILLA,
      status: PropertyStatus.PUBLISHED,
      furnishing: FurnishingStatus.UNFURNISHED,
      priceFcfa: 55_000_000,
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
        { url: IMAGES.livingRoom, caption: 'Cuisine', isCover: false },
      ],
      amenities: ['AC', 'WATER_BOOSTER', 'SECURITY_247', 'GARAGE'],
    },
    {
      slug: 'villa-familiale-location-air-france-bouake',
      title: 'Villa Familiale en Location — Air France',
      description:
        'Villa de 4 chambres en location au quartier Air France de Bouaké. Séjour double, terrasse couverte et dépendance. Résidence sécurisée avec groupe électrogène.',
      category: RentalCategory.LONG_TERM_RENT,
      type: PropertyType.VILLA,
      status: PropertyStatus.PUBLISHED,
      furnishing: FurnishingStatus.UNFURNISHED,
      priceFcfa: 160_000,
      city: 'Bouaké',
      commune: 'Air France',
      neighborhood: 'Air France 1',
      address: 'Quartier Air France, Bouaké',
      latitude: 7.6906,
      longitude: -5.0303,
      surfaceM2: 240,
      bedrooms: 4,
      bathrooms: 3,
      totalFloors: 1,
      hasGenerator: true,
      hasWaterReserve: true,
      hasSecurity247: true,
      images: [
        { url: IMAGES.modernVilla, caption: 'Façade de la villa', isCover: true },
        { url: IMAGES.luxuryInterior, caption: 'Séjour double', isCover: false },
        { url: IMAGES.familyHouse, caption: 'Terrasse', isCover: false },
      ],
      amenities: ['AC', 'GENERATOR', 'WATER_BOOSTER', 'SECURITY_247', 'GARAGE'],
    },
    {
      slug: 'villa-bord-de-mer-vente-bardot-san-pedro',
      title: 'Villa Bord de Mer en Vente — Bardot',
      description:
        'Villa de 4 chambres à vendre à Bardot, San-Pédro, à quelques minutes de l\'océan. Vaste séjour, cuisine américaine et jardin tropical. Quartier calme et bien desservi.',
      category: RentalCategory.SALE,
      type: PropertyType.VILLA,
      status: PropertyStatus.PUBLISHED,
      furnishing: FurnishingStatus.UNFURNISHED,
      priceFcfa: 68_000_000,
      city: 'San-Pédro',
      commune: 'Bardot',
      neighborhood: 'Centre Commercial',
      address: 'Centre Commercial, Bardot, San-Pédro',
      latitude: 4.7485,
      longitude: -6.6363,
      surfaceM2: 280,
      bedrooms: 4,
      bathrooms: 3,
      totalFloors: 1,
      hasGenerator: true,
      hasWaterReserve: true,
      hasSecurity247: true,
      hasFiberInternet: true,
      images: [
        { url: IMAGES.beachResidence, caption: 'Villa et jardin tropical', isCover: true },
        { url: IMAGES.modernVilla, caption: 'Façade principale', isCover: false },
        { url: IMAGES.luxuryInterior, caption: 'Séjour', isCover: false },
      ],
      amenities: ['AC', 'GENERATOR', 'WATER_BOOSTER', 'SECURITY_247', 'WIFI', 'GARAGE'],
    },
    {
      slug: 'villa-moderne-location-balmer-san-pedro',
      title: 'Villa Moderne en Location — Balmer',
      description:
        'Villa de 4 chambres en location à Balmer, proche de la cité portuaire de San-Pédro. Séjour lumineux, balcon et garage. Idéale pour cadre expatrié ou famille.',
      category: RentalCategory.LONG_TERM_RENT,
      type: PropertyType.VILLA,
      status: PropertyStatus.PUBLISHED,
      furnishing: FurnishingStatus.SEMI_FURNISHED,
      priceFcfa: 210_000,
      city: 'San-Pédro',
      commune: 'Balmer',
      neighborhood: 'Cité Portuaire',
      address: 'Cité Portuaire, Balmer, San-Pédro',
      latitude: 4.7421,
      longitude: -6.629,
      surfaceM2: 250,
      bedrooms: 4,
      bathrooms: 3,
      totalFloors: 1,
      hasGenerator: true,
      hasWaterReserve: true,
      hasSecurity247: true,
      hasFiberInternet: true,
      serviceChargeFcfa: 25_000,
      images: [
        { url: IMAGES.modernVilla, caption: 'Villa moderne', isCover: true },
        { url: IMAGES.luxuryInterior, caption: 'Séjour lumineux', isCover: false },
        { url: IMAGES.livingRoom, caption: 'Coin repas', isCover: false },
      ],
      amenities: ['AC', 'GENERATOR', 'WATER_BOOSTER', 'SECURITY_247', 'WIFI', 'BALCONY', 'GARAGE'],
    },
    {
      slug: 'villa-senoufo-vente-soba-korhogo',
      title: 'Villa Sénoufo en Vente — Soba',
      description:
        'Villa de 4 chambres à vendre au quartier Soba de Korhogo. Construction récente, cour spacieuse et dépendance. Titre foncier disponible, quartier familial.',
      category: RentalCategory.SALE,
      type: PropertyType.VILLA,
      status: PropertyStatus.PUBLISHED,
      furnishing: FurnishingStatus.UNFURNISHED,
      priceFcfa: 42_000_000,
      city: 'Korhogo',
      commune: 'Soba',
      neighborhood: 'Soba Centre',
      address: 'Soba Centre, Korhogo',
      latitude: 9.4578,
      longitude: -5.6294,
      surfaceM2: 230,
      bedrooms: 4,
      bathrooms: 2,
      totalFloors: 1,
      hasWaterReserve: true,
      hasSecurity247: true,
      images: [
        { url: IMAGES.familyHouse, caption: 'Façade de la villa', isCover: true },
        { url: IMAGES.luxuryInterior, caption: 'Séjour', isCover: false },
        { url: IMAGES.livingRoom, caption: 'Chambre', isCover: false },
      ],
      amenities: ['AC', 'WATER_BOOSTER', 'SECURITY_247', 'GARAGE'],
    },
    {
      slug: 'villa-familiale-location-petit-paris-korhogo',
      title: 'Villa Familiale en Location — Petit Paris',
      description:
        'Villa de 3 chambres en location au quartier Petit Paris de Korhogo. Séjour accueillant, terrasse et cour clôturée. Proche du grand marché et des écoles.',
      category: RentalCategory.LONG_TERM_RENT,
      type: PropertyType.VILLA,
      status: PropertyStatus.PUBLISHED,
      furnishing: FurnishingStatus.UNFURNISHED,
      priceFcfa: 130_000,
      city: 'Korhogo',
      commune: 'Petit Paris',
      neighborhood: 'Petit Paris',
      address: 'Quartier Petit Paris, Korhogo',
      latitude: 9.465,
      longitude: -5.635,
      surfaceM2: 210,
      bedrooms: 3,
      bathrooms: 2,
      totalFloors: 1,
      hasWaterReserve: true,
      hasSecurity247: true,
      images: [
        { url: IMAGES.familyHouse, caption: 'Villa familiale', isCover: true },
        { url: IMAGES.luxuryInterior, caption: 'Séjour', isCover: false },
        { url: IMAGES.livingRoom, caption: 'Salle à manger', isCover: false },
      ],
      amenities: ['AC', 'WATER_BOOSTER', 'SECURITY_247', 'BALCONY'],
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
    { key: 'WHATSAPP_CONTACT', value: 'https://wa.me/2250173839518', description: 'Contact WhatsApp direct VFC' },
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
