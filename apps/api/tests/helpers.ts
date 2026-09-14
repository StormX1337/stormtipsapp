import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@storm-tips/database';
import { hashPassword, generateReferralCode } from '@storm-tips/auth';
import { buildServer } from '../src/server.js';
import { entitlements } from '../src/services/entitlement.service.js';

let app: FastifyInstance | null = null;

export async function getApp(): Promise<FastifyInstance> {
  if (!app) {
    app = (await buildServer()) as unknown as FastifyInstance;
    await app.ready();
  }
  return app;
}

export async function closeApp(): Promise<void> {
  if (app) {
    await app.close();
    app = null;
  }
}

export const TEST_PASSWORD = 'TestPassw0rd!';

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

/** Creates an isolated user. Every test gets its own so they can run in any order. */
export async function createTestUser(
  overrides: {
    role?: 'USER' | 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN';
    status?: 'ACTIVE' | 'BANNED';
    language?: 'de' | 'en';
  } = {},
): Promise<TestUser> {
  const email = `test-${randomUUID()}@example.test`;
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(TEST_PASSWORD),
      emailVerifiedAt: new Date(),
      displayName: 'Test user',
      role: overrides.role ?? 'USER',
      status: overrides.status ?? 'ACTIVE',
      language: overrides.language ?? 'de',
      referralCode: generateReferralCode(10),
    },
  });
  return { id: user.id, email: user.email, password: TEST_PASSWORD };
}

export async function deleteTestUser(userId: string): Promise<void> {
  await prisma.user.deleteMany({ where: { id: userId } });
  await entitlements.invalidate(userId);
}

export async function login(
  instance: FastifyInstance,
  user: TestUser,
): Promise<{ accessToken: string; refreshToken: string }> {
  const response = await instance.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: user.email, password: user.password },
  });
  const body = response.json();
  return body.tokens;
}

export function authHeader(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

/** Grants a product entitlement directly, bypassing the payment flow. */
export async function grantProduct(userId: string, product: string, days = 30): Promise<void> {
  await prisma.entitlement.create({
    data: {
      userId,
      product: product as never,
      source: 'ADMIN_GRANT',
      expiresAt: new Date(Date.now() + days * 86_400_000),
    },
  });
  await entitlements.invalidate(userId);
}
