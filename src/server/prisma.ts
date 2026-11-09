/**
 * Vallées Fleuries Corporate — Prisma Client (Neon PostgreSQL Serverless)
 *
 * A single shared client for the whole Express process. Neon scales to zero and
 * suspends idle computes, so the client is created once and reused rather than
 * per-request (which would exhaust Postgres connections).
 *
 * Connectivity goes through the Neon serverless driver adapter
 * (@prisma/adapter-neon): queries travel over Neon's HTTPS/WebSocket endpoint
 * instead of a raw TCP 5432 socket, which is the recommended setup for
 * serverless Node runtimes and avoids the native query-engine socket path.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Node < 22 has no global WebSocket; the Neon driver needs an explicit one.
neonConfig.webSocketConstructor = ws;

declare global {
  // eslint-disable-next-line no-var
  var __vfcPrisma: PrismaClient | undefined;
}

export function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not configured. Copy the Neon connection string into .env before starting the server.'
    );
  }

  return new PrismaClient({
    adapter: new PrismaNeon({ connectionString }),
    log: ['error', 'warn'],
  });
}

// Reuse across hot-reloads in development so we never leak connection pools.
export const prisma: PrismaClient = globalThis.__vfcPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__vfcPrisma = prisma;
}

export async function isDatabaseReachable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
