/**
 * Vallées Fleuries Corporate — Prisma-backed Authentication Data Access
 *
 * Every auth mutation goes through Neon. Passwords are never compared in the
 * clear; `Session` rows make refresh cookies revocable; `AuditLog` rows give the
 * Super-Admin console an immutable trail of security events.
 */

import crypto from 'node:crypto';
import { prisma } from './prisma.ts';
import type { Prisma, User as PrismaUser } from '@prisma/client';
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
 * Phone lookups accept local formatting (`07 09 88 77 66`) by comparing the
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

export async function consumeOtp(phoneNumber: string, code: string): Promise<boolean> {
  const phone = sanitizeIvorianPhone(phoneNumber);

  const challenge = await prisma.oTPVerification.findFirst({
    where: { phoneNumber: phone, verified: false, expiresAt: { gt: new Date() } },
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
