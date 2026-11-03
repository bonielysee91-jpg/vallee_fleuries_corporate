import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './src/server/db.ts';
import { neonClient } from './src/server/neon.ts';
import { prisma } from './src/server/prisma.ts';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TTL_MS,
  comparePassword,
  parseCookies,
  sanitizeIvorianPhone,
  signJwtToken,
  signRefreshToken,
  verifyRefreshToken,
} from './src/server/auth.ts';
import {
  AuthedRequest,
  authenticateJWT,
  optionalJWT,
  requireRole,
} from './src/server/authGuard.ts';
import {
  consumeOtp,
  createSession,
  createUser,
  findActiveSession,
  findUserById,
  findUserByIdentifier,
  issueOtp,
  revokeSession,
  toDomainUser,
  writeAuditLog,
} from './src/server/authService.ts';
import type { User as PrismaUser } from '@prisma/client';
import { UserRole } from './src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

const isProduction = process.env.NODE_ENV === 'production';

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

// -------------------------------------------------------------
// 2. UNIFIED AUTHENTICATION ENGINE (EMAIL / PASSWORD OR +225 SMS OTP)
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

    const { accessToken } = await issueTokenPair(req, res, user);
    await writeAuditLog({
      userId: user.id,
      action: 'REGISTER',
      entity: 'USER',
      entityId: user.id,
      ipAddress: sessionMeta(req).ipAddress,
      details: { role: user.role, method: 'PASSWORD' },
    });

    res.status(201).json({
      success: true,
      message: 'Compte créé avec succès',
      user: toDomainUser(user),
      token: accessToken,
    });
  } catch (error: any) {
    console.error('[Register]', error);
    res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    console.error('[Login]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// C. Send SMS OTP to an Ivorian +225 number
app.post('/api/auth/otp/send', async (req, res) => {
  try {
    const { phoneNumber, purpose = 'LOGIN' } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, error: 'Numéro de téléphone requis (+225)' });
    }

    const cleanPhone = sanitizeIvorianPhone(phoneNumber);
    const { code, expiresAt } = await issueOtp(cleanPhone, purpose);

    console.log(`[SMS OTP GATEWAY — ORANGE/MTN/MOOV CI] Code pour ${cleanPhone} : ${code}`);

    res.json({
      success: true,
      message: `Code de sécurité envoyé par SMS au ${cleanPhone}`,
      expiresAt,
      // Returned only outside production so the flow stays testable without an SMS gateway.
      ...(isProduction ? {} : { devOtpCode: code }),
    });
  } catch (error: any) {
    console.error('[OTP Send]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// D. Verify SMS OTP then sign in (creating the account on first use)
app.post('/api/auth/otp/verify', async (req, res) => {
  try {
    const { phoneNumber, code, fullName, role = 'TENANT' } = req.body;
    if (!phoneNumber || !code) {
      return res.status(400).json({ success: false, error: 'Numéro et code SMS requis' });
    }

    const cleanPhone = sanitizeIvorianPhone(phoneNumber);
    const isValid = await consumeOtp(cleanPhone, code);
    if (!isValid) {
      await writeAuditLog({
        action: 'OTP_FAILED',
        entity: 'USER',
        ipAddress: sessionMeta(req).ipAddress,
        details: { phoneNumber: cleanPhone },
      });
      return res.status(400).json({
        success: false,
        error: 'Code de validation incorrect ou expiré',
      });
    }

    let user = await findUserByIdentifier(cleanPhone);
    if (!user) {
      const requestedRole = String(role) as UserRole;
      user = await createUser({
        phoneNumber: cleanPhone,
        fullName: fullName || 'Résident Vallées Fleuries',
        role: requestedRole === 'OWNER' ? 'OWNER' : 'TENANT',
      });
    }

    const { accessToken } = await issueTokenPair(req, res, user);
    await writeAuditLog({
      userId: user.id,
      action: 'LOGIN',
      entity: 'USER',
      entityId: user.id,
      ipAddress: sessionMeta(req).ipAddress,
      details: { method: 'SMS_OTP' },
    });

    res.json({
      success: true,
      message: 'Authentification SMS réussie',
      user: toDomainUser(user),
      token: accessToken,
    });
  } catch (error: any) {
    console.error('[OTP Verify]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// E. Rotate the refresh token (called by the client when a request returns 401)
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
  } catch (error: any) {
    console.error('[Refresh]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// F. Current User — 401 when there is no valid session (never fabricates one)
app.get('/api/auth/me', authenticateJWT, async (req, res) => {
  const { userId } = (req as AuthedRequest).user!;
  const user = await findUserById(userId);
  if (!user || user.isBanned) {
    clearAuthCookies(res);
    return res.status(401).json({ success: false, error: 'Compte introuvable ou suspendu' });
  }
  res.json({ success: true, user: toDomainUser(user), isAuthenticated: true });
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

// -------------------------------------------------------------
// 4. RENTAL PROPERTIES API (RENTALS ONLY)
// -------------------------------------------------------------
app.get(['/api/rentals', '/api/properties'], optionalJWT, async (req, res) => {
  try {
    const { category, commune, city, minPrice, maxPrice, type, furnishing, bedrooms, q } = req.query;
    const properties = await db.getProperties({
      category: category as string,
      commune: commune as string,
      city: city as string,
      type: type as string,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      furnishing: furnishing as string,
      bedrooms: bedrooms as string,
      searchQuery: q as string,
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

app.post('/api/visits', authenticateJWT, async (req, res) => {
  try {
    const user = (req as AuthedRequest).user!;
    const newVisit = await db.scheduleVisit({
      ...req.body,
      tenantId: user.userId,
      clientName: req.body.clientName || user.fullName,
      clientPhone: req.body.clientPhone || user.phoneNumber,
    });
    await writeAuditLog({
      userId: user.userId,
      action: 'VISIT_SCHEDULED',
      entity: 'VISIT',
      entityId: newVisit.id,
      ipAddress: sessionMeta(req).ipAddress,
    });
    res.status(201).json({ success: true, data: newVisit });
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
// 9. MOBILE MONEY PAYMENTS & WEBHOOK ARCHITECTURE
// -------------------------------------------------------------
app.get('/api/transactions', authenticateJWT, requireRole(['OWNER', 'AGENT', 'ADMIN']), async (req, res) => {
  try {
    res.json({ success: true, data: await db.getTransactions() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/payments/initiate', authenticateJWT, async (req, res) => {
  try {
    const user = (req as AuthedRequest).user!;
    const { phoneNumber, provider, amountFcfa, purpose, clientName, propertyTitle } = req.body;

    if (!amountFcfa || Number(amountFcfa) <= 0) {
      return res.status(400).json({ success: false, error: 'Montant de paiement invalide' });
    }

    const tx = await db.processMobileMoneyPayment({
      userId: user.userId,
      phoneNumber: phoneNumber || user.phoneNumber,
      provider: provider || 'WAVE',
      amountFcfa: Number(amountFcfa),
      purpose: purpose || 'MOVE_IN_PACKAGE',
      clientName: clientName || user.fullName,
      propertyTitle,
    });

    await writeAuditLog({
      userId: user.userId,
      action: 'PAYMENT_INITIATED',
      entity: 'TRANSACTION',
      entityId: tx.id,
      ipAddress: sessionMeta(req).ipAddress,
      details: { amountFcfa: tx.amountFcfa, provider: tx.paymentMethod, purpose: tx.purpose },
    });

    res.json({ success: true, data: tx });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Public by necessity: Mobile Money gateways cannot present a user JWT.
// Authenticity must be established by verifying the gateway signature payload.
app.post(['/api/payments/webhook', '/api/webhooks/mobile-money'], (req, res) => {
  console.log('[Webhook Mobile Money Received]:', JSON.stringify(req.body));

  res.status(200).json({
    received: true,
    status: 'ACKNOWLEDGED',
    timestamp: new Date().toISOString(),
    providerGateway: req.body?.provider || 'CINETPAY_WAVE_MOMO',
  });
});

// -------------------------------------------------------------
// 10. CERTIFIED QUITTANCES DE LOYER (LANDLORD / AGENCY ONLY)
// -------------------------------------------------------------
app.get('/api/quittances', authenticateJWT, requireRole(['OWNER', 'AGENT', 'ADMIN']), async (req, res) => {
  try {
    res.json({ success: true, data: await db.getQuittances() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post(
  '/api/quittances/generate',
  authenticateJWT,
  requireRole(['OWNER', 'AGENT', 'ADMIN']),
  async (req, res) => {
    try {
      const user = (req as AuthedRequest).user!;
      const quittance = await db.generateQuittance(req.body);
      await writeAuditLog({
        userId: user.userId,
        action: 'QUITTANCE_GENERATED',
        entity: 'QUITTANCE',
        entityId: quittance.id,
        ipAddress: sessionMeta(req).ipAddress,
        details: { quittanceNumber: quittance.quittanceNumber },
      });
      res.status(201).json({ success: true, data: quittance });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
);

// -------------------------------------------------------------
// 11. TENANT SPACE (FAVORITES & MY RENTALS) — persisted in Neon
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
// 12. SUPER-ADMIN COMMAND CENTER (Role.ADMIN ONLY)
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

/** Listing approval queue — rentals awaiting agency / Super-Admin validation. */
app.get('/api/admin/moderation', authenticateJWT, requireRole(['ADMIN']), async (req, res) => {
  try {
    const listings = await db.getProperties();
    const queue = listings.filter(
      (p) => p.status === 'PENDING_REVIEW' || p.status === 'AVAILABLE'
    );
    res.json({ success: true, data: queue, count: queue.length });
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
      details: { status: req.body.status },
    });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/** Mobile Money ledger with the VFC commission split already applied. */
app.get('/api/admin/transactions', authenticateJWT, requireRole(['ADMIN']), async (req, res) => {
  try {
    const transactions = (await db.getTransactions()).map((t) => {
      const commissionFcfa = Math.round(t.amountFcfa * 0.05);
      return {
        ...t,
        commissionFcfa,
        ownerPayoutFcfa: t.netAmountFcfa - commissionFcfa,
      };
    });
    res.json({ success: true, data: transactions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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

app.get('/api/admin/stats', authenticateJWT, requireRole(['ADMIN']), async (req, res) => {
  try {
    const [users, properties, bookings, activeSessions, transactions] = await Promise.all([
      prisma.user.count(),
      prisma.property.count(),
      prisma.booking.count(),
      prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
      db.getTransactions(),
    ]);

    const volumeFcfa = transactions.reduce((sum, t) => sum + t.amountFcfa, 0);

    res.json({
      success: true,
      data: {
        users,
        properties,
        bookings,
        activeSessions,
        transactionVolumeFcfa: volumeFcfa,
        commissionRevenueFcfa: Math.round(volumeFcfa * 0.05),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------------------------
// 13. VITE MIDDLEWARE & STATIC ASSET SERVER
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
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[VFC Production Engine] running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
