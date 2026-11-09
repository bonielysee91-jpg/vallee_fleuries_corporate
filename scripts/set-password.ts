/**
 * Commande d'administration — changement de mot de passe d'un compte.
 *
 *   npm run set-password -- <email-ou-telephone> "<nouveau-mot-de-passe>"
 *
 * Le mot de passe est haché avec le même algorithme que l'application (PBKDF2 /
 * SHA-512) et toutes les sessions du compte sont révoquées : une session volée
 * ne survit jamais au changement de mot de passe.
 */
import 'dotenv/config';
import { prisma } from '../src/server/prisma.ts';
import { findUserByIdentifier } from '../src/server/authService.ts';
import { hashPassword } from '../src/server/auth.ts';

async function main(): Promise<void> {
  const [identifier, password] = process.argv.slice(2);

  if (!identifier || !password) {
    console.error(
      'Usage : npm run set-password -- <email-ou-telephone> "<nouveau-mot-de-passe>"'
    );
    process.exitCode = 1;
    return;
  }

  if (password.length < 10) {
    console.error('Le mot de passe doit contenir au moins 10 caractères.');
    process.exitCode = 1;
    return;
  }

  const user = await findUserByIdentifier(identifier);
  if (!user) {
    console.error(`Aucun compte trouvé pour « ${identifier} ».`);
    process.exitCode = 1;
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(password) },
  });

  const { count } = await prisma.session.deleteMany({ where: { userId: user.id } });

  console.log(
    `Mot de passe mis à jour pour ${user.email} (${user.role}). ${count} session(s) révoquée(s).`
  );
}

main()
  .catch((error: unknown) => {
    console.error('Échec :', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
