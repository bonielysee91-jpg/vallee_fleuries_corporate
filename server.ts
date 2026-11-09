import 'dotenv/config';
import express, { Request, Response } from 'express';
import crypto from 'crypto';
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
  acceptAdminInvitation,
  consumeOtp,
  createAdminInvitation,
  createSession,
  createUser,
  ensureBootstrapAdmin,
  findActiveSession,
  findInvitationByCode,
  findUserById,
  findUserByIdentifier,
  isMailConfigured,
  isSmsConfigured,
  issueOtp,
  listAdminInvitations,
  markInvitationAccepted,
  revokeAdminInvitation,
  revokeSession,
  sendMail,
  sendSms,
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

// The raw body must survive JSON parsing: the Mobile Money webhook authenticity
// is proven by an HMAC signature computed over the exact bytes the gateway sent.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: Buffer }).rawBody = buf;
    },
  })
);

const isProduction = process.env.NODE_ENV === 'production';

/** Shared secret configured on the Mobile Money gateway (CinetPay / Wave / Orange). */
const MOBILE_MONEY_WEBHOOK_SECRET = process.env.MOBILE_MONEY_WEBHOOK_SECRET || '';

/** Identifiants de la passerelle d'agrégation (CinetPay / FedaPay). */
const CINETPAY_API_KEY = process.env.CINETPAY_API_KEY || '';
const CINETPAY_SITE_ID = process.env.CINETPAY_SITE_ID || '';
const CINETPAY_CHECK_URL =
  process.env.CINETPAY_CHECK_URL || 'https://api-checkout.cinetpay.com/v2/payment/check';

/** Passerelle Wave Business (checkout hébergé) — Côte d'Ivoire. */
const WAVE_API_KEY = process.env.WAVE_API_KEY || '';
const WAVE_CHECKOUT_URL =
  process.env.WAVE_CHECKOUT_URL || 'https://api.wave.com/v1/checkout/sessions';
/** Secret de signature du webhook Wave (`whsec_…`) : HMAC-SHA256 sur `<timestamp>.<corps brut>`. */
const WAVE_WEBHOOK_SECRET = process.env.WAVE_WEBHOOK_SECRET || '';
/** URL publique de l'application, pour les redirections de retour de la passerelle. */
const APP_URL = process.env.APP_URL || '';

/** Orange Money Web Payment (Côte d'Ivoire) — checkout hébergé. */
const ORANGE_MONEY_CLIENT_ID = process.env.ORANGE_MONEY_CLIENT_ID || '';
const ORANGE_MONEY_CLIENT_SECRET = process.env.ORANGE_MONEY_CLIENT_SECRET || '';
/** Clé marchand Web Payment (distincte du consumer key/secret) générée sur Orange Developer. */
const ORANGE_MONEY_MERCHANT_KEY = process.env.ORANGE_MONEY_MERCHANT_KEY || '';
const ORANGE_MONEY_WEBPAY_URL =
  process.env.ORANGE_MONEY_WEBPAY_URL || 'https://api.orange.com/orange-money-webpay/ci/v1/webpayment';
/** Devise acceptée par Orange WebPay. En CI : « XOF » (certains comptes hérités exigent « OUV »). */
const ORANGE_MONEY_CURRENCY = process.env.ORANGE_MONEY_CURRENCY || 'XOF';
/**
 * Base de l'API de statut Orange : le `notif_token` reçu (jeton de paiement) est ajouté
 * en suffixe de chemin. L'URL exacte variant selon les comptes, elle reste configurable.
 */
const ORANGE_MONEY_STATUS_URL =
  process.env.ORANGE_MONEY_STATUS_URL || 'https://api.orange.com/orange-money-webpay/ci/v1/webpayment';
const ORANGE_MONEY_TOKEN_URL = 'https://api.orange.com/oauth/v3/token';

/**
 * Double vérification anti-falsification : la notification de l'opérateur n'est jamais
 * crue sur parole, on demande à la passerelle si l'argent est RÉELLEMENT encaissé.
 *
 * - `ACCEPTED`   : encaissement confirmé par la passerelle.
 * - `REJECTED`   : la passerelle infirme (solde insuffisant, code secret erroné, annulation).
 * - `UNVERIFIED` : aucune clé configurée → on retombe sur la signature HMAC du webhook.
 *
 * Deux passerelles sont interrogées selon ce que porte la notification :
 * - **Orange Money** : sa notification n'est pas signée ; le `notif_token` (jeton de paiement)
 *   est rejoué auprès de l'API de statut d'Orange pour obtenir le verdict officiel.
 * - **CinetPay** : vérification historique par identifiant de transaction.
 *
 * Une erreur réseau est propagée : mieux vaut ne rien écrire et laisser l'opérateur
 * réémettre sa notification que de figer une transaction sur un verdict incertain.
 */
async function verifyWithGateway(context: {
  reference: string;
  payToken?: string;
}): Promise<'ACCEPTED' | 'REJECTED' | 'UNVERIFIED'> {
  // 1. Orange Money : le verdict fait foi via l'API de statut (notification non signée).
  if (context.payToken && ORANGE_MONEY_CLIENT_ID && ORANGE_MONEY_CLIENT_SECRET) {
    const token = await getOrangeMoneyAccessToken();
    const response = await fetch(
      `${ORANGE_MONEY_STATUS_URL}/${encodeURIComponent(context.payToken)}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
    );

    if (!response.ok) {
      throw new Error(`Vérification Orange indisponible (HTTP ${response.status})`);
    }

    const json = (await response.json().catch(() => null)) as any;
    const status = String(json?.status ?? '').toUpperCase();
    if (status === 'SUCCESS') return 'ACCEPTED';
    if (['FAILED', 'EXPIRED', 'CANCELLED', 'CANCELED', 'REJECTED'].includes(status)) {
      return 'REJECTED';
    }
    // INITIATED / PENDING : paiement non abouti → on n'authentifie pas la notification.
    return 'UNVERIFIED';
  }

  // 2. CinetPay : vérification par identifiant de transaction.
  if (!CINETPAY_API_KEY || !CINETPAY_SITE_ID) return 'UNVERIFIED';

  const response = await fetch(CINETPAY_CHECK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apikey: CINETPAY_API_KEY,
      site_id: CINETPAY_SITE_ID,
      transaction_id: context.reference,
    }),
  });

  if (!response.ok) {
    throw new Error(`Vérification passerelle indisponible (HTTP ${response.status})`);
  }

  const json = (await response.json().catch(() => null)) as any;
  const gatewayStatus = String(json?.data?.status ?? '').toUpperCase();
  return gatewayStatus === 'ACCEPTED' ? 'ACCEPTED' : 'REJECTED';
}

/**
 * Vérifie la signature du callback passerelle. Deux schémas sont acceptés :
 *
 * 1. **Générique** — HMAC-SHA256 du corps brut, porté par `x-signature`,
 *    `x-cinetpay-signature` ou `x-paystack-signature`.
 * 2. **Wave** — entête `x-wave-signature: t=<timestamp>,v1=<hex>` où `v1` est le
 *    HMAC-SHA256 du corps brut préfixé du timestamp (`<timestamp>.<corps brut>`).
 *
 * Sans aucun secret configuré, les callbacks non signés ne sont tolérés qu'hors
 * production (tests locaux) ; la production exige toujours une signature valide.
 */
function verifyWebhookSignature(req: Request): boolean {
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  const bodyBuffer = rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));

  const matches = (provided: string, expected: string): boolean => {
    const a = Buffer.from(provided.toLowerCase());
    const b = Buffer.from(expected.toLowerCase());
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  };

  // 1. Signature générique (HMAC du corps brut).
  const genericSignature = String(
    req.headers['x-signature'] ??
      req.headers['x-cinetpay-signature'] ??
      req.headers['x-paystack-signature'] ??
      ''
  ).trim();
  if (MOBILE_MONEY_WEBHOOK_SECRET && genericSignature) {
    const expected = crypto
      .createHmac('sha256', MOBILE_MONEY_WEBHOOK_SECRET)
      .update(bodyBuffer)
      .digest('hex');
    if (matches(genericSignature, expected)) return true;
  }

  // 2. Signature Wave : `t=<timestamp>,v1=<hex>`.
  const waveSignature = String(
    req.headers['x-wave-signature'] ?? req.headers['wave-signature'] ?? ''
  ).trim();
  if (WAVE_WEBHOOK_SECRET && waveSignature) {
    const parts: Record<string, string> = {};
    for (const kv of waveSignature.split(',')) {
      const idx = kv.indexOf('=');
      if (idx > 0) parts[kv.slice(0, idx).trim()] = kv.slice(idx + 1).trim();
    }
    if (parts.t && parts.v1) {
      const expected = crypto
        .createHmac('sha256', WAVE_WEBHOOK_SECRET)
        .update(`${parts.t}.${bodyBuffer.toString('utf8')}`)
        .digest('hex');
      if (matches(parts.v1, expected)) return true;
    }
  }

  // Aucun secret configuré : notifications non signées tolérées hors production seulement.
  return !MOBILE_MONEY_WEBHOOK_SECRET && !WAVE_WEBHOOK_SECRET ? !isProduction : false;
}

/**
 * Crée une session de paiement hébergée Wave et renvoie son URL de lancement.
 *
 * ⚠️ L'argent n'est PAS encaissé à cet appel : Wave se contente de préparer une page de
 * paiement. C'est le webhook signé qui, après confirmation réelle par l'opérateur, fera
 * passer la transaction `PENDING` à `SUCCESSFUL`. Sans clé configurée, on renvoie `null`
 * et le flux retombe sur le suivi « en attente » sans redirection.
 */
async function createWaveCheckoutSession(params: {
  amountFcfa: number;
  reference: string;
}): Promise<string | null> {
  if (!WAVE_API_KEY) return null;

  const base = APP_URL || `http://localhost:${PORT}`;
  const response = await fetch(WAVE_CHECKOUT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WAVE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: String(params.amountFcfa),
      currency: 'XOF',
      // Identifie la transaction côté VFC : Wave la renverra dans le webhook.
      client_reference: params.reference,
      success_url: `${base}/?payment=success&reference=${encodeURIComponent(params.reference)}`,
      error_url: `${base}/?payment=failed&reference=${encodeURIComponent(params.reference)}`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Wave indisponible (HTTP ${response.status}) ${detail.slice(0, 300)}`.trim());
  }

  const json = (await response.json().catch(() => null)) as any;
  return (json?.wave_launch_url as string) || null;
}

/** Jeton OAuth2 Orange Money mis en cache (valable une heure, comme l'API SMS). */
let orangeMoneyToken: { value: string; expiresAt: number } | null = null;

async function getOrangeMoneyAccessToken(forceRenew = false): Promise<string> {
  if (!forceRenew && orangeMoneyToken && orangeMoneyToken.expiresAt > Date.now() + 30_000) {
    return orangeMoneyToken.value;
  }

  const credentials = Buffer.from(
    `${ORANGE_MONEY_CLIENT_ID}:${ORANGE_MONEY_CLIENT_SECRET}`
  ).toString('base64');
  const response = await fetch(ORANGE_MONEY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error(`Authentification Orange Money refusée (HTTP ${response.status})`);
  }

  const json = (await response.json().catch(() => null)) as any;
  if (!json?.access_token) {
    throw new Error('Jeton Orange Money absent de la réponse');
  }

  orangeMoneyToken = {
    value: json.access_token as string,
    expiresAt: Date.now() + Number(json.expires_in ?? 3600) * 1000,
  };
  return orangeMoneyToken.value;
}

/**
 * Crée un paiement Web Orange Money et renvoie l'URL de la page hébergée.
 *
 * ⚠️ Comme pour Wave, l'argent n'est pas encaissé ici : le client confirme sur la page
 * Orange, puis le webhook (`notif_url`) déclenche le passage de PENDING à SUCCESSFUL.
 * Sans identifiants configurés, on renvoie `null` et le flux reste « en attente ».
 */
async function createOrangeMoneyWebPayment(params: {
  amountFcfa: number;
  reference: string;
  /** MSISDN du payeur au format 225XXXXXXXX : certaines zones Orange l'exigent (sans « + »). */
  subscriberNumber?: string;
}): Promise<string | null> {
  if (!ORANGE_MONEY_CLIENT_ID || !ORANGE_MONEY_CLIENT_SECRET || !ORANGE_MONEY_MERCHANT_KEY) {
    return null;
  }

  const base = APP_URL || `http://localhost:${PORT}`;
  const payload = {
    merchant_key: ORANGE_MONEY_MERCHANT_KEY,
    currency: ORANGE_MONEY_CURRENCY,
    // `order_id` doit être unique : la référence VFC l'est (contrainte @unique).
    order_id: params.reference,
    amount: params.amountFcfa,
    // Omis si le numéro est inconnu (JSON.stringify ignore les valeurs `undefined`).
    subscriber_number: params.subscriberNumber,
    return_url: `${base}/?payment=success&reference=${encodeURIComponent(params.reference)}`,
    cancel_url: `${base}/?payment=failed&reference=${encodeURIComponent(params.reference)}`,
    // Webhook : Orange y notifie le statut final ; il est authentifié par signature/HMAC.
    notif_url: `${base}/api/payments/webhook`,
    lang: 'fr',
    reference: params.reference,
  };

  const dispatch = (token: string) =>
    fetch(ORANGE_MONEY_WEBPAY_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

  // Le jeton peut expirer : on le renouvelle une fois avant d'abandonner.
  let response = await dispatch(await getOrangeMoneyAccessToken());
  if (response.status === 401) {
    response = await dispatch(await getOrangeMoneyAccessToken(true));
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `Orange Money indisponible (HTTP ${response.status}) ${detail.slice(0, 300)}`.trim()
    );
  }

  const json = (await response.json().catch(() => null)) as any;
  return (json?.payment_url as string) || null;
}

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

    // Envoi réel du SMS dès que la passerelle est configurée (SMS_API_URL + SMS_API_KEY).
    if (isSmsConfigured()) {
      try {
        await sendSms(cleanPhone, `Vallées Fleuries : votre code de sécurité est ${code}. Valable 10 minutes.`);
      } catch (error: any) {
        console.error('[OTP Send] Passerelle SMS :', error.message);
        return res.status(502).json({ success: false, error: 'Envoi du SMS impossible, veuillez réessayer.' });
      }
    } else if (isProduction) {
      // Annoncer un envoi qui n'a pas eu lieu serait mensonger.
      return res.status(503).json({
        success: false,
        error: 'Passerelle SMS non configurée : aucun code ne peut être délivré pour le moment.',
      });
    }

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
      clientPhone: req.body.clientPhone || req.body.phone || user.phoneNumber,
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

// Export CSV du grand livre Mobile Money, réservé aux administrateurs.
app.get('/api/admin/payments/export', authenticateJWT, requireRole(['ADMIN']), async (req, res) => {
  try {
    const transactions = await db.getTransactions();

    /** Échappe une valeur CSV et neutralise les formules qu'Excel exécuterait. */
    const cell = (value: unknown): string => {
      const raw = value === null || value === undefined ? '' : String(value);
      const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
      return `"${safe.replace(/"/g, '""')}"`;
    };

    const header = [
      'Référence',
      'Date',
      'Client',
      'Téléphone',
      'Moyen de paiement',
      'Objet',
      'Montant (FCFA)',
      'Frais (FCFA)',
      'Net (FCFA)',
      'Statut',
      'Référence opérateur',
    ];

    const rows = transactions.map((tx) => [
      tx.reference,
      new Date(tx.createdAt).toISOString(),
      tx.clientName ?? tx.payerName,
      tx.clientPhone ?? tx.payerPhone,
      tx.paymentMethod,
      tx.purpose,
      tx.amountFcfa,
      tx.feeFcfa,
      tx.netAmountFcfa,
      tx.status,
      tx.paymentProvider ?? '',
    ]);

    // Séparateur « ; » (Excel francophone) et BOM UTF-8 pour que les accents s'affichent.
    const csv =
      '\uFEFF' + [header, ...rows].map((row) => row.map(cell).join(';')).join('\r\n');
    const filename = `transactions-vfc-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error: any) {
    console.error('[Export CSV]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Envoi du code de validation Mobile Money : il précède le débit dès qu'une passerelle
// SMS existe. Sans passerelle, on n'annonce ni n'exige un code que personne ne recevrait :
// le débit se fait directement (`codeRequired: false`), et l'étape se réactive d'elle-même
// le jour où ORANGE_SMS_CLIENT_ID/ORANGE_SMS_CLIENT_SECRET (ou SMS_API_URL/KEY) sont fournis.
app.post('/api/payments/confirm-code', authenticateJWT, async (req, res) => {
  try {
    const user = (req as AuthedRequest).user!;
    const rawPhone = req.body?.phoneNumber || user.phoneNumber;
    if (!rawPhone) {
      return res.status(400).json({ success: false, error: 'Numéro de téléphone requis (+225)' });
    }

    const phone = sanitizeIvorianPhone(rawPhone);

    if (!isSmsConfigured()) {
      return res.json({
        success: true,
        codeRequired: false,
        message: 'Aucune passerelle SMS configurée : la validation par code est désactivée.',
      });
    }

    const { code, expiresAt } = await issueOtp(phone, 'PAYMENT');
    try {
      await sendSms(phone, `Vallées Fleuries : votre code de validation de paiement est ${code}. Valable 10 minutes.`);
    } catch (error: any) {
      console.error('[Payment OTP Send] Passerelle SMS :', error.message);
      return res.status(502).json({ success: false, error: 'Envoi du SMS impossible, veuillez réessayer.' });
    }

    res.json({
      success: true,
      codeRequired: true,
      message: `Code de validation envoyé par SMS au ${phone}`,
      expiresAt,
      // Renvoyé hors production uniquement, pour rester testable sans passerelle SMS.
      ...(isProduction ? {} : { devOtpCode: code }),
    });
  } catch (error: any) {
    console.error('[Payment OTP Send]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/payments/initiate', authenticateJWT, async (req, res) => {
  try {
    const user = (req as AuthedRequest).user!;
    const {
      phoneNumber,
      provider,
      amountFcfa,
      purpose,
      clientName,
      propertyTitle,
      propertyId,
      bookingId,
      leaseId,
      confirmationCode,
    } = req.body;

    if (!amountFcfa || Number(amountFcfa) <= 0) {
      return res.status(400).json({ success: false, error: 'Montant de paiement invalide' });
    }

    const payerPhone = sanitizeIvorianPhone(phoneNumber || user.phoneNumber || '');

    // 🔒 Aucun débit sans code de validation — mais uniquement quand une passerelle SMS peut
    // réellement le délivrer. Sans passerelle, exiger un code bloquerait tout paiement.
    if (isSmsConfigured()) {
      if (!confirmationCode) {
        return res.status(400).json({
          success: false,
          error: 'Code de validation requis avant exécution du paiement',
        });
      }

      const codeAccepted = await consumeOtp(payerPhone, String(confirmationCode), 'PAYMENT');
      if (!codeAccepted) {
        await writeAuditLog({
          userId: user.userId,
          action: 'PAYMENT_OTP_FAILED',
          entity: 'TRANSACTION',
          ipAddress: sessionMeta(req).ipAddress,
          details: { phoneNumber: payerPhone, amountFcfa: Number(amountFcfa) },
        });
        return res.status(400).json({ success: false, error: 'Code de validation incorrect ou expiré' });
      }
    }

    const tx = await db.processMobileMoneyPayment({
      userId: user.userId,
      phoneNumber: payerPhone,
      provider: provider || 'WAVE',
      amountFcfa: Number(amountFcfa),
      purpose: purpose || 'MOVE_IN_PACKAGE',
      clientName: clientName || user.fullName,
      propertyTitle,
      // Rattachement optionnel au contrat : c'est lui qui déclenche l'activation
      // du bail / de la réservation au moment du webhook d'encaissement.
      propertyId,
      bookingId,
      leaseId,
    });

    await writeAuditLog({
      userId: user.userId,
      action: 'PAYMENT_INITIATED',
      entity: 'TRANSACTION',
      entityId: tx.id,
      ipAddress: sessionMeta(req).ipAddress,
      details: { amountFcfa: tx.amountFcfa, provider: tx.paymentMethod, purpose: tx.purpose },
    });

    // Passerelle hébergée : on génère l'URL de paiement vers laquelle rediriger le client.
    // La transaction reste PENDING tant que le webhook n'a pas confirmé l'encaissement.
    const method = String(tx.paymentMethod).toUpperCase();
    let paymentUrl: string | null = null;
    try {
      if (method === 'WAVE') {
        paymentUrl = await createWaveCheckoutSession({
          amountFcfa: tx.amountFcfa,
          reference: tx.reference,
        });
      } else if (method === 'ORANGE_MONEY') {
        paymentUrl = await createOrangeMoneyWebPayment({
          amountFcfa: tx.amountFcfa,
          reference: tx.reference,
          // Orange attend le MSISDN sans « + » (225XXXXXXXX).
          subscriberNumber: payerPhone.replace('+', ''),
        });
      }
    } catch (error: any) {
      console.error('[Payment Initiate] Passerelle hébergée :', error.message);
      return res.status(502).json({
        success: false,
        error: "Initialisation du paiement auprès de l'opérateur impossible, veuillez réessayer.",
      });
    }

    res.json({ success: true, data: { ...tx, paymentUrl } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Public by necessity: Mobile Money gateways cannot present a user JWT.
// Authenticity is established by EITHER a valid HMAC signature (generic gateways)
// OR the gateway's own verification of the transaction (CinetPay-style, where the
// callback carries no signed body). Either way the callback is only reconciled
// against the PENDING transaction created at initiation.
app.post(['/api/payments/webhook', '/api/webhooks/mobile-money'], async (req, res) => {
  const body = (req.body ?? {}) as Record<string, any>;
  // Wave encapsule le détail dans `data` (ex. `data.client_reference`, `data.payment_status`).
  const data = (body.data ?? {}) as Record<string, any>;

  const reference = String(
    body.reference ??
      body.transaction_reference ??
      body.transaction_id ??
      body.cpm_trans_id ??
      body.tx_reference ??
      // Wave : référence posée à la création de la session de checkout.
      body.client_reference ??
      data.client_reference ??
      // Orange Money : référence commande transmise au webhook (notif_url).
      body.order_id ??
      ''
  ).trim();

  if (!reference) {
    return res.status(400).json({ success: false, error: 'Référence de transaction manquante' });
  }

  // Signature portée par l'entête : suffisante pour authentifier la notification.
  const signatureOk = verifyWebhookSignature(req);

  // Référence propre à l'opérateur : elle n'est conservée que pour l'encaissement réel.
  const operatorReference = String(
    body.operator_reference ??
      body.operatorReference ??
      body.gateway_reference ??
      body.cpm_payid ??
      // Orange Money : identifiant de transaction opérateur.
      body.txnid ??
      // Wave : identifiant de la session de checkout.
      data.id ??
      ''
  ).trim();
  const gatewayStatus = String(
    body.status ??
      body.status_code ??
      body.payment_status ??
      data.payment_status ??
      data.status ??
      ''
  ).toUpperCase();

  // Gateways disagree on field names; `accepted` is honoured when present,
  // otherwise a set of well-known success codes decides the outcome.
  let accepted =
    typeof body.accepted === 'boolean'
      ? body.accepted
      : ['SUCCESS', 'SUCCESSFUL', 'SUCCEEDED', 'ACCEPTED', 'PAID', 'COMPLETED', '00'].includes(
          gatewayStatus
        );

  // Orange Money ne signe pas sa notification : le `notif_token` sert de jeton de paiement
  // à rejouer auprès de l'API de statut pour authentifier l'encaissement.
  const orangePayToken = String(body.notif_token ?? body.notifToken ?? '').trim();

  // 🔒 Anti-falsification : le corps de la notification ne suffit jamais. Quand les clés de la
  // passerelle sont configurées, c'est SON verdict qui fait foi (il écrase celui du payload).
  let gatewayVerdict: 'ACCEPTED' | 'REJECTED' | 'UNVERIFIED' = 'UNVERIFIED';
  try {
    gatewayVerdict = await verifyWithGateway({
      reference,
      payToken: orangePayToken || undefined,
    });
    if (gatewayVerdict === 'ACCEPTED') accepted = true;
    else if (gatewayVerdict === 'REJECTED') accepted = false;
  } catch (error: any) {
    console.error('[Webhook Mobile Money] Vérification passerelle échouée :', error.message);
    // Sans signature valide, une passerelle injoignable laisse la notification non authentifiée.
    if (!signatureOk) {
      return res.status(500).json({
        success: false,
        error: 'Vérification auprès de la passerelle indisponible — notification à réémettre',
      });
    }
  }

  // Aucune des deux preuves d'authenticité n'est disponible : on refuse la notification.
  if (!signatureOk && gatewayVerdict === 'UNVERIFIED') {
    return res.status(401).json({
      success: false,
      error: 'Notification non authentifiée (signature absente et passerelle non configurée)',
    });
  }

  try {
    const settled = await db.settleTransactionByReference({
      reference,
      accepted,
      gatewayReference: operatorReference || undefined,
      gatewayPayload: body,
    });

    if (!settled) {
      return res.status(404).json({ success: false, error: `Transaction ${reference} introuvable` });
    }

    console.log(`[Webhook Mobile Money] ${reference} → ${settled.status}`);
    res.status(200).json({
      received: true,
      status: 'ACKNOWLEDGED',
      reference,
      transactionStatus: settled.status,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
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
  } catch (error: any) {
    console.error('[Invitation] Acceptation :', error);
    res.status(500).json({ success: false, error: error.message });
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

  // Provisionne le compte Super-Admin de la Direction à partir de `.env`.
  // Idempotent : sans configuration, l'opération est simplement ignorée, et un
  // échec de base ne doit jamais empêcher le serveur de démarrer.
  await ensureBootstrapAdmin().catch((error: any) => {
    console.error('[Bootstrap Admin] Échec du provisionnement :', error?.message ?? error);
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[VFC Production Engine] running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
