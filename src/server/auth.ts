import crypto from 'node:crypto';
import { User, UserRole } from '../types/index.ts';

/**
 * Résout un secret de signature : en production, une variable d'environnement
 * manquante stoppe le serveur au démarrage plutôt que de signer les jetons avec
 * une clé publique écrite dans le code source (jetons falsifiables).
 */
function resolveJwtSecret(variableName: string, devFallback: string): string {
  const value = process.env[variableName]?.trim();
  if (value) return value;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `[Sécurité] ${variableName} est obligatoire en production. ` +
        "Arrêt du serveur pour empêcher la signature de jetons avec une clé par défaut."
    );
  }

  console.warn(
    `[Sécurité] ${variableName} est absent : utilisation d'une clé de développement non sécurisée (interdit en production).`
  );
  return devFallback;
}

const JWT_SECRET = resolveJwtSecret('JWT_SECRET', 'vallees-fleuries-corporate-dev-secret-key-2026');
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET?.trim() || JWT_SECRET;

// Short-lived access token carried in the Authorization header.
export const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
// Long-lived refresh token stored in an HTTP-only cookie and persisted in `Session`.
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const ACCESS_TOKEN_COOKIE = 'vfc_access_token';
export const REFRESH_TOKEN_COOKIE = 'vfc_refresh_token';

export interface JWTPayload {
  userId: string;
  email: string;
  phoneNumber: string;
  role: UserRole;
  fullName: string;
  iat: number;
  exp: number;
}

/**
 * Refresh tokens carry only the session identity: the opaque `Session.token`
 * row id (jti), so a stolen refresh cookie cannot be replayed after the
 * session row is deleted (see `revokeSession` in authService.ts).
 */
export interface RefreshPayload {
  userId: string;
  jti: string;
  iat: number;
  exp: number;
}

// Base64Url helper
function base64UrlEncode(str: string | Buffer): string {
  const buf = typeof str === 'string' ? Buffer.from(str) : str;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

// Secure JWT generation using HMAC SHA-256
export function signJwtToken(
  payload: Omit<JWTPayload, 'iat' | 'exp'>,
  expiresInMs = ACCESS_TOKEN_TTL_MS
): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const exp = Math.floor((Date.now() + expiresInMs) / 1000);

  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto.createHmac('sha256', JWT_SECRET).update(data).digest();
  const encodedSignature = base64UrlEncode(signature);

  return `${data}.${encodedSignature}`;
}

// Secure JWT verification. Pass `secret = JWT_REFRESH_SECRET` for refresh tokens.
export function verifyJwtToken<T = JWTPayload>(token: string, secret: string = JWT_SECRET): T | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const data = `${headerB64}.${payloadB64}`;

    const expectedSig = base64UrlEncode(crypto.createHmac('sha256', secret).update(data).digest());
    const actual = Buffer.from(signatureB64);
    const expected = Buffer.from(expectedSig);
    // Constant-time compare to avoid leaking signature bytes via timing.
    if (actual.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(actual, expected)) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(payloadB64)) as JWTPayload & { exp?: number };
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    return payload as unknown as T;
  } catch (err) {
    return null;
  }
}

// ---- Refresh token helpers (signed with the dedicated refresh secret) ----

export function signRefreshToken(payload: { userId: string; jti: string }): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: RefreshPayload = {
    ...payload,
    iat: now,
    exp: Math.floor((Date.now() + REFRESH_TOKEN_TTL_MS) / 1000),
  };
  const data = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(fullPayload))}`;
  return `${data}.${base64UrlEncode(crypto.createHmac('sha256', JWT_REFRESH_SECRET).update(data).digest())}`;
}

export function verifyRefreshToken(token: string): RefreshPayload | null {
  return verifyJwtToken<RefreshPayload>(token, JWT_REFRESH_SECRET);
}

// ---- Minimal cookie parsing (avoids adding cookie-parser) ----

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

// Secure password hashing using PBKDF2 (Native Node.js Crypto)
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function comparePassword(password: string, storedHash: string): boolean {
  try {
    const [salt, originalHash] = storedHash.split(':');
    if (!salt || !originalHash) return false;
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
  } catch {
    return false;
  }
}

// Format phone number to clean Ivorian format (+225XXXXXXXXXX)
export function sanitizeIvorianPhone(phone: string): string {
  let cleaned = phone.replace(/[^0-9+]/g, '');
  if (!cleaned.startsWith('+225')) {
    if (cleaned.startsWith('225')) {
      cleaned = '+' + cleaned;
    } else {
      cleaned = '+225' + cleaned;
    }
  }
  return cleaned;
}
