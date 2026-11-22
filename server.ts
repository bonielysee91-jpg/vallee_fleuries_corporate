import 'dotenv/config';
import express, { Request, Response } from 'express';
import crypto from 'crypto';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { db } from './src/server/db.ts';
import { neonClient } from './src/server/neon.ts';
import { prisma, describePrismaError, redactSecrets } from './src/server/prisma.ts';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TTL_MS,
  comparePassword,
  hashPassword,
  parseCookies,
  sanitizeIvorianPhone,
  signJwtToken,
  signRefreshToken,
  verifyJwtToken,
  verifyRefreshToken,
} from './src/server/auth.ts';
import {
  AuthedRequest,
  authenticateJWT,
  optionalJWT,
  requireRole,
} from './src/server/authGuard.ts';
import {
  acceptAdminInvitation,
  createAdminInvitation,
  createSession,
  createUser,
  ensureBootstrapAdmin,
  findActiveSession,
  findInvitationByCode,
  findUserById,
  findUserByIdentifier,
  isMailConfigured,
  listAdminInvitations,
  markInvitationAccepted,
  deleteAdminInvitation,
  revokeAdminInvitation,
  revokeSession,
  sendMail,
  toDomainUser,
  writeAuditLog,
} from './src/server/authService.ts';
import { Prisma } from '@prisma/client';
import type { User as PrismaUser, AdminInvitation } from '@prisma/client';
import { UserRole } from './src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Limite relevée : les annonces embarquent leur galerie photo en data URL (base64),
// bien au-delà du plafond par défaut de 100 ko.
app.use(express.json({ limit: '25mb' }));

const isProduction = process.env.NODE_ENV === 'production';

/** URL publique de l'application, pour les liens de retour (invitations, e-mails). */
const APP_URL = process.env.APP_URL || '';

/** Client metadata persisted on the `Session` row for audit + device listing. */
function sessionMeta(req: Request) {
  return {
    userAgent: req.headers['user-agent']?.slice(0, 250),
    ipAddress: (req.ip || req.socket.remoteAddress || '').replace('::ffff:', '') || undefined,
  };
}

/**
 * Issue a short-lived access token (body + httpOnly cookie) and a long-lived
 * refresh token bound to a revocable `Session` row.
 */
async function issueTokenPair(req: Request, res: Response, user: PrismaUser) {
  const payload = {
    userId: user.id,
    email: user.email,
    phoneNumber: user.phoneNumber,
    role: user.role as UserRole,
    fullName: user.fullName,
  };

  const accessToken = signJwtToken(payload, ACCESS_TOKEN_TTL_MS);
  const { sessionId } = await createSession(user.id, REFRESH_TOKEN_TTL_MS, sessionMeta(req));
  const refreshToken = signRefreshToken({ userId: user.id, jti: sessionId });

  const baseCookie = { httpOnly: true, secure: isProduction, sameSite: 'lax' as const, path: '/' };
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, { ...baseCookie, maxAge: ACCESS_TOKEN_TTL_MS });
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, { ...baseCookie, maxAge: REFRESH_TOKEN_TTL_MS });

  return { accessToken, refreshToken };
}

function clearAuthCookies(res: Response) {
  const baseCookie = { httpOnly: true, secure: isProduction, sameSite: 'lax' as const, path: '/' };
  res.clearCookie(ACCESS_TOKEN_COOKIE, baseCookie);
  res.clearCookie(REFRESH_TOKEN_COOKIE, baseCookie);
}

/**
 * Réponse d'erreur unifiée : une indisponibilité de Neon (réseau, WebSocket,
 * démarrage d'instance) devient un 503 explicite — jamais un « identifiants
 * invalides » ni un 500 opaque. Les erreurs métier conservent leur message.
 */
function handleRouteError(res: Response, context: string, error: unknown): Response {
  const info = describePrismaError(error);

  if (info.isConnectionError) {
    console.error(
      `[${context}] Base de données indisponible — ${info.name}` +
        `${info.code ? ` (${info.code})` : ''}: ${redactSecrets(info.message)}`
    );
    return res.status(503).json({
      success: false,
      code: 'DATABASE_UNAVAILABLE',
      error:
        'La base de données est momentanément indisponible. Merci de réessayer dans quelques instants.',
    });
  }

  console.error(`[${context}] ${info.name}: ${redactSecrets(info.message)}`);
  return res.status(500).json({ success: false, error: info.message });
}

// -------------------------------------------------------------
// 1. HEALTH & SYSTEM DIAGNOSTICS (NEON SERVERLESS STATUS)
// -------------------------------------------------------------
app.get('/api/health', async (req, res) => {
  let database = 'UNREACHABLE';
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = 'NEON_POSTGRES_CONNECTED';
  } catch {
    database = 'NEON_POSTGRES_UNREACHABLE';
  }

  res.json({
    status: 'ONLINE',
    system: 'Vallées Fleuries Corporate — Pure Rental Engine v4.0',
    platform: 'Exclusively Property Rentals (Long-Term & Short-Stay Furnished)',
    neon: neonClient.getClientStatus(),
    database,
    region: 'Abidjan / Côte d\'Ivoire (UEMOA)',
    currency: 'XOF / FCFA',
    timestamp: new Date().toISOString(),
  });
});

/**
 * System architecture readout for the public « Schéma Neon » screen.
 * Returns ONLY structural metadata (model / table / field names), never any row.
 * Read from the generated Prisma datamodel, so it always mirrors schema.prisma.
 */
app.get('/api/system/architecture', async (_req, res) => {
  let databaseReachable = false;
  let liveTables: string[] = [];

  try {
    const rows = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    liveTables = rows.map((row) => row.table_name);
    databaseReachable = true;
  } catch {
    databaseReachable = false;
  }

  const datamodel = (Prisma as any)?.dmmf?.datamodel;

  const models = (datamodel?.models ?? []).map((model: any) => ({
    name: model.name,
    fieldCount: model.fields.length,
    relationCount: model.fields.filter((field: any) => field.kind === 'object').length,
    fields: model.fields.map((field: any) => ({
      name: field.name,
      type: field.type,
      isRequired: field.isRequired,
      isList: field.isList,
      isId: field.isId,
      isUnique: field.isUnique,
    })),
  }));

  const enums = (datamodel?.enums ?? []).map((enumDef: any) => ({
    name: enumDef.name,
    values: enumDef.values.map((value: any) => value.name),
  }));

  res.json({
    success: true,
    data: {
      provider: 'Neon PostgreSQL Serverless',
      orm: 'Prisma Client v6 (@prisma/adapter-neon)',
      neon: neonClient.getClientStatus(),
      databaseReachable,
      counts: { models: models.length, enums: enums.length, liveTables: liveTables.length },
      models,
      enums,
      liveTables,
    },
  });
});

// -------------------------------------------------------------
// 2. UNIFIED AUTHENTICATION ENGINE (EMAIL / PASSWORD)
// -------------------------------------------------------------

// A. Registration — always hashes the password before it touches Neon.
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, phoneNumber, fullName, password, role = 'TENANT', companyName } = req.body;

    if (!phoneNumber || !fullName) {
      return res.status(400).json({
        success: false,
        error: 'Numéro de téléphone et nom complet requis',
      });
    }
    if (password && password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Le mot de passe doit contenir au moins 8 caractères',
      });
    }

    const cleanPhone = sanitizeIvorianPhone(phoneNumber);

    const existing =
      (await findUserByIdentifier(cleanPhone)) ||
      (email ? await findUserByIdentifier(email) : null);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Un compte existe déjà avec ce numéro ou cet email',
      });
    }

    // Self-service registration can never mint a privileged account.
    const requestedRole = String(role) as UserRole;
    const safeRole: UserRole =
      requestedRole === 'OWNER' ? 'OWNER' : requestedRole === 'AGENT' ? 'AGENT' : 'TENANT';

    const user = await createUser({
      email,
      phoneNumber: cleanPhone,
      fullName,
      password,
      role: safeRole,
      companyName,
    });

    await writeAuditLog({
      userId: user.id,
      action: 'REGISTER',
      entity: 'USER',
      entityId: user.id,
      ipAddress: sessionMeta(req).ipAddress,
      details: { role: user.role, method: 'PASSWORD' },
    });

    // Aucune vérification par SMS : le compte est actif immédiatement et la
    // session s'ouvre dès la création.
    const { accessToken } = await issueTokenPair(req, res, user);

    res.status(201).json({
      success: true,
      message: 'Compte créé — bienvenue sur Vallées Fleuries Corporate',
      user: toDomainUser(user),
      token: accessToken,
    });
  } catch (error) {
    return handleRouteError(res, 'Register', error);
  }
});

// B. Password Login — verifies the PBKDF2 hash stored in Neon.
app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        error: 'Identifiant et mot de passe requis',
      });
    }

    const user = await findUserByIdentifier(identifier);
    // Identical response for unknown account and wrong password: no user enumeration.
    const invalid = () =>
      res.status(401).json({ success: false, error: 'Identifiants invalides' });

    if (!user || !user.passwordHash) {
      await writeAuditLog({
        action: 'LOGIN_FAILED',
        entity: 'USER',
        ipAddress: sessionMeta(req).ipAddress,
        details: { identifier, reason: user ? 'NO_PASSWORD_SET' : 'UNKNOWN_ACCOUNT' },
      });
      return invalid();
    }

    if (!comparePassword(password, user.passwordHash)) {
      await writeAuditLog({
        userId: user.id,
        action: 'LOGIN_FAILED',
        entity: 'USER',
        entityId: user.id,
        ipAddress: sessionMeta(req).ipAddress,
        details: { reason: 'BAD_PASSWORD' },
      });
      return invalid();
    }

    if (user.isBanned) {
      await writeAuditLog({
        userId: user.id,
        action: 'LOGIN_BLOCKED',
        entity: 'USER',
        entityId: user.id,
        ipAddress: sessionMeta(req).ipAddress,
        details: { reason: 'ACCOUNT_SUSPENDED', banReason: user.banReason },
      });
      return res.status(403).json({
        success: false,
        error: `Compte suspendu. ${user.banReason ?? 'Contactez le support Vallées Fleuries Corporate.'}`,
      });
    }

    const { accessToken } = await issueTokenPair(req, res, user);
    await writeAuditLog({
      userId: user.id,
      action: 'LOGIN',
      entity: 'USER',
      entityId: user.id,
      ipAddress: sessionMeta(req).ipAddress,
      details: { method: 'PASSWORD' },
    });

    res.json({
      success: true,
      message: 'Connexion réussie',
      user: toDomainUser(user),
      token: accessToken,
    });
  } catch (error) {
    return handleRouteError(res, 'Login', error);
  }
});

// C. Rotate the refresh token (called by the client when a request returns 401)
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const refreshToken = parseCookies(req.headers.cookie)[REFRESH_TOKEN_COOKIE];
    if (!refreshToken) {
      return res.status(401).json({ success: false, error: 'Aucun jeton de rafraîchissement' });
    }

    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      clearAuthCookies(res);
      return res.status(401).json({ success: false, error: 'Jeton de rafraîchissement invalide' });
    }

    const session = await findActiveSession(payload.jti);
    if (!session || session.userId !== payload.userId) {
      clearAuthCookies(res);
      return res.status(401).json({ success: false, error: 'Session révoquée' });
    }

    const user = await findUserById(payload.userId);
    if (!user || user.isBanned) {
      await revokeSession(session.id);
      clearAuthCookies(res);
      return res.status(401).json({ success: false, error: 'Compte introuvable ou suspendu' });
    }

    // Single-use rotation: the presented refresh token is burned immediately.
    await revokeSession(session.id);
    const { accessToken } = await issueTokenPair(req, res, user);

    res.json({ success: true, user: toDomainUser(user), token: accessToken });
  } catch (error) {
    return handleRouteError(res, 'Refresh', error);
  }
});

// F. Current User — 401 when there is no valid session (never fabricates one)
app.get('/api/auth/me', authenticateJWT, async (req, res) => {
  try {
    const { userId } = (req as AuthedRequest).user!;
    const user = await findUserById(userId);
    if (!user || user.isBanned) {
      clearAuthCookies(res);
      return res.status(401).json({ success: false, error: 'Compte introuvable ou suspendu' });
    }
    res.json({ success: true, user: toDomainUser(user), isAuthenticated: true });
  } catch (error) {
    return handleRouteError(res, 'Current User', error);
  }
});

// G. Logout — revokes the server-side session and clears both cookies
app.post('/api/auth/logout', async (req, res) => {
  const refreshToken = parseCookies(req.headers.cookie)[REFRESH_TOKEN_COOKIE];
  if (refreshToken) {
    const payload = verifyRefreshToken(refreshToken);
    if (payload) await revokeSession(payload.jti);
  }
  clearAuthCookies(res);
  res.json({ success: true, message: 'Déconnexion réussie' });
});

// -------------------------------------------------------------
// 3. AUTHENTICATED ACCOUNT ENDPOINTS
// -------------------------------------------------------------
app.get('/api/users/me', authenticateJWT, async (req, res) => {
  const user = await findUserById((req as AuthedRequest).user!.userId);
  if (!user) return res.status(404).json({ success: false, error: 'Compte introuvable' });
  res.json({ success: true, data: toDomainUser(user) });
});

/**
 * Changement de mot de passe (compte connecté, tous rôles).
 *
 * Le mot de passe actuel est revérifié contre le hash PBKDF2 stocké en base (aucune
 * comparaison en clair), la politique de longueur est appliquée, puis le nouveau
 * secret est re-haché. La session courante reste valide : la déconnexion n'est pas
 * imposée, conformément à l'architecture existante (jeton d'accès courant + cookie
 * de rafraîchissement révocable conservés). Chaque tentative est journalisée.
 */
app.post('/api/auth/change-password', authenticateJWT, async (req, res) => {
  try {
    const { userId } = (req as AuthedRequest).user!;
    const { currentPassword, newPassword, confirmNewPassword } = req.body ?? {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Mot de passe actuel et nouveau mot de passe requis',
      });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Le nouveau mot de passe doit contenir au moins 8 caractères',
      });
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        error: 'Le nouveau mot de passe doit combiner des lettres et des chiffres',
      });
    }
    if (confirmNewPassword !== undefined && newPassword !== confirmNewPassword) {
      return res.status(400).json({
        success: false,
        error: 'La confirmation ne correspond pas au nouveau mot de passe',
      });
    }

    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ success: false, error: 'Compte introuvable' });

    // Vérification du mot de passe actuel : échoue sans divulguer de détail exploitable.
    if (!user.passwordHash || !comparePassword(currentPassword, user.passwordHash)) {
      await writeAuditLog({
        userId,
        action: 'PASSWORD_CHANGE_FAILED',
        entity: 'USER',
        entityId: userId,
        ipAddress: sessionMeta(req).ipAddress,
        details: { reason: user.passwordHash ? 'BAD_CURRENT_PASSWORD' : 'NO_PASSWORD_SET' },
      });
      return res.status(401).json({ success: false, error: 'Mot de passe actuel incorrect' });
    }

    if (comparePassword(newPassword, user.passwordHash)) {
      return res.status(400).json({
        success: false,
        error: "Le nouveau mot de passe doit être différent de l'actuel",
      });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashPassword(newPassword) },
    });

    await writeAuditLog({
      userId,
      action: 'PASSWORD_CHANGED',
      entity: 'USER',
      entityId: userId,
      ipAddress: sessionMeta(req).ipAddress,
      details: { method: 'PASSWORD' },
    });

    res.json({ success: true, message: 'Mot de passe mis à jour avec succès' });
  } catch (error) {
    return handleRouteError(res, 'Change Password', error);
  }
});

// -------------------------------------------------------------
// 4. RENTAL PROPERTIES API (RENTALS ONLY)
// -------------------------------------------------------------
app.get(['/api/rentals', '/api/properties'], optionalJWT, async (req, res) => {
  try {
    const {
      category, commune, city, minPrice, maxPrice, type, furnishing, bedrooms,
      q, searchQuery, hasGenerator, hasBackupGenerator, hasWaterReserve, hasSecurity247, available,
    } = req.query;
    const properties = await db.getProperties({
      category: category as string,
      commune: commune as string,
      city: city as string,
      type: type as string,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      furnishing: furnishing as string,
      bedrooms: bedrooms as string,
      // Le catalogue public envoie « searchQuery » ; certaines intégrations utilisent « q ».
      searchQuery: (searchQuery ?? q) as string,
      // Équipements (Spécificités Abidjan) : l'interface envoie « hasBackupGenerator »,
      // la colonne Prisma s'appelle « hasGenerator ».
      hasGenerator: (hasGenerator ?? hasBackupGenerator) as string,
      hasWaterReserve: hasWaterReserve as string,
      hasSecurity247: hasSecurity247 as string,
      // Portée publique : « available=true » restreint aux annonces publiées/disponibles.
      available: available as string,
    });
    res.json({ success: true, count: properties.length, data: properties });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get(['/api/rentals/:id', '/api/properties/:id'], optionalJWT, async (req, res) => {
  try {
    const property = await db.getPropertyById(req.params.id);
    if (!property) {
      return res.status(404).json({ success: false, error: 'Propriété locative introuvable' });
    }
    res.json({ success: true, data: property });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Reference data for the catalogue filters: the 4 certified Ivorian hubs with
 * their communes / neighbourhoods, plus the amenity catalogue. Both are served
 * from Neon so the client never hardcodes geography.
 */
app.get('/api/geography', async (_req, res) => {
  try {
    res.json({ success: true, data: await db.getGeography() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/amenities', async (_req, res) => {
  try {
    res.json({ success: true, data: await db.getAmenities() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Publishing a listing is restricted to landlords, agencies and admins.
app.post(
  ['/api/rentals', '/api/properties'],
  authenticateJWT,
  requireRole(['OWNER', 'AGENT', 'ADMIN']),
  async (req, res) => {
    try {
      const property = await db.addProperty({
        ...req.body,
        ownerId: (req as AuthedRequest).user!.userId,
      });
      await writeAuditLog({
        userId: (req as AuthedRequest).user!.userId,
        action: 'PROPERTY_PUBLISH',
        entity: 'PROPERTY',
        entityId: property.id,
        ipAddress: sessionMeta(req).ipAddress,
        details: { title: property.title, priceFcfa: property.priceFcfa },
      });
      res.status(201).json({ success: true, data: property });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
);

app.patch(
  ['/api/rentals/:id/status', '/api/properties/:id/status'],
  authenticateJWT,
  requireRole(['OWNER', 'AGENT', 'ADMIN']),
  async (req, res) => {
    try {
      const updated = await db.updatePropertyStatus(req.params.id, req.body.status);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Propriété non trouvée' });
      }
      res.json({ success: true, data: updated });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
);

// Full edit of a listing: owner/agent may edit their own listing only, admin any.
app.put(
  ['/api/rentals/:id', '/api/properties/:id'],
  authenticateJWT,
  requireRole(['OWNER', 'AGENT', 'ADMIN']),
  async (req, res) => {
    try {
      const user = (req as AuthedRequest).user!;
      const result = await db.updateProperty(req.params.id, req.body, {
        userId: user.userId,
        isAdmin: user.role === 'ADMIN' || user.role === 'SUPER_ADMIN',
      });
      if (result.status === 'not_found') {
        return res.status(404).json({ success: false, error: 'Bien introuvable' });
      }
      if (result.status === 'forbidden') {
        return res.status(403).json({
          success: false,
          error: 'Vous ne pouvez modifier que les biens dont vous êtes propriétaire.',
        });
      }
      await writeAuditLog({
        userId: user.userId,
        action: 'PROPERTY_UPDATE',
        entity: 'PROPERTY',
        entityId: result.property.id,
        ipAddress: sessionMeta(req).ipAddress,
        details: { title: result.property.title, priceFcfa: result.property.priceFcfa },
      });
      res.json({ success: true, data: result.property });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
);

// Deletion of a listing — refused while bookings, leases or visit requests remain attached.
app.delete(
  ['/api/rentals/:id', '/api/properties/:id'],
  authenticateJWT,
  requireRole(['OWNER', 'AGENT', 'ADMIN']),
  async (req, res) => {
    try {
      const user = (req as AuthedRequest).user!;
      const result = await db.deleteProperty(req.params.id, {
        userId: user.userId,
        isAdmin: user.role === 'ADMIN' || user.role === 'SUPER_ADMIN',
      });
      if (result === 'not_found') {
        return res.status(404).json({ success: false, error: 'Bien introuvable' });
      }
      if (result === 'forbidden') {
        return res.status(403).json({
          success: false,
          error: 'Vous ne pouvez supprimer que les biens dont vous êtes propriétaire.',
        });
      }
      if (result === 'has_dependencies') {
        return res.status(409).json({
          success: false,
          error:
            'Ce bien possède des réservations, baux ou demandes de visite : la suppression est impossible tant que ces dossiers existent.',
        });
      }
      await writeAuditLog({
        userId: user.userId,
        action: 'PROPERTY_DELETE',
        entity: 'PROPERTY',
        entityId: req.params.id,
        ipAddress: sessionMeta(req).ipAddress,
        details: { deleted: true },
      });
      res.json({ success: true, data: { id: req.params.id } });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
);

// -------------------------------------------------------------
// 5. IVORIAN MOVE-IN COST CALCULATOR (LEGAL 2-MONTH ADVANCE + 2-MONTH CAUTION)
// -------------------------------------------------------------
app.get('/api/calculator/move-in', (req, res) => {
  const monthlyRent = Number(req.query.monthlyRent || 500000);
  const advanceMonths = Number(req.query.advanceMonths || 2);
  const depositMonths = Number(req.query.depositMonths || 2);
  const agencyFeeMonths = Number(req.query.agencyFeeMonths || 1);
  const keyMoney = Number(req.query.keyMoney || 0);

  const breakdown = db.calculateMoveInCost(
    monthlyRent,
    advanceMonths,
    depositMonths,
    agencyFeeMonths,
    keyMoney
  );
  res.json({ success: true, data: breakdown });
});

// -------------------------------------------------------------
// 5bis. NOTIFICATIONS TEMPS RÉEL (cloche du Command Center)
// -------------------------------------------------------------
// Les administrateurs connectés au back-office ouvrent un canal Socket.io :
// toute nouvelle demande de visite y est poussée instantanément, en complément
// d'un e-mail à la Direction. Aucun doublon de transporteur e-mail : on réutilise
// `sendMail` (voir `src/server/authService.ts`).
const adminSockets = new Set<Socket>();

/** Diffuse un événement à tous les postes d'administration connectés. */
function broadcastToAdmins(type: string, payload: unknown): void {
  for (const socket of adminSockets) {
    socket.emit(type, payload);
  }
}

/** Forme d'une alerte de visite poussée à la cloche du Command Center. */
interface VisitNotificationPayload {
  id: string;
  propertyTitle: string;
  commune: string;
  clientName: string;
  clientPhone: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  message: string;
  receivedAt: string;
}

/**
 * Alerte la Direction sur une nouvelle demande de visite : cloche temps réel pour
 * les admins connectés, puis e-mail (best-effort — jamais bloquant pour le client).
 */
async function notifyAdminsOfNewVisit(visit: any): Promise<void> {
  const payload: VisitNotificationPayload = {
    id: visit.id,
    propertyTitle: visit.propertyTitle ?? 'Bien Vallées Fleuries',
    commune: visit.commune ?? '',
    clientName: visit.clientName ?? visit.userName ?? 'Client',
    clientPhone: visit.clientPhone ?? '',
    scheduledDate: visit.scheduledDate ?? null,
    scheduledTime: visit.scheduledTime ?? null,
    message: '🚨 Nouvelle demande de visite !',
    receivedAt: new Date().toISOString(),
  };

  broadcastToAdmins('visit:new', payload);

  // Persistance : la cloche recharge ces alertes même si aucun admin n'était connecté.
  try {
    await db.createAdminNotification({
      type: 'VISIT',
      propertyId: visit.propertyId ?? null,
      propertyTitle: payload.propertyTitle,
      commune: payload.commune,
      clientName: payload.clientName,
      clientPhone: payload.clientPhone,
      scheduledDate: payload.scheduledDate,
      scheduledTime: payload.scheduledTime,
      message: payload.message,
    });
  } catch (error: any) {
    console.error("[Visits] Persistance de l'alerte admin :", error?.message ?? error);
  }

  if (!isMailConfigured()) return;

  try {
    const configured = (process.env.ADMIN_EMAIL || '').trim();
    const dbAdmins = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
      select: { email: true },
    });
    const recipients = Array.from(
      new Set([configured, ...dbAdmins.map((admin) => admin.email)].filter(Boolean))
    );
    if (recipients.length === 0) return;

    const slot = [payload.scheduledDate, payload.scheduledTime].filter(Boolean).join(' à ');

    await sendMail({
      to: recipients.join(', '),
      subject: '🚨 Nouvelle demande de visite sur le site',
      text:
        `Une nouvelle demande de visite vient d'être enregistrée.\n\n` +
        `· Bien : ${payload.propertyTitle}${payload.commune ? ` (${payload.commune})` : ''}\n` +
        `· Client : ${payload.clientName} — ${payload.clientPhone}\n` +
        (slot ? `· Créneau souhaité : ${slot}\n` : '') +
        `\nRendez-vous sur le Command Center pour traiter cette demande.`,
      html:
        `<div style="font-family:Arial,sans-serif;padding:20px;border:1px solid #eee">` +
        `<h2 style="color:#ff6b00;margin:0 0 12px">Nouvelle demande de visite</h2>` +
        `<p>Un client vient de solliciter une visite.</p>` +
        `<ul>` +
        `<li><strong>Bien :</strong> ${payload.propertyTitle}${payload.commune ? ` (${payload.commune})` : ''}</li>` +
        `<li><strong>Client :</strong> ${payload.clientName} — ${payload.clientPhone}</li>` +
        (slot ? `<li><strong>Créneau souhaité :</strong> ${slot}</li>` : '') +
        `</ul>` +
        `<p>Rendez-vous sur le Command Center pour traiter cette demande.</p>` +
        `</div>`,
    });
  } catch (error: any) {
    console.error('[Visits] Envoi e-mail aux administrateurs :', error?.message ?? error);
  }
}

/**
 * Crée le canal Socket.io greffé sur le serveur HTTP. Seuls les jetons portant un
 * rôle ADMIN / SUPER_ADMIN sont acceptés : la session est lue depuis le cookie
 * httpOnly porté par la poignée de main, ce qui interdit à un client de se
 * déclarer administrateur de lui-même.
 */
function setupRealtimeChannel(server: http.Server): SocketIOServer {
  const io = new SocketIOServer(server, {
    path: '/socket.io',
    // Même origine en production ; `origin: true` reflète l'origine appelante
    // plutôt qu'un joker `*`, incompatible avec l'envoi des cookies de session.
    cors: { origin: true, credentials: true },
  });

  io.use((socket, next) => {
    const token = parseCookies(socket.handshake.headers.cookie)[ACCESS_TOKEN_COOKIE];
    const payload = token ? verifyJwtToken(token) : null;
    const role = payload?.role;

    if (!payload || (role !== 'ADMIN' && role !== 'SUPER_ADMIN')) {
      next(new Error('Authentification administrateur requise'));
      return;
    }

    socket.data.role = role;
    next();
  });

  io.on('connection', (socket) => {
    adminSockets.add(socket);
    socket.emit('ready', { role: socket.data.role });
    socket.on('disconnect', () => adminSockets.delete(socket));
  });

  return io;
}

// -------------------------------------------------------------
// 6. VISITS & WHATSAPP SCHEDULING
// -------------------------------------------------------------
// The visit book is landlord/agency data; only clients may create an appointment.
app.get('/api/visits', authenticateJWT, requireRole(['OWNER', 'AGENT', 'ADMIN']), async (req, res) => {
  try {
    res.json({ success: true, data: await db.getVisits() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/admin/visits/:id', authenticateJWT, requireRole(['ADMIN']), async (req, res) => {
  try {
    const actor = (req as AuthedRequest).user!;
    const deleted = await db.deleteVisit(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Demande de visite introuvable.' });
    }

    await writeAuditLog({
      userId: actor.userId,
      action: 'VISIT_DELETED' as any,
      entity: 'VISIT',
      entityId: deleted.id,
      ipAddress: sessionMeta(req).ipAddress,
      details: {
        clientName: deleted.clientName || deleted.userName,
        propertyTitle: deleted.propertyTitle,
        status: deleted.status,
      },
    });

    broadcastToAdmins('visit:deleted', { id: deleted.id });
    res.json({ success: true, data: { id: deleted.id } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Espace client : un visiteur ne voit que ses propres demandes de visite (statut + message de l'administrateur).
app.get('/api/visits/mine', authenticateJWT, async (req, res) => {
  try {
    const user = (req as AuthedRequest).user!;
    res.json({ success: true, data: await db.getVisitsByTenant(user.userId) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/visits', authenticateJWT, async (req, res) => {
  try {
    const user = (req as AuthedRequest).user!;
    const newVisit = await db.scheduleVisit({
      ...req.body,
      tenantId: user.userId,
      clientName: req.body.clientName || user.fullName,
      clientPhone: req.body.clientPhone || req.body.phone || user.phoneNumber,
    });
    await writeAuditLog({
      userId: user.userId,
      action: 'VISIT_SCHEDULED',
      entity: 'VISIT',
      entityId: newVisit.id,
      ipAddress: sessionMeta(req).ipAddress,
    });

    // Alerte la Direction (cloche temps réel + e-mail) sans jamais retarder la réponse client.
    void notifyAdminsOfNewVisit(newVisit).catch((error: any) =>
      console.error('[Visits] Notification administrateurs :', error?.message ?? error)
    );

    res.status(201).json({ success: true, data: newVisit });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.patch('/api/visits/:id/status', authenticateJWT, requireRole(['OWNER', 'AGENT', 'ADMIN']), async (req, res) => {
  try {
    const user = (req as AuthedRequest).user!;
    const { id } = req.params;
    const { status, notes, adminMessage } = req.body;

    const validStatuses = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Statut de visite invalide.' });
    }

    const updated = await db.updateVisitStatus(id, status, notes, adminMessage);

    await writeAuditLog({
      userId: user.userId,
      action: (status === 'CONFIRMED' ? 'VISIT_CONFIRMED' : `VISIT_STATUS_${status}`) as any,
      entity: 'VISIT',
      entityId: id,
      ipAddress: sessionMeta(req).ipAddress,
    });

    broadcastToAdmins('visit:status_changed', { id, status, updated });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.patch('/api/visits/:id', authenticateJWT, requireRole(['OWNER', 'AGENT', 'ADMIN']), async (req, res) => {
  try {
    const user = (req as AuthedRequest).user!;
    const { id } = req.params;
    const { status, notes, adminMessage } = req.body;

    const validStatuses = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Statut de visite invalide.' });
    }

    const updated = await db.updateVisitStatus(id, status, notes, adminMessage);

    await writeAuditLog({
      userId: user.userId,
      action: (status === 'CONFIRMED' ? 'VISIT_CONFIRMED' : `VISIT_STATUS_${status}`) as any,
      entity: 'VISIT',
      entityId: id,
      ipAddress: sessionMeta(req).ipAddress,
    });

    broadcastToAdmins('visit:status_changed', { id, status, updated });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// -------------------------------------------------------------
// 7. BOOKINGS (FURNISHED RESIDENCES / INSTANT CALENDAR)
// -------------------------------------------------------------
app.get('/api/bookings', authenticateJWT, async (req, res) => {
  try {
    const user = (req as AuthedRequest).user!;
    const bookings = await db.getBookings();
    const visible =
      user.role === 'OWNER' || user.role === 'AGENT' || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'
        ? bookings
        : bookings.filter((b) => b.tenantId === user.userId);
    res.json({ success: true, data: visible });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/bookings', authenticateJWT, async (req, res) => {
  try {
    const user = (req as AuthedRequest).user!;
    const booking = await db.createBooking({
      ...req.body,
      tenantId: user.userId,
      tenantName: req.body.tenantName || user.fullName,
      tenantPhone: req.body.tenantPhone || user.phoneNumber,
    });
    await writeAuditLog({
      userId: user.userId,
      action: 'BOOKING_CREATED',
      entity: 'BOOKING',
      entityId: booking.id,
      ipAddress: sessionMeta(req).ipAddress,
    });
    res.status(201).json({ success: true, data: booking });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// -------------------------------------------------------------
// 8. CERTIFIED LONG-TERM LEASE AGREEMENTS
// -------------------------------------------------------------
app.get('/api/leases', authenticateJWT, async (req, res) => {
  try {
    const user = (req as AuthedRequest).user!;
    const leases = await db.getLeases();
    const visible =
      user.role === 'OWNER' || user.role === 'AGENT' || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'
        ? leases
        : leases.filter((l) => l.tenantId === user.userId);
    res.json({ success: true, data: visible });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// -------------------------------------------------------------
// 9. TENANT SPACE (FAVORITES & MY RENTALS) — persisted in Neon
// -------------------------------------------------------------
app.get('/api/favorites', authenticateJWT, async (req, res) => {
  try {
    const favorites = await prisma.savedFavorite.findMany({
      where: { userId: (req as AuthedRequest).user!.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: favorites.map((f) => f.propertyId) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/favorites/:propertyId', authenticateJWT, async (req, res) => {
  try {
    const userId = (req as AuthedRequest).user!.userId;
    const { propertyId } = req.params;
    await prisma.savedFavorite.upsert({
      where: { userId_propertyId: { userId, propertyId } },
      update: {},
      create: { userId, propertyId },
    });
    res.status(201).json({ success: true, data: { propertyId, saved: true } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.delete('/api/favorites/:propertyId', authenticateJWT, async (req, res) => {
  try {
    const userId = (req as AuthedRequest).user!.userId;
    const { propertyId } = req.params;
    await prisma.savedFavorite
      .delete({ where: { userId_propertyId: { userId, propertyId } } })
      .catch(() => undefined);
    res.json({ success: true, data: { propertyId, saved: false } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/** Active leases + short-stay bookings belonging to the signed-in tenant. */
app.get('/api/my-rentals', authenticateJWT, async (req, res) => {
  try {
    const userId = (req as AuthedRequest).user!.userId;
    const [leases, bookings] = await Promise.all([db.getLeases(), db.getBookings()]);
    const myLeases = leases.filter((l) => l.tenantId === userId);
    const myBookings = bookings.filter((b) => b.tenantId === userId);
    res.json({
      success: true,
      data: { leases: myLeases, bookings: myBookings },
      count: myLeases.length + myBookings.length,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------------------------
// 10. SUPER-ADMIN COMMAND CENTER (Role.ADMIN ONLY)
// -------------------------------------------------------------
app.get('/api/admin/users', authenticateJWT, requireRole(['ADMIN']), async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
    const search = String(req.query.q || '').trim();

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { fullName: { contains: search, mode: 'insensitive' as const } },
            { phoneNumber: { contains: search } },
          ],
        }
      : {};

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    res.json({
      success: true,
      data: users.map(toDomainUser),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Role assignment. Guarded so the last remaining ADMIN cannot be demoted. */
app.patch('/api/admin/users/:id/role', authenticateJWT, requireRole(['ADMIN']), async (req, res) => {
  try {
    const actor = (req as AuthedRequest).user!;
    const { role } = req.body as { role?: UserRole };
    const validRoles: UserRole[] = ['TENANT', 'OWNER', 'AGENT', 'ADMIN', 'SUPER_ADMIN'];

    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ success: false, error: 'Rôle invalide' });
    }

    const target = await findUserById(req.params.id);
    if (!target) return res.status(404).json({ success: false, error: 'Utilisateur introuvable' });

    if (target.role === 'ADMIN' && role !== 'ADMIN') {
      const remainingAdmins = await prisma.user.count({
        where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, id: { not: target.id } },
      });
      if (remainingAdmins === 0) {
        return res.status(409).json({
          success: false,
          error: 'Impossible de rétrograder le dernier administrateur de la plateforme',
        });
      }
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { role },
    });

    await writeAuditLog({
      userId: actor.userId,
      action: 'ROLE_ASSIGNED',
      entity: 'USER',
      entityId: target.id,
      ipAddress: sessionMeta(req).ipAddress,
      details: { from: target.role, to: role },
    });

    res.json({ success: true, data: toDomainUser(updated) });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * Ban / unban. A ban revokes every refresh session immediately so a suspended
 * account cannot keep minting access tokens.
 */
app.patch('/api/admin/users/:id/ban', authenticateJWT, requireRole(['ADMIN']), async (req, res) => {
  try {
    const actor = (req as AuthedRequest).user!;
    const banned = Boolean(req.body?.banned);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;

    const target = await findUserById(req.params.id);
    if (!target) return res.status(404).json({ success: false, error: 'Utilisateur introuvable' });

    if (target.id === actor.userId) {
      return res.status(409).json({ success: false, error: 'Vous ne pouvez pas suspendre votre propre compte' });
    }
    if (target.role === 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'La Direction Générale ne peut pas être suspendue' });
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: {
        isBanned: banned,
        banReason: banned ? reason ?? 'Suspension administrative VFC' : null,
      },
    });

    if (banned) {
      await prisma.session.deleteMany({ where: { userId: target.id } });
    }

    await writeAuditLog({
      userId: actor.userId,
      action: banned ? 'USER_BANNED' : 'USER_UNBANNED',
      entity: 'USER',
      entityId: target.id,
      ipAddress: sessionMeta(req).ipAddress,
      details: { reason: updated.banReason },
    });

    res.json({ success: true, data: toDomainUser(updated) });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// -------------------------------------------------------------
// 12bis. INVITATIONS ADMINISTRATEUR (Command Center)
// -------------------------------------------------------------

/** Sérialise une invitation pour l'API (dates ISO ; le code est visible des admins). */
function serializeInvitation(
  invitation: AdminInvitation & { invitedBy?: { fullName: string; email: string } | null }
) {
  return {
    id: invitation.id,
    email: invitation.email,
    phoneNumber: invitation.phoneNumber,
    fullName: invitation.fullName,
    role: invitation.role as UserRole,
    code: invitation.code,
    status: invitation.status,
    invitedBy: invitation.invitedBy ?? null,
    acceptedAt: invitation.acceptedAt ? invitation.acceptedAt.toISOString() : null,
    expiresAt: invitation.expiresAt.toISOString(),
    createdAt: invitation.createdAt.toISOString(),
  };
}

/** Émet une invitation administrateur et notifie l'invité par e-mail si le SMTP est configuré. */
app.post('/api/admin/invitations', authenticateJWT, requireRole(['ADMIN']), async (req, res) => {
  try {
    const actor = (req as AuthedRequest).user!;
    const { email, phoneNumber, fullName, role } = req.body as {
      email?: string;
      phoneNumber?: string;
      fullName?: string;
      role?: UserRole;
    };

    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Adresse e-mail valide requise' });
    }

    const allowedRoles: UserRole[] = ['TENANT', 'OWNER', 'AGENT', 'ADMIN', 'SUPER_ADMIN'];
    const invitedRole: UserRole = role && allowedRoles.includes(role) ? role : 'ADMIN';

    // Seule la Direction Générale peut nommer un autre SUPER_ADMIN.
    if (invitedRole === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Seule la Direction Générale peut inviter un Super-Administrateur',
      });
    }

    const invitation = await createAdminInvitation({
      email,
      phoneNumber,
      fullName,
      role: invitedRole,
      invitedById: actor.userId,
    });

    let mailSent = false;
    if (isMailConfigured()) {
      try {
        const activationUrl = APP_URL
          ? `${APP_URL.replace(/\/$/, '')}/invitation?code=${encodeURIComponent(invitation.code)}`
          : null;
        const instruction = activationUrl
          ? `Activez votre accès en un clic : ${activationUrl}`
          : 'Rendez-vous sur la plateforme pour activer votre accès.';
        await sendMail({
          to: invitation.email,
          subject: 'Votre invitation au Command Center Vallées Fleuries',
          text:
            `Bonjour ${invitation.fullName ?? ''},\n\n` +
            `Vous êtes invité(e) à rejoindre le Command Center de Vallées Fleuries Corporate ` +
            `avec le rôle ${invitation.role}.\n\n` +
            `Votre code d'invitation : ${invitation.code}\n\n` +
            `${instruction}\n` +
            `Ce code expire le ${invitation.expiresAt.toLocaleString('fr-FR')}.\n\n` +
            `L'équipe Vallées Fleuries Corporate`,
          html:
            `<p>Bonjour ${invitation.fullName ?? ''},</p>` +
            `<p>Vous êtes invité(e) à rejoindre le <strong>Command Center</strong> de ` +
            `Vallées Fleuries Corporate avec le rôle <strong>${invitation.role}</strong>.</p>` +
            `<p>Votre code d'invitation : <strong>${invitation.code}</strong></p>` +
            (activationUrl
              ? `<p><a href="${activationUrl}">Activer votre accès en un clic</a></p>`
              : '<p>Rendez-vous sur la plateforme pour activer votre accès.</p>') +
            `<p>Ce code expire le ${invitation.expiresAt.toLocaleString('fr-FR')}.</p>`,
        });
        mailSent = true;
      } catch (error: any) {
        console.error('[Invitation] Envoi e-mail :', error.message);
      }
    }

    await writeAuditLog({
      userId: actor.userId,
      action: 'INVITATION_SENT',
      entity: 'ADMIN_INVITATION',
      entityId: invitation.id,
      ipAddress: sessionMeta(req).ipAddress,
      details: { email: invitation.email, role: invitation.role, mailSent },
    });

    res.status(201).json({
      success: true,
      message: mailSent
        ? 'Invitation envoyée par e-mail'
        : "Invitation créée. Transmettez le code d'invitation à l'intéressé(e).",
      mailSent,
      data: serializeInvitation(invitation),
    });
  } catch (error: any) {
    console.error('[Invitation] Création :', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/** Historique des invitations (toutes statuts confondus). */
app.get('/api/admin/invitations', authenticateJWT, requireRole(['ADMIN']), async (req, res) => {
  try {
    const invitations = await listAdminInvitations();
    res.json({ success: true, data: invitations.map(serializeInvitation) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Révocation : le code devient immédiatement inutilisable. */
app.post('/api/admin/invitations/:id/revoke', authenticateJWT, requireRole(['ADMIN']), async (req, res) => {
  try {
    const actor = (req as AuthedRequest).user!;
    const updated = await revokeAdminInvitation(req.params.id);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Invitation introuvable' });
    }

    await writeAuditLog({
      userId: actor.userId,
      action: 'INVITATION_REVOKED',
      entity: 'ADMIN_INVITATION',
      entityId: updated.id,
      ipAddress: sessionMeta(req).ipAddress,
      details: { email: updated.email },
    });

    res.json({ success: true, data: serializeInvitation(updated) });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/** Suppression définitive d'une invitation (tous statuts confondus). */
app.delete('/api/admin/invitations/:id', authenticateJWT, requireRole(['ADMIN']), async (req, res) => {
  try {
    const actor = (req as AuthedRequest).user!;
    const deleted = await deleteAdminInvitation(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Invitation introuvable' });
    }

    await writeAuditLog({
      userId: actor.userId,
      action: 'INVITATION_DELETED',
      entity: 'ADMIN_INVITATION',
      entityId: deleted.id,
      ipAddress: sessionMeta(req).ipAddress,
      details: { email: deleted.email, status: deleted.status },
    });

    res.json({ success: true, data: { id: deleted.id } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/** Acceptation : endpoint public — l'invité active son compte avec le code reçu. */
app.post('/api/invitations/accept', async (req, res) => {
  try {
    const { code, fullName, password, phoneNumber } = req.body as {
      code?: string;
      fullName?: string;
      password?: string;
      phoneNumber?: string;
    };

    if (!code) {
      return res.status(400).json({ success: false, error: "Code d'invitation requis" });
    }

    const result = await acceptAdminInvitation({ code, fullName, password, phoneNumber });
    if (!result.ok) {
      await writeAuditLog({
        action: 'INVITATION_ACCEPT_FAILED',
        entity: 'ADMIN_INVITATION',
        ipAddress: sessionMeta(req).ipAddress,
        details: { reason: result.error },
      });
      return res.status(result.status).json({ success: false, error: result.error });
    }

    const { accessToken } = await issueTokenPair(req, res, result.user);
    await writeAuditLog({
      userId: result.user.id,
      action: 'INVITATION_ACCEPTED',
      entity: 'ADMIN_INVITATION',
      entityId: result.invitation.id,
      ipAddress: sessionMeta(req).ipAddress,
      details: { email: result.user.email, role: result.user.role },
    });

    res.status(201).json({
      success: true,
      message: 'Invitation acceptée : bienvenue au Command Center',
      user: toDomainUser(result.user),
      token: accessToken,
    });
  } catch (error) {
    return handleRouteError(res, 'Invitation acceptation', error);
  }
});

/**
 * File de modération — registre complet des annonces (tous statuts confondus).
 * Les onglets « En attente / Publiés / Réservés » de la console filtrent côté client :
 * l'API doit donc renvoyer l'intégralité du parc, et non les seules annonces en attente.
 */
app.get('/api/admin/moderation', authenticateJWT, requireRole(['ADMIN']), async (req, res) => {
  try {
    const listings = await db.getProperties();
    res.json({ success: true, data: listings, count: listings.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/admin/properties/:id/status', authenticateJWT, requireRole(['ADMIN']), async (req, res) => {
  try {
    const updated = await db.updatePropertyStatus(req.params.id, req.body.status);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Propriété non trouvée' });
    }
    await writeAuditLog({
      userId: (req as AuthedRequest).user!.userId,
      action: 'MODERATION_DECISION',
      entity: 'PROPERTY',
      entityId: updated.id,
      ipAddress: sessionMeta(req).ipAddress,
      details: { status: req.body.status, reason: req.body.reason ?? null },
    });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * Registre complet des biens pour le Command Center : renvoie **toutes** les annonces,
 * quel que soit leur statut (gestion, réinitialisation et suppression depuis la console).
 */
app.get('/api/admin/properties', authenticateJWT, requireRole(['ADMIN']), async (_req, res) => {
  try {
    const properties = await db.getProperties();
    res.json({ success: true, count: properties.length, data: properties });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Réinitialisation d'un bien : le renvoie dans la file de modération
 * (`PENDING_REVIEW`). Action **non destructive** — aucune donnée n'est effacée,
 * le bien disparaît simplement du catalogue public jusqu'à revalidation.
 */
app.post(
  '/api/admin/properties/:id/reset',
  authenticateJWT,
  requireRole(['ADMIN']),
  async (req, res) => {
    try {
      const updated = await db.updatePropertyStatus(req.params.id, 'PENDING_REVIEW');
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Propriété non trouvée' });
      }
      await writeAuditLog({
        userId: (req as AuthedRequest).user!.userId,
        action: 'PROPERTY_RESET',
        entity: 'PROPERTY',
        entityId: updated.id,
        ipAddress: sessionMeta(req).ipAddress,
        details: { status: 'PENDING_REVIEW' },
      });
      res.json({ success: true, data: updated });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
);

/** Alertes persistantes du Command Center (cloche admin), les plus récentes d'abord. */
app.get('/api/admin/notifications', authenticateJWT, requireRole(['ADMIN']), async (_req, res) => {
  try {
    const notifications = await db.listAdminNotifications();
    res.json({
      success: true,
      count: notifications.length,
      unread: notifications.filter((item) => !item.read).length,
      data: notifications,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Marque toutes les alertes admin comme lues (badge de la cloche remis à zéro). */
app.post(
  '/api/admin/notifications/read',
  authenticateJWT,
  requireRole(['ADMIN']),
  async (_req, res) => {
    try {
      const updated = await db.markAdminNotificationsRead();
      res.json({ success: true, updated });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

app.get('/api/admin/audit-logs', authenticateJWT, requireRole(['ADMIN']), async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 50));

    const [total, logs] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { fullName: true, email: true, role: true } } },
      }),
    ]);

    res.json({
      success: true,
      data: logs.map((log) => ({
        id: log.id,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        ipAddress: log.ipAddress,
        details: log.details,
        createdAt: log.createdAt.toISOString(),
        actor: log.user
          ? { fullName: log.user.fullName, email: log.user.email, role: log.user.role }
          : null,
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Suppression d'une entrée du journal d'audit. L'effacement est lui-même journalisé
 * (action `AUDIT_LOG_DELETED`) afin de conserver une trace de l'opération de purge.
 */
app.delete(
  '/api/admin/audit-logs/:id',
  authenticateJWT,
  requireRole(['ADMIN']),
  async (req, res) => {
    try {
      const existing = await prisma.auditLog.findUnique({ where: { id: req.params.id } });
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Entrée d\'audit introuvable.' });
      }

      await prisma.auditLog.delete({ where: { id: existing.id } });

      await writeAuditLog({
        userId: (req as AuthedRequest).user!.userId,
        action: 'AUDIT_LOG_DELETED',
        entity: 'AUDIT_LOG',
        entityId: existing.id,
        ipAddress: sessionMeta(req).ipAddress,
        details: { deletedAction: existing.action, deletedEntity: existing.entity },
      });

      res.json({ success: true, data: { id: existing.id } });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
);

/** Purge complète du journal d'audit (opération de maintenance, elle-même journalisée). */
app.delete('/api/admin/audit-logs', authenticateJWT, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { count } = await prisma.auditLog.deleteMany({});

    await writeAuditLog({
      userId: (req as AuthedRequest).user!.userId,
      action: 'AUDIT_LOG_PURGED',
      entity: 'AUDIT_LOG',
      ipAddress: sessionMeta(req).ipAddress,
      details: { deletedCount: count },
    });

    res.json({ success: true, data: { deleted: count } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/api/admin/stats', authenticateJWT, requireRole(['ADMIN']), async (req, res) => {
  try {
    const [users, properties, bookings, activeSessions] = await Promise.all([
      prisma.user.count(),
      prisma.property.count(),
      prisma.booking.count(),
      prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
    ]);

    res.json({
      success: true,
      data: {
        users,
        properties,
        bookings,
        activeSessions,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------------------------
// 11. VISUELS DES BIENS (binaire + cache navigateur)
// -------------------------------------------------------------
/**
 * Sert un visuel de bien en binaire à partir de la data-URL stockée en base.
 * Le JSON de l'API ne transporte donc plus les images : il ne contient qu'une URL
 * courte, que le navigateur met en cache (l'image n'est plus retéléchargée à chaque
 * chargement de page, et un clic sur une miniature est servi instantanément).
 */
app.get('/api/images/:id', async (req: Request, res: Response) => {
  try {
    const stored = await db.getPropertyImageById(req.params.id);
    if (!stored) {
      res.status(404).json({ error: 'Visuel introuvable' });
      return;
    }

    // Les visuels d'exemple hébergés sur un CDN distant sont simplement redirigés.
    if (!stored.startsWith('data:')) {
      res.redirect(302, stored);
      return;
    }

    const commaIndex = stored.indexOf(',');
    if (commaIndex < 0) {
      res.status(415).json({ error: 'Format de visuel non pris en charge' });
      return;
    }

    const meta = stored.slice(5, commaIndex); // après « data: »
    const isBase64 = meta.endsWith(';base64');
    const mimeType = (isBase64 ? meta.slice(0, -';base64'.length) : meta) || 'image/jpeg';
    const buffer = Buffer.from(stored.slice(commaIndex + 1), isBase64 ? 'base64' : 'binary');
    const etag = `"${crypto.createHash('sha1').update(buffer).digest('hex')}"`;

    res.set('Content-Type', mimeType);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('ETag', etag);

    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }

    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error?.message ?? 'Lecture du visuel impossible' });
  }
});

// -------------------------------------------------------------
// 12. VITE MIDDLEWARE & STATIC ASSET SERVER
// -------------------------------------------------------------
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Les fichiers buildés par Vite sont horodatés (hash dans le nom) : on autorise un cache
    // navigateur d'un an (immutable) pour éviter tout re-téléchargement, tout en forçant la
    // revalidation du seul index.html afin que chaque nouveau déploiement soit pris en compte.
    app.use(
      express.static(path.join(__dirname, 'dist'), {
        maxAge: '1y',
        immutable: true,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      })
    );
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  // Provisionne le compte Super-Admin de la Direction à partir de `.env`.
  // Idempotent : sans configuration, l'opération est simplement ignorée, et un
  // échec de base ne doit jamais empêcher le serveur de démarrer.
  await ensureBootstrapAdmin().catch((error) => {
    const info = describePrismaError(error);
    console.error(
      `[Bootstrap Admin] Échec du provisionnement — ${info.name}` +
        `${info.code ? ` (${info.code})` : ''}: ${redactSecrets(info.message)}`
    );
    if (info.isConnectionError) {
      console.error(
        '[Bootstrap Admin] Cause : base Neon injoignable. Le serveur démarre malgré tout ; ' +
          "le provisionnement (idempotent) reprendra au prochain démarrage."
      );
    }
  });

  // Canal temps réel (cloche du Command Center) greffé sur le même serveur HTTP.
  const server = http.createServer(app);
  setupRealtimeChannel(server);

  // Diagnostic explicite si le port est déjà pris : évite le crash `EADDRINUSE` brut
  // (cause n°1 d'un lien qui « ne s'ouvre pas » : une instance précédente tourne encore).
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `\n[VFC] Le port ${PORT} est déjà utilisé : un serveur tourne probablement déjà.\n` +
          `      → Soit vous ouvrez http://localhost:${PORT}\n` +
          `      → Soit vous libérez le port, puis relancez « npm run dev » :\n` +
          `        Get-NetTCPConnection -State Listen -LocalPort ${PORT} | Select-Object OwningProcess\n` +
          `        Stop-Process -Id <PID> -Force\n`
      );
      process.exit(1);
    }
    throw error;
  });

  server.listen(PORT, '0.0.0.0', () => {
    // On journalise `localhost` : `0.0.0.0` est une adresse d'écoute, non navigable.
    console.log(`[VFC Production Engine] running on http://localhost:${PORT}`);
  });
}

startServer();
