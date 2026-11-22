/**
 * Vallées Fleuries Corporate — Prisma Client (Neon PostgreSQL)
 *
 * Transport : l'environnement d'exécution filtre le port PostgreSQL 5432
 * (aucun handshake TCP n'aboutit, d'où « Can't reach database server » et
 * ETIMEDOUT côté moteur Prisma standard). Seul le port 443 sortant est ouvert.
 * On adosse donc le même `PrismaClient` au driver serverless Neon (WebSocket
 * sur 443) via l'adaptateur officiel `@prisma/adapter-neon`, dépendance déjà
 * présente dans le projet : aucune seconde couche d'accès aux données n'est
 * introduite.
 */

import ws from 'ws';
import { neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Prisma, PrismaClient } from '@prisma/client';

// Sous Node.js, le driver Neon exige un constructeur WebSocket explicite.
neonConfig.webSocketConstructor = ws as unknown as typeof WebSocket;

declare global {
  // eslint-disable-next-line no-var
  var __vfcPrisma: PrismaClient | undefined;
}

/** Codes Prisma signalant une indisponibilité réseau / base (jamais une erreur métier). */
const CONNECTION_ERROR_CODES = new Set(['P1000', 'P1001', 'P1002', 'P1008', 'P1010', 'P1017']);

const CONNECTION_ERROR_PATTERNS = [
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ECONNRESET',
  'EPIPE',
  'ENOTFOUND',
  'EHOSTUNREACH',
  'ENETUNREACH',
  "Can't reach database server",
  'Connection terminated',
  'Connection closed',
  'WebSocket',
  'AggregateError',
  'timed out',
  'timeout',
];

export interface PrismaErrorInfo {
  name: string;
  message: string;
  code?: string;
  meta?: unknown;
  /** Vrai si l'échec vient du réseau / de la disponibilité de Neon, non du code métier. */
  isConnectionError: boolean;
}

/** Supprime toute chaîne de connexion ou secret avant journalisation. */
export function redactSecrets(value: string): string {
  return value
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, 'postgresql://[redacted]')
    .replace(/(password|pwd|secret|token)=([^\s&"']+)/gi, '$1=[redacted]');
}

/**
 * Normalise n'importe quelle erreur Prisma (ou réseau) en informations
 * exploitables : nom, message, code, métadonnées et classification. Remplace la
 * journalisation opaque « prisma:error undefined ».
 */
export function describePrismaError(error: unknown): PrismaErrorInfo {
  const raw = error as { name?: string; message?: string; code?: unknown; meta?: unknown } | null;

  const name =
    raw?.name ??
    (error instanceof Error ? 'Error' : error === null ? 'NullError' : typeof error);
  const message =
    typeof raw?.message === 'string' && raw.message.length > 0
      ? raw.message
      : `(aucun message) — erreur sérialisée : ${safeStringify(error)}`;
  const code = typeof raw?.code === 'string' ? raw.code : undefined;
  const meta = raw?.meta;

  const haystack = `${name} ${message}`;
  const isConnectionError =
    (code !== undefined && CONNECTION_ERROR_CODES.has(code)) ||
    error instanceof Prisma.PrismaClientInitializationError ||
    name === 'AggregateError' ||
    CONNECTION_ERROR_PATTERNS.some((pattern) => haystack.includes(pattern));

  return { name, message, code, meta, isConnectionError };
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/** Journalise un événement Prisma de façon structurée et expurgée des secrets. */
function logPrismaError(level: 'ERROR' | 'WARN', error: unknown): void {
  const info = describePrismaError(error);
  const location = info.code ? ` (${info.code})` : '';
  const meta = info.meta === undefined ? '' : `\n  meta: ${redactSecrets(safeStringify(info.meta))}`;
  console.error(`[Prisma] ${level} — ${info.name}${location}: ${redactSecrets(info.message)}${meta}`);
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not configured. Copy the Neon connection string into .env before starting the server.'
    );
  }

  const adapter = new PrismaNeon(
    {
      connectionString,
      max: Number(process.env.DB_POOL_SIZE) || 10,
      // Échec rapide et lisible plutôt qu'un blocage indéfini si Neon est injoignable.
      connectionTimeoutMillis: 15_000,
      idleTimeoutMillis: 30_000,
    },
    {
      onPoolError: (error) => logPrismaError('ERROR', error),
      onConnectionError: (error) => logPrismaError('ERROR', error),
    }
  );

  // Journalisation par événements : on maîtrise le format (code, nom, message)
  // au lieu du « prisma:error undefined » émis par le logger par défaut.
  const client = new PrismaClient({
    adapter,
    log: [
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
    ],
  });

  (client as unknown as { $on: (event: string, cb: (e: unknown) => void) => void }).$on(
    'error',
    (event) => logPrismaError('ERROR', event)
  );
  (client as unknown as { $on: (event: string, cb: (e: unknown) => void) => void }).$on(
    'warn',
    (event) => logPrismaError('WARN', event)
  );

  return client;
}

// Reuse across hot-reload in development so we never leak connection pools.
export const prisma: PrismaClient = globalThis.__vfcPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__vfcPrisma = prisma;
}

/**
 * Rejoue une opération lorsque — et seulement lorsque — l'échec provient du
 * réseau ou de la disponibilité de Neon. Une erreur métier (contrainte,
 * validation) n'est jamais réessayée : elle remonte immédiatement.
 */
export async function withConnectionRetry<T>(
  operation: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 750
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!describePrismaError(error).isConnectionError || attempt === attempts) {
        throw error;
      }
      const delay = baseDelayMs * attempt;
      console.warn(
        `[Prisma] Neon injoignable (tentative ${attempt}/${attempts}) — nouvel essai dans ${delay} ms.`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export async function isDatabaseReachable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logPrismaError('ERROR', error);
    return false;
  }
}
