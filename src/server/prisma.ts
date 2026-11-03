/**
 * Vallées Fleuries Corporate — Prisma Client (Neon PostgreSQL Serverless)
 *
 * A single shared client for the whole Express process. Neon scales to zero and
 * suspends idle computes, so the client is created once and reused rather than
 * per-request (which would exhaust Postgres connections).
 */

import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __vfcPrisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not configured. Copy the Neon connection string into .env before starting the server.'
    );
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['error', 'warn'],
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
