/**
 * Vallées Fleuries Corporate — Express Authentication & RBAC Guards
 *
 * `authenticateJWT` proves *who* the caller is (signature + expiry).
 * `requireRole` proves what the caller is *allowed* to do (granular RBAC).
 * They compose, so every protected endpoint declares both explicitly.
 */

import { NextFunction, Request, Response } from 'express';
import { UserRole } from '../types/index.ts';
import { ACCESS_TOKEN_COOKIE, JWTPayload, parseCookies, verifyJwtToken } from './auth.ts';

/** Express request decorated with the decoded access-token payload. */
export interface AuthedRequest extends Request {
  user?: JWTPayload;
}

/** Roles that implicitly satisfy a lower-privileged grant. */
const ROLE_IMPLICATIONS: Record<UserRole, UserRole[]> = {
  SUPER_ADMIN: ['SUPER_ADMIN', 'ADMIN', 'OWNER', 'AGENT', 'TENANT'],
  ADMIN: ['ADMIN', 'OWNER', 'AGENT', 'TENANT'],
  OWNER: ['OWNER', 'AGENT', 'TENANT'],
  AGENT: ['AGENT', 'TENANT'],
  TENANT: ['TENANT'],
};

/** Read the access token from the `Authorization` header, then the httpOnly cookie. */
export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return parseCookies(req.headers.cookie)[ACCESS_TOKEN_COOKIE] ?? null;
}

/**
 * Hard guard: rejects the request with 401 unless a valid access token is present.
 * Attaches the decoded payload to `req.user`.
 */
export function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      code: 'AUTH_REQUIRED',
      error: 'Authentification requise pour accéder à cette ressource.',
    });
  }

  const payload = verifyJwtToken(token);
  if (!payload) {
    return res.status(401).json({
      success: false,
      code: 'INVALID_TOKEN',
      error: 'Session expirée ou jeton invalide. Veuillez vous reconnecter.',
    });
  }

  (req as AuthedRequest).user = payload;
  return next();
}

/**
 * Soft guard for public endpoints that behave differently when signed in
 * (e.g. `/api/rentals` returning the caller's favourites). Never rejects.
 */
export function optionalJWT(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (token) {
    const payload = verifyJwtToken(token);
    if (payload) (req as AuthedRequest).user = payload;
  }
  return next();
}

/**
 * Granular RBAC:
 *   router.get('/admin/users', authenticateJWT, requireRole(['ADMIN']), handler)
 */
export function requireRole(allowedRoles: UserRole[]) {
  const allowed = new Set(allowedRoles);

  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthedRequest).user;
    if (!user) {
      return res.status(401).json({
        success: false,
        code: 'AUTH_REQUIRED',
        error: 'Authentification requise.',
      });
    }

    const effective = ROLE_IMPLICATIONS[user.role as UserRole] ?? [user.role as UserRole];
    const granted = effective.some((role) => allowed.has(role));

    if (!granted) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        error: 'Accès non autorisé : Privilèges insuffisants.',
      });
    }

    return next();
  };
}
