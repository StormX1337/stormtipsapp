import { PrismaClient } from '@prisma/client';

export type { PrismaClient } from '@prisma/client';

declare global {
  var __profitTipsPrisma__: PrismaClient | undefined;
}

function logLevels(): ('query' | 'info' | 'warn' | 'error')[] {
  return process.env.PRISMA_LOG_QUERIES === 'true' ? ['query', 'warn', 'error'] : ['warn', 'error'];
}

export function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env, or export DATABASE_URL before starting the process.',
    );
  }
  return new PrismaClient({ log: logLevels(), datasources: { db: { url } } });
}

let instance: PrismaClient | undefined;

function client(): PrismaClient {
  instance ??= globalThis.__profitTipsPrisma__ ?? createPrismaClient();
  // Re-used across hot reloads in development so a long-running dev server does
  // not exhaust the Postgres connection pool.
  if (process.env.NODE_ENV !== 'production') globalThis.__profitTipsPrisma__ = instance;
  return instance;
}

/**
 * Lazily constructed singleton.
 *
 * The proxy matters: importing this module must not read `DATABASE_URL`, because
 * module import order is not guaranteed to run after the environment loader.
 * The client is created on first actual use instead.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const value = Reflect.get(client() as object, property, receiver);
    return typeof value === 'function' ? value.bind(client()) : value;
  },
  has(_target, property) {
    return Reflect.has(client() as object, property);
  },
});

export async function disconnectPrisma(): Promise<void> {
  if (instance) await instance.$disconnect();
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
