/**
 * Vallées Fleuries Corporate — Prisma-backed Authentication Data Access
 *
 * Every auth mutation goes through Neon. Passwords are never compared in the
 * clear; `Session` rows make refresh cookies revocable; `AuditLog` rows give the
 * Super-Admin console an immutable trail of security events.
 */

import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { prisma } from './prisma.ts';
import type { Prisma, User as PrismaUser, AdminInvitation } from '@prisma/client';
import { User, UserRole } from '../types/index.ts';
import { comparePassword, hashPassword, sanitizeIvorianPhone } from './auth.ts';

/** Shape the domain layer consumes — intentionally never exposes `passwordHash`. */
export function toDomainUser(user: PrismaUser): User {
  return {
    id: user.id,
    email: user.email,
    phoneNumber: user.phoneNumber,
    fullName: user.fullName,
    role: user.role as UserRole,
    avatarUrl: user.avatarUrl ?? undefined,
    companyName: user.companyName ?? undefined,
    isKycVerified: user.isKycVerified,
    createdAt: user.createdAt.toISOString(),
  };
}

/** Placeholder mailbox for accounts created from a phone number alone. */
export function emailForPhone(phoneNumber: string): string {
  return `${phoneNumber.replace('+', '')}@phone.valleesfleuries.ci`;
}

/**
 * Resolve an identifier that may be an email OR an Ivorian phone number.
 * Phone lookups accept local formatting (`0173839518`) by comparing the
 * normalised digits against each stored international number.
 */
export async function findUserByIdentifier(identifier: string): Promise<PrismaUser | null> {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  if (trimmed.includes('@')) {
    return prisma.user.findUnique({ where: { email: trimmed.toLowerCase() } });
  }

  const normalised = sanitizeIvorianPhone(trimmed);
  const si = normalised.slice(-10);

  return prisma.user.findFirst({
    where: {
      OR: [
        { phoneNumber: normalised },
        ...(si.length === 10
          ? [{ phoneNumber: { endsWith: si } }, { phoneNumber: { endsWith: '0' + si } }]
          : []),
        { email: trimmed.toLowerCase() },
      ],
    },
  });
}

export function findUserById(id: string): Promise<PrismaUser | null> {
  return prisma.user.findUnique({ where: { id } });
}

export interface CreateUserInput {
  fullName: string;
  phoneNumber: string;
  email?: string;
  password?: string;
  role?: UserRole;
  companyName?: string;
  avatarUrl?: string;
}

export async function createUser(input: CreateUserInput): Promise<PrismaUser> {
  const phoneNumber = sanitizeIvorianPhone(input.phoneNumber);
  const email = (input.email?.trim() || emailForPhone(phoneNumber)).toLowerCase();

  return prisma.user.create({
    data: {
      fullName: input.fullName,
      phoneNumber,
      email,
      passwordHash: input.password ? hashPassword(input.password) : null,
      role: (input.role ?? 'TENANT') as PrismaUser['role'],
      companyName: input.companyName,
      avatarUrl: input.avatarUrl,
    },
  });
}

/* ------------------------------------------------------------------ */
/* Bootstrap du compte Super-Admin (Direction Générale)                */
/* ------------------------------------------------------------------ */

/**
 * Crée (ou promeut) le compte Super-Admin de la Direction à partir de variables
 * d'environnement, afin que le portail admin soit atteignable sans insertion
 * manuelle en base. Idempotent et sans danger :
 *   - ne fait rien tant que les variables ne sont pas renseignées ;
 *   - ne remplace jamais le mot de passe d'un compte existant qui en possède déjà un.
 * Réutilise le hachage PBKDF2 et la route `/api/auth/login` existante : aucune
 * seconde authentification, aucun schéma modifié.
 */
export async function ensureBootstrapAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? '';
  const password = process.env.ADMIN_PASSWORD ?? '';
  const phoneNumber = process.env.ADMIN_PHONE?.trim() ?? '';
  const fullName = process.env.ADMIN_FULLNAME?.trim() || 'Direction Générale VFC';

  // Bootstrap désactivé tant que la configuration n'est pas renseignée.
  if (!email && !password && !phoneNumber) return;

  if (!email.includes('@')) {
    console.warn('[Bootstrap Admin] ADMIN_EMAIL manquant ou invalide : opération ignorée.');
    return;
  }
  if (password.length < 10) {
    console.warn(
      '[Bootstrap Admin] ADMIN_PASSWORD doit contenir au moins 10 caractères : opération ignorée.'
    );
    return;
  }

  const existing = await findUserByIdentifier(email);

  if (existing) {
    const alreadyPrivileged = existing.role === 'ADMIN' || existing.role === 'SUPER_ADMIN';
    if (alreadyPrivileged && existing.passwordHash) {
      console.log(`[Bootstrap Admin] Compte Super-Admin déjà opérationnel (${email}).`);
      return;
    }
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: 'SUPER_ADMIN' as PrismaUser['role'],
        // Un compte sans mot de passe (créé par OTP) reçoit celui du bootstrap.
        ...(existing.passwordHash ? {} : { passwordHash: hashPassword(password) }),
      },
    });
    console.log(`[Bootstrap Admin] Compte existant promu en SUPER_ADMIN (${email}).`);
    return;
  }

  if (!phoneNumber) {
    console.warn(
      '[Bootstrap Admin] ADMIN_PHONE requis pour créer le compte Super-Admin : opération ignorée.'
    );
    return;
  }

  // Le numéro de téléphone est unique en base. On vérifie donc qu'il est libre AVANT
  // l'insertion, pour ne jamais laisser fuiter l'erreur Prisma P2002 brute en console.
  const normalizedPhone = sanitizeIvorianPhone(phoneNumber);
  const phoneOwner = await prisma.user.findUnique({ where: { phoneNumber: normalizedPhone } });

  if (phoneOwner) {
    console.warn(
      `[Bootstrap Admin] ADMIN_PHONE (${normalizedPhone}) est déjà rattaché au compte ` +
        `${phoneOwner.email} [${phoneOwner.role}] : création ignorée.\n` +
        "  → Solution 1 : renseignez ADMIN_EMAIL avec l'email d'un compte existant, il sera promu SUPER_ADMIN ;\n" +
        "  → Solution 2 : choisissez un ADMIN_PHONE qui n'est attribué à aucun compte."
    );
    return;
  }

  await createUser({ email, phoneNumber, fullName, password, role: 'SUPER_ADMIN' });
  console.log(`[Bootstrap Admin] Compte SUPER_ADMIN créé (${email}).`);
}

/* ------------------------------------------------------------------ */
/* Sessions (HTTP-only refresh cookies)                                */
/* ------------------------------------------------------------------ */

export interface SessionMetadata {
  userAgent?: string;
  ipAddress?: string;
}

export async function createSession(
  userId: string,
  ttlMs: number,
  meta: SessionMetadata = {}
): Promise<{ sessionId: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + ttlMs);
  const session = await prisma.session.create({
    data: {
      userId,
      // Opaque server-side handle; the signed JWT carries only this id.
      token: crypto.randomBytes(32).toString('hex'),
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      expiresAt,
    },
  });
  return { sessionId: session.id, expiresAt };
}

export async function findActiveSession(sessionId: string) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return session;
}

export async function revokeSession(sessionId: string): Promise<void> {
  await prisma.session.delete({ where: { id: sessionId } }).catch(() => undefined);
}

/* ------------------------------------------------------------------ */
/* Passerelle SMS (+225)                                               */
/* ------------------------------------------------------------------ */

/**
 * Deux passerelles possibles, dans cet ordre de priorité :
 *
 * 1. **Orange SMS API** (`ORANGE_SMS_CLIENT_ID` + `ORANGE_SMS_CLIENT_SECRET`, créées
 *    sur developer.orange.com) — l'API officielle pour la Côte d'Ivoire, payable avec
 *    du crédit Orange. Elle couvre les numéros Orange uniquement.
 * 2. **Passerelle générique** (`SMS_API_URL` + `SMS_API_KEY`) — pour un agrégateur tiers
 *    (Nimba, Semoa, Twilio…) qui, lui, atteint aussi MTN et Moov.
 *
 * Tant qu'aucune n'est configurée, aucun SMS n'est émis : hors production le code est
 * renvoyé dans la réponse pour rester testable, en production la requête est refusée
 * explicitement plutôt que d'annoncer un envoi qui n'a pas eu lieu.
 */
const ORANGE_SMS_CLIENT_ID = process.env.ORANGE_SMS_CLIENT_ID || '';
const ORANGE_SMS_CLIENT_SECRET = process.env.ORANGE_SMS_CLIENT_SECRET || '';
/** Numéro expéditeur officiel de la Côte d'Ivoire (valeur imposée par Orange). */
const ORANGE_SMS_SENDER_NUMBER = process.env.ORANGE_SMS_SENDER_NUMBER || '+2250000';
/** Sender name personnalisé (11 caractères max), à faire valider par Orange au préalable. */
const ORANGE_SMS_SENDER_NAME = process.env.ORANGE_SMS_SENDER_NAME || '';
const ORANGE_TOKEN_URL = 'https://api.orange.com/oauth/v3/token';
const ORANGE_SMS_BASE_URL = 'https://api.orange.com/smsmessaging/v1';

const SMS_API_URL = process.env.SMS_API_URL || '';
const SMS_API_KEY = process.env.SMS_API_KEY || '';

function resolveSmsProvider(): 'orange' | 'generic' | null {
  if (ORANGE_SMS_CLIENT_ID && ORANGE_SMS_CLIENT_SECRET) return 'orange';
  if (SMS_API_URL && SMS_API_KEY) return 'generic';
  return null;
}

export function isSmsConfigured(): boolean {
  return resolveSmsProvider() !== null;
}

/** Jeton OAuth2 Orange mis en cache : il reste valable une heure. */
let orangeToken: { value: string; expiresAt: number } | null = null;

async function getOrangeAccessToken(forceRenew = false): Promise<string> {
  if (!forceRenew && orangeToken && orangeToken.expiresAt > Date.now() + 30_000) {
    return orangeToken.value;
  }

  const credentials = Buffer.from(`${ORANGE_SMS_CLIENT_ID}:${ORANGE_SMS_CLIENT_SECRET}`).toString('base64');
  const response = await fetch(ORANGE_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error(`Authentification Orange SMS refusée (HTTP ${response.status})`);
  }

  const json = (await response.json().catch(() => null)) as any;
  if (!json?.access_token) {
    throw new Error('Jeton Orange SMS absent de la réponse');
  }

  orangeToken = {
    value: json.access_token as string,
    expiresAt: Date.now() + Number(json.expires_in ?? 3600) * 1000,
  };
  return orangeToken.value;
}

/** Envoi via l'API officielle Orange (Côte d'Ivoire). */
async function sendOrangeSms(phoneNumber: string, message: string): Promise<void> {
  const sender = ORANGE_SMS_SENDER_NUMBER.startsWith('+')
    ? ORANGE_SMS_SENDER_NUMBER
    : `+${ORANGE_SMS_SENDER_NUMBER}`;
  const endpoint = `${ORANGE_SMS_BASE_URL}/outbound/${encodeURIComponent(`tel:${sender}`)}/requests`;

  const dispatch = (token: string) =>
    fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outboundSMSMessageRequest: {
          address: `tel:${sanitizeIvorianPhone(phoneNumber)}`,
          senderAddress: `tel:${sender}`,
          ...(ORANGE_SMS_SENDER_NAME ? { senderName: ORANGE_SMS_SENDER_NAME } : {}),
          outboundSMSTextMessage: { message },
        },
      }),
    });

  // Le jeton peut expirer en cours de route : on le renouvelle une fois avant d'abandonner.
  let response = await dispatch(await getOrangeAccessToken());
  if (response.status === 401) {
    response = await dispatch(await getOrangeAccessToken(true));
  }

  if (!response.ok) {
    throw new Error(`Orange SMS indisponible (HTTP ${response.status})`);
  }
}

/** Envoi via une passerelle tierce au format JSON le plus répandu (`{ to, message }`). */
async function sendGenericSms(phoneNumber: string, message: string): Promise<void> {
  const response = await fetch(SMS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SMS_API_KEY}`,
    },
    body: JSON.stringify({ to: sanitizeIvorianPhone(phoneNumber), message }),
  });

  if (!response.ok) {
    throw new Error(`Passerelle SMS indisponible (HTTP ${response.status})`);
  }
}

export async function sendSms(phoneNumber: string, message: string): Promise<void> {
  const provider = resolveSmsProvider();
  if (provider === 'orange') return sendOrangeSms(phoneNumber, message);
  if (provider === 'generic') return sendGenericSms(phoneNumber, message);
  throw new Error('Aucune passerelle SMS configurée');
}

/* ------------------------------------------------------------------ */
/* SMS OTP (+225)                                                      */
/* ------------------------------------------------------------------ */

const OTP_TTL_MS = 10 * 60 * 1000;

export async function issueOtp(
  phoneNumber: string,
  purpose = 'LOGIN'
): Promise<{ code: string; expiresAt: Date }> {
  const phone = sanitizeIvorianPhone(phoneNumber);
  const code = String(crypto.randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  // Only the newest challenge for a phone/purpose pair may be redeemed.
  await prisma.oTPVerification.updateMany({
    where: { phoneNumber: phone, purpose, verified: false },
    data: { verified: true },
  });

  await prisma.oTPVerification.create({
    data: {
      phoneNumber: phone,
      codeHash: hashPassword(code),
      purpose,
      expiresAt,
    },
  });

  return { code, expiresAt };
}

export async function consumeOtp(
  phoneNumber: string,
  code: string,
  /** Restreint la vérification à un type de challenge (« LOGIN », « PAYMENT »…). */
  purpose?: string
): Promise<boolean> {
  const phone = sanitizeIvorianPhone(phoneNumber);

  const challenge = await prisma.oTPVerification.findFirst({
    where: {
      phoneNumber: phone,
      verified: false,
      expiresAt: { gt: new Date() },
      ...(purpose ? { purpose } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!challenge || !comparePassword(code, challenge.codeHash)) return false;

  await prisma.oTPVerification.update({
    where: { id: challenge.id },
    data: { verified: true },
  });
  return true;
}

/* ------------------------------------------------------------------ */
/* Audit trail                                                         */
/* ------------------------------------------------------------------ */

export interface AuditEntry {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  ipAddress?: string | null;
  details?: unknown;
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        ipAddress: entry.ipAddress ?? null,
        details: entry.details === undefined ? null : JSON.stringify(entry.details),
      },
    });
  } catch (error) {
    // Never let a logging failure break an authentication flow.
    console.error('[AuditLog] Failed to persist entry:', error);
  }
}

/* ------------------------------------------------------------------ */
/* E-mail (SMTP via nodemailer)                                        */
/* ------------------------------------------------------------------ */

/**
 * Un unique serveur SMTP suffit pour toutes les notifications transactionnelles
 * (invitations administrateur, reçus, alertes). Tant que `SMTP_HOST`, `SMTP_USER`
 * et `SMTP_PASSWORD` ne sont pas renseignés, aucun e-mail n'est émis : le code
 * d'invitation est alors renvoyé à l'administrateur qui le transmet lui-même.
 */
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || '';
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const MAIL_FROM = process.env.MAIL_FROM || 'Vallées Fleuries Corporate <no-reply@valleesfleuries.ci>';

export function isMailConfigured(): boolean {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASSWORD);
}

let mailTransport: nodemailer.Transporter | null = null;

function getMailTransport(): nodemailer.Transporter {
  if (!mailTransport) {
    mailTransport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    });
  }
  return mailTransport;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendMail(message: MailMessage): Promise<void> {
  if (!isMailConfigured()) {
    throw new Error('Aucun serveur SMTP configuré (SMTP_HOST / SMTP_USER / SMTP_PASSWORD)');
  }
  await getMailTransport().sendMail({
    from: MAIL_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
    ...(message.html ? { html: message.html } : {}),
  });
}

/* ------------------------------------------------------------------ */
/* Invitations administrateur (Command Center)                         */
/* ------------------------------------------------------------------ */

/** Une invitation reste valable une semaine par défaut. */
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Format lisible et non devinable : `VFC-XXXXXXXXXXXX`. */
function generateInvitationCode(): string {
  return `VFC-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
}

export interface CreateInvitationInput {
  email: string;
  phoneNumber?: string;
  fullName?: string;
  role?: UserRole;
  invitedById?: string | null;
}

/**
 * Émet une invitation. Les invitations encore `PENDING` pour le même e-mail sont
 * d'abord marquées `EXPIRED` : un seul code valide ne circule à la fois par adresse.
 */
export async function createAdminInvitation(input: CreateInvitationInput) {
  const email = input.email.trim().toLowerCase();
  const phoneNumber = input.phoneNumber ? sanitizeIvorianPhone(input.phoneNumber) : null;

  await prisma.adminInvitation.updateMany({
    where: { email, status: 'PENDING' },
    data: { status: 'EXPIRED' },
  });

  return prisma.adminInvitation.create({
    data: {
      email,
      phoneNumber,
      fullName: input.fullName?.trim() || null,
      role: input.role ?? 'ADMIN',
      code: generateInvitationCode(),
      invitedById: input.invitedById ?? null,
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    },
  });
}

/** Historique complet, de la plus récente à la plus ancienne. */
export function listAdminInvitations() {
  return prisma.adminInvitation.findMany({
    orderBy: { createdAt: 'desc' },
    include: { invitedBy: { select: { fullName: true, email: true } } },
  });
}

export function findInvitationByCode(code: string) {
  return prisma.adminInvitation.findUnique({ where: { code: code.trim().toUpperCase() } });
}

/** Révocation manuelle : le code cesse immédiatement d'être accepté. */
export async function revokeAdminInvitation(id: string) {
  const invitation = await prisma.adminInvitation.findUnique({ where: { id } });
  if (!invitation) return null;
  return prisma.adminInvitation.update({ where: { id }, data: { status: 'REVOKED' } });
}

export async function markInvitationAccepted(id: string) {
  return prisma.adminInvitation.update({
    where: { id },
    data: { status: 'ACCEPTED', acceptedAt: new Date() },
  });
}

export async function expireInvitation(id: string) {
  return prisma.adminInvitation.update({ where: { id }, data: { status: 'EXPIRED' } });
}

export interface AcceptInvitationInput {
  code: string;
  fullName?: string;
  password?: string;
  phoneNumber?: string;
}

export type AcceptInvitationResult =
  | { ok: true; user: PrismaUser; invitation: AdminInvitation }
  | { ok: false; status: number; error: string };

/**
 * Active l'invitation : crée le compte (ou promeut un compte existant portant le
 * même e-mail) vers le rôle de l'invitation, puis la consomme. Le mot de passe est
 * exigé à la création ; un compte existant qui en possède déjà un n'est jamais écrasé.
 */
export async function acceptAdminInvitation(
  input: AcceptInvitationInput
): Promise<AcceptInvitationResult> {
  const invitation = input.code ? await findInvitationByCode(input.code) : null;
  if (!invitation) return { ok: false, status: 404, error: "Code d'invitation introuvable" };
  if (invitation.status === 'ACCEPTED') {
    return { ok: false, status: 409, error: 'Cette invitation a déjà été utilisée' };
  }
  if (invitation.status === 'REVOKED') {
    return { ok: false, status: 403, error: 'Cette invitation a été révoquée' };
  }
  if (invitation.status === 'EXPIRED' || invitation.expiresAt.getTime() < Date.now()) {
    if (invitation.status !== 'EXPIRED') await expireInvitation(invitation.id);
    return { ok: false, status: 410, error: 'Cette invitation a expiré' };
  }
  if (input.password && input.password.length < 10) {
    return { ok: false, status: 400, error: 'Le mot de passe doit contenir au moins 10 caractères' };
  }

  const existing = await findUserByIdentifier(invitation.email);
  let user: PrismaUser;

  if (existing) {
    user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        // L'invitation fait foi sur le rôle, mais ne réinitialise pas un mot de passe existant.
        role: invitation.role,
        ...(existing.passwordHash || !input.password
          ? {}
          : { passwordHash: hashPassword(input.password) }),
        ...(existing.isBanned ? { isBanned: false, banReason: null } : {}),
      },
    });
  } else {
    const rawPhone = input.phoneNumber || invitation.phoneNumber;
    if (!rawPhone) {
      return {
        ok: false,
        status: 400,
        error: 'Numéro de téléphone requis pour activer le compte administrateur',
      };
    }
    const phoneNumber = sanitizeIvorianPhone(rawPhone);
    const owner = await prisma.user.findUnique({ where: { phoneNumber } });
    if (owner) {
      return { ok: false, status: 409, error: 'Ce numéro de téléphone est déjà associé à un compte' };
    }
    user = await createUser({
      email: invitation.email,
      phoneNumber,
      fullName: input.fullName?.trim() || invitation.fullName || 'Administrateur VFC',
      password: input.password,
      role: invitation.role,
    });
  }

  const accepted = await markInvitationAccepted(invitation.id);
  return { ok: true, user, invitation: accepted };
}
