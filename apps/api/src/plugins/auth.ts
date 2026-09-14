import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { prisma } from '@storm-tips/database';
import {
  verifyAccessToken,
  can,
  hasRole,
  type Capability,
  type TokenConfig,
} from '@storm-tips/auth';
import { AppError, ErrorCode, type ProductCode, type UserRole } from '@storm-tips/types';
import { env } from '../lib/env.js';
import { entitlements } from '../services/entitlement.service.js';

export interface AuthContext {
  userId: string;
  email: string;
  role: UserRole;
  sessionFamily: string;
  language: string;
  timezone: string;
  currency: string;
  status: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
  interface FastifyInstance {
    tokenConfig: TokenConfig;
    authenticate: preHandlerHookHandler;
    optionalAuth: preHandlerHookHandler;
    requireRole(role: UserRole): preHandlerHookHandler;
    requireCapability(capability: Capability): preHandlerHookHandler;
    requireEntitlement(product: ProductCode): preHandlerHookHandler;
    requireInternal: preHandlerHookHandler;
  }
}

function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

async function resolveContext(request: FastifyRequest, config: TokenConfig): Promise<AuthContext> {
  const token = bearerToken(request);
  if (!token) throw AppError.unauthorized();

  const claims = await verifyAccessToken(token, config);

  // The token is only an assertion of identity — authorisation state is always
  // re-read from the database so bans and role changes take effect immediately.
  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      language: true,
      timezone: true,
      currency: true,
      deletedAt: true,
    },
  });

  if (!user || user.deletedAt) throw AppError.unauthorized('Account no longer exists');
  if (user.status === 'BANNED') {
    throw new AppError(ErrorCode.ACCOUNT_BANNED, 'This account has been suspended');
  }

  return {
    userId: user.id,
    email: user.email,
    role: user.role as UserRole,
    sessionFamily: claims.sid,
    language: user.language,
    timezone: user.timezone,
    currency: user.currency,
    status: user.status,
  };
}

export const authPlugin = fp(async function authPlugin(app: FastifyInstance) {
  const tokenConfig: TokenConfig = {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessTtl: env.JWT_ACCESS_TTL,
    refreshTtl: env.JWT_REFRESH_TTL,
    issuer: 'storm-tips',
    audience: 'storm-tips-api',
  };
  app.decorate('tokenConfig', tokenConfig);

  app.decorate('authenticate', async function authenticate(request) {
    request.auth = await resolveContext(request, tokenConfig);
  } satisfies preHandlerHookHandler);

  /** Populates `request.auth` when a valid token is present, but never rejects. */
  app.decorate('optionalAuth', async function optionalAuth(request) {
    if (!bearerToken(request)) return;
    try {
      request.auth = await resolveContext(request, tokenConfig);
    } catch {
      request.auth = undefined;
    }
  } satisfies preHandlerHookHandler);

  app.decorate('requireRole', function requireRole(role: UserRole): preHandlerHookHandler {
    return async function roleGuard(request) {
      if (!request.auth) request.auth = await resolveContext(request, tokenConfig);
      if (!hasRole(request.auth.role, role)) {
        throw AppError.forbidden(`This endpoint requires the ${role} role`);
      }
    };
  });

  app.decorate(
    'requireCapability',
    function requireCapability(capability: Capability): preHandlerHookHandler {
      return async function capabilityGuard(request) {
        if (!request.auth) request.auth = await resolveContext(request, tokenConfig);
        if (!can(request.auth.role, capability)) {
          throw AppError.forbidden(`Your role cannot perform "${capability}"`);
        }
      };
    },
  );

  app.decorate(
    'requireEntitlement',
    function requireEntitlement(product: ProductCode): preHandlerHookHandler {
      return async function entitlementGuard(request) {
        if (!request.auth) request.auth = await resolveContext(request, tokenConfig);
        await entitlements.require(request.auth.userId, product);
      };
    },
  );

  /** Shared-secret guard for worker → API calls. */
  app.decorate('requireInternal', async function requireInternal(request) {
    const token = request.headers['x-internal-token'];
    if (typeof token !== 'string' || token !== env.INTERNAL_API_TOKEN) {
      throw AppError.forbidden('Invalid internal token');
    }
  } satisfies preHandlerHookHandler);
});
