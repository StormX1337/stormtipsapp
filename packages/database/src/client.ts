import { PrismaClient } from '@prisma/client';

export type { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __profitTipsPrisma__: PrismaClient | undefined;
}

const logLevels = (): ('query' | 'info' | 'warn' | 'error')[] => {
  if (process.env.PRISMA_LOG_QUERIES === 'true') return ['query', 'warn', 'error'];
  return process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['warn', 'error'];
};

export function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: logLevels(),
    datasources: { db: { url: process.env.DATABASE_URL } },
  });
}

/**
 * Singleton Prisma client.
 *
 * Re-used across hot reloads in development so that a long-running dev server
 * does not exhaust the Postgres connection pool.
 */
export const prisma: PrismaClient = globalThis.__profitTipsPrisma__ ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__profitTipsPrisma__ = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}

/** Lightweight liveness probe used by /health and /ready. */
export async function pingDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
