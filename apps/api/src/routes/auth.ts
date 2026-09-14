import type { FastifyInstance } from 'fastify';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  oauthSchema,
  refreshSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '@storm-tips/types';
import { prisma } from '@storm-tips/database';
import { parseBody } from '../lib/validate.js';
import { env } from '../lib/env.js';
import { noStore } from '../lib/http.js';
import { AuthService } from '../services/auth.service.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const auth = new AuthService(app.tokenConfig);

  /**
   * Credential endpoints get a much tighter bucket than the global default so
   * password guessing is expensive. The limit is configurable because test and
   * load environments legitimately exceed the production value.
   */
  const credentialLimit = {
    config: { rateLimit: { max: env.AUTH_RATE_LIMIT_MAX, timeWindow: '1 minute' } },
  };

  app.post('/register', credentialLimit, async (request, reply) => {
    const input = parseBody(request, registerSchema);
    const result = await auth.register(input, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
    noStore(reply).status(201);
    return result;
  });

  app.post('/login', credentialLimit, async (request, reply) => {
    const input = parseBody(request, loginSchema);
    const result = await auth.login(input, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      deviceName: input.deviceName,
    });
    noStore(reply);
    return result;
  });

  const refreshLimit = {
    config: { rateLimit: { max: env.AUTH_RATE_LIMIT_MAX * 6, timeWindow: '1 minute' } },
  };

  app.post('/refresh', refreshLimit, async (request, reply) => {
    const { refreshToken } = parseBody(request, refreshSchema);
    const result = await auth.refresh(refreshToken, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
    noStore(reply);
    return result;
  });

  app.post('/logout', { preHandler: [app.authenticate] }, async (request, reply) => {
    const input = parseBody(request, logoutSchema);
    await auth.logout(request.auth!.userId, input.refreshToken, input.allDevices);
    noStore(reply);
    return { success: true };
  });

  app.post('/oauth', credentialLimit, async (request, reply) => {
    const input = parseBody(request, oauthSchema);
    const result = await auth.oauth(input, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
    noStore(reply);
    return result;
  });

  app.post('/forgot-password', credentialLimit, async (request, reply) => {
    const { email } = parseBody(request, forgotPasswordSchema);
    await auth.requestPasswordReset(email);
    noStore(reply);
    // Always the same answer — never reveals whether the address is registered.
    return { success: true };
  });

  app.post('/reset-password', credentialLimit, async (request, reply) => {
    const { token, password } = parseBody(request, resetPasswordSchema);
    await auth.resetPassword(token, password);
    noStore(reply);
    return { success: true };
  });

  app.post('/change-password', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { currentPassword, newPassword } = parseBody(request, changePasswordSchema);
    await auth.changePassword(request.auth!.userId, currentPassword, newPassword);
    noStore(reply);
    return { success: true };
  });

  app.post('/verify-email', async (request, reply) => {
    const { token } = parseBody(request, verifyEmailSchema);
    await auth.verifyEmail(token);
    noStore(reply);
    return { success: true };
  });

  app.post('/resend-verification', credentialLimit, async (request, reply) => {
    const { email } = parseBody(request, resendVerificationSchema);
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, emailVerifiedAt: true },
    });
    if (user && !user.emailVerifiedAt) {
      await auth.sendVerificationEmail(user.id, user.email);
    }
    noStore(reply);
    return { success: true };
  });

  /** Active sessions, so a user can see and revoke their own devices. */
  app.get('/sessions', { preHandler: [app.authenticate] }, async (request, reply) => {
    const sessions = await prisma.session.findMany({
      where: { userId: request.auth!.userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        familyId: true,
        deviceName: true,
        ip: true,
        userAgent: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { lastUsedAt: 'desc' },
    });
    noStore(reply);
    return {
      items: sessions.map((session) => ({
        ...session,
        current: session.familyId === request.auth!.sessionFamily,
      })),
    };
  });

  app.delete('/sessions/:familyId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { familyId } = request.params as { familyId: string };
    await prisma.session.updateMany({
      where: { userId: request.auth!.userId, familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'USER_REVOKED' },
    });
    noStore(reply);
    return { success: true };
  });
}
