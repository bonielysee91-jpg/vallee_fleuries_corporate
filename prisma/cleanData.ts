/**
 * Vallées Fleuries Corporate — Passe d'hygiène des données (port Prisma du script de nettoyage).
 *
 * Objet :
 *   1. Supprimer les annonces obsolètes (résidences meublées / baux) retirées de l'offre.
 *   2. Purger les visuels (PropertyImage) dont la légende / l'URL référence encore
 *      l'ancienne offre (« meublé » / « bail ») — nettoyage définitif des images.
 *   3. Normaliser le numéro de contact public unique (réglage système WHATSAPP_CONTACT).
 *
 * Le catalogue public ignore déjà ces biens ; cette passe fait le ménage en base.
 * Réversible : `npm run seed` recrée l'inventaire de démonstration.
 *
 * Commande : npx tsx prisma/cleanData.ts
 */

import 'dotenv/config';
import { prisma } from '../src/server/prisma.ts';

/** Numéro officiel unique de l'agence. */
const OFFICIAL_CONTACT = 'https://wa.me/2250173839518';

async function main() {
  console.log('🔄 Démarrage du nettoyage des données…');

  // 1. Annonces obsolètes : meublés courte durée + libellés « meublé » / « bail ».
  const obsolete = await prisma.property.findMany({
    where: {
      OR: [
        { category: 'SHORT_TERM_FURNISHED' },
        { title: { contains: 'meubl', mode: 'insensitive' } },
        { title: { contains: 'bail', mode: 'insensitive' } },
        { description: { contains: 'meubl', mode: 'insensitive' } },
      ],
    },
    select: { id: true, title: true },
  });

  console.log(`📋 ${obsolete.length} bien(s) obsolète(s) détecté(s).`);
  obsolete.forEach((property) => console.log(`   • ${property.title}`));

  if (obsolete.length > 0) {
    const deleted = await prisma.property.deleteMany({
      where: { id: { in: obsolete.map((property) => property.id) } },
    });
    console.log(`✅ Supprimé : ${deleted.count} ancien(s) bien(s) meublé(s)/bail.`);
  }

  // 2. Visuels obsolètes : légende ou URL référençant encore l'ancienne offre.
  const obsoleteImages = await prisma.propertyImage.deleteMany({
    where: {
      OR: [
        { caption: { contains: 'meubl', mode: 'insensitive' } },
        { caption: { contains: 'bail', mode: 'insensitive' } },
        { url: { contains: 'meubl', mode: 'insensitive' } },
        { url: { contains: 'furnished', mode: 'insensitive' } },
      ],
    },
  });
  console.log(`✅ Visuels nettoyés (« meublé » / « bail ») : ${obsoleteImages.count}`);

  // 3. Contact public unique.
  const setting = await prisma.systemSetting.upsert({
    where: { key: 'WHATSAPP_CONTACT' },
    update: { value: OFFICIAL_CONTACT },
    create: {
      key: 'WHATSAPP_CONTACT',
      value: OFFICIAL_CONTACT,
      description: 'Contact WhatsApp direct VFC',
    },
  });
  console.log(`✅ Contact normalisé : ${setting.value}`);

  console.log('🎉 Nettoyage automatique terminé.');
}

main()
  .catch((error) => {
    console.error('❌ Erreur lors du nettoyage :', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
