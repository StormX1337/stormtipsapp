import { prisma, type Prisma } from '@profit-tips/database';
import {
  generateReferralCode,
  generateRefreshToken,
  generateVerificationToken,
  hashPassword,
  hashToken,
  needsRehash,
  refreshTokenExpiry,
  signAccessToken,
  verifyAppleIdToken,
  verifyGoogleIdToken,
  verifyPassword,
  type TokenConfig,
} from '@profit-tips/auth';
import {
  AppError,
  ErrorCode,
  type AuthResponseDTO,
  type AuthTokensDTO,
  type LoginInput,
  type OAuthInput,
  type RegisterInput,
  type UserRole,
} from '@profit-tips/types';
import { randomUUID } from 'node:crypto';
import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';
import { passwordResetEmail, sendMail, verificationEmail } from '../lib/mailer.js';
import { serializeUser } from '../serializers/user.js';
import { entitlements } from './entitlement.service.js';

const VERIFICATION_TTL_MS = 24 * 3_600_000;
const RESET_TTL_MS = 60 * 60_000;

export interface SessionMeta {
  ip?: string | null;
  userAgent?: string | null;
  deviceName?: string | null;
}

export class AuthService {
  constructor(private readonly tokenConfig: TokenConfig) {}

  /** Issues an access token plus a fresh refresh token in a (possibly new) family. */
  private async issueTokens(
    user: { id: string; email: string; role: UserRole },
    meta: SessionMeta,
    familyId = randomUUID(),
  ): Promise<AuthTokensDTO> {
    const refresh = generateRefreshToken();
    const { token: accessToken, expiresIn } = await signAccessToken(
      { sub: user.id, email: user.email, role: user.role, sid: familyId },
      this.tokenConfig,
    );

    await prisma.session.create({
      data: {
        userId: user.id,
        familyId,
        refreshTokenHash: refresh.hash,
        ip: meta.ip ?? null,
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
        deviceName: meta.deviceName ?? null,
        expiresAt: refreshTokenExpiry(this.tokenConfig),
      },
    });

    return { accessToken, refreshToken: refresh.token, expiresIn, tokenType: 'Bearer' };
  }

  private async buildResponse(userId: string, tokens: AuthTokensDTO): Promise<AuthResponseDTO> {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { user: serializeUser(user, await entitlements.summary(userId)), tokens };
  }

  private async uniqueReferralCode(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = generateReferralCode();
      const existing = await prisma.user.findUnique({
        where: { referralCode: code },
        select: { id: true },
      });
      if (!existing) return code;
    }
    return generateReferralCode(12);
  }

  private async attachReferral(refereeId: string, referralCode?: string): Promise<void> {
    if (!referralCode) return;
    const referrer = await prisma.user.findUnique({
      where: { referralCode: referralCode.toUpperCase() },
      select: { id: true },
    });
    if (!referrer || referrer.id === refereeId) return;
    await prisma.$transaction([
      prisma.user.update({ where: { id: refereeId }, data: { referredById: referrer.id } }),
      prisma.referral.create({
        data: {
          code: referralCode.toUpperCase(),
          referrerId: referrer.id,
          refereeId,
          status: 'PENDING',
        },
      }),
    ]);
  }

  async register(input: RegisterInput, meta: SessionMeta): Promise<AuthResponseDTO> {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) {
      throw AppError.conflict('An account with this email address already exists');
    }

    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash: await hashPassword(input.password),
        displayName: input.displayName ?? input.email.split('@')[0],
        language: input.language ?? env.DEFAULT_LOCALE,
        timezone: input.timezone ?? env.DEFAULT_TIMEZONE,
        currency: env.DEFAULT_CURRENCY,
        countryCode: input.countryCode ?? null,
        marketingOptIn: input.marketingOptIn,
        referralCode: await this.uniqueReferralCode(),
        status: 'PENDING_VERIFICATION',
      },
    });

    await this.attachReferral(user.id, input.referralCode);
    await this.sendVerificationEmail(user.id, user.email);

    const tokens = await this.issueTokens(
      { id: user.id, email: user.email, role: user.role as UserRole },
      meta,
    );
    return this.buildResponse(user.id, tokens);
  }

  async login(input: LoginInput, meta: SessionMeta): Promise<AuthResponseDTO> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });

    // Same error and comparable timing whether the address exists or not.
    if (!user?.passwordHash) {
      await verifyPassword(
        '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$0000000000000000000000000000000000000000000',
        input.password,
      );
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, 'Email or password is incorrect');
    }
    if (user.deletedAt) {
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, 'Email or password is incorrect');
    }
    if (!(await verifyPassword(user.passwordHash, input.password))) {
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, 'Email or password is incorrect');
    }
    if (user.status === 'BANNED') {
      throw new AppError(ErrorCode.ACCOUNT_BANNED, 'This account has been suspended');
    }

    // Opportunistic upgrade when the KDF parameters have been strengthened.
    if (needsRehash(user.passwordHash)) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(input.password) },
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: meta.ip ?? null },
    });

    const tokens = await this.issueTokens(
      { id: user.id, email: user.email, role: user.role as UserRole },
      meta,
    );
    return this.buildResponse(user.id, tokens);
  }

  /**
   * Rotates a refresh token.
   *
   * Reuse detection: presenting an already-rotated (revoked) token means the
   * token leaked, so the whole family is revoked and the caller must log in again.
   */
  async refresh(refreshToken: string, meta: SessionMeta): Promise<AuthResponseDTO> {
    const tokenHash = hashToken(refreshToken);
    const session = await prisma.session.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: { user: true },
    });

    if (!session) throw new AppError(ErrorCode.UNAUTHORIZED, 'Invalid refresh token');

    if (session.revokedAt) {
      await prisma.session.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'REUSE_DETECTED' },
      });
      logger.warn(
        { userId: session.userId, familyId: session.familyId },
        'refresh token reuse detected — session family revoked',
      );
      throw new AppError(
        ErrorCode.TOKEN_REUSED,
        'This session has been revoked for security reasons. Please log in again.',
      );
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new AppError(ErrorCode.TOKEN_EXPIRED, 'Refresh token expired');
    }
    if (session.user.status === 'BANNED' || session.user.deletedAt) {
      throw new AppError(ErrorCode.ACCOUNT_BANNED, 'This account has been suspended');
    }

    const next = generateRefreshToken();
    const { token: accessToken, expiresIn } = await signAccessToken(
      {
        sub: session.userId,
        email: session.user.email,
        role: session.user.role as UserRole,
        sid: session.familyId,
      },
      this.tokenConfig,
    );

    await prisma.$transaction([
      prisma.session.update({
        where: { id: session.id },
        data: {
          revokedAt: new Date(),
          revokedReason: 'ROTATED',
          replacedByHash: next.hash,
          lastUsedAt: new Date(),
        },
      }),
      prisma.session.create({
        data: {
          userId: session.userId,
          familyId: session.familyId,
          refreshTokenHash: next.hash,
          ip: meta.ip ?? null,
          userAgent: meta.userAgent?.slice(0, 300) ?? null,
          deviceName: session.deviceName,
          expiresAt: refreshTokenExpiry(this.tokenConfig),
        },
      }),
    ]);

    return this.buildResponse(session.userId, {
      accessToken,
      refreshToken: next.token,
      expiresIn,
      tokenType: 'Bearer',
    });
  }

  async logout(userId: string, refreshToken?: string, allDevices = false): Promise<void> {
    if (allDevices) {
      await prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'LOGOUT_ALL' },
      });
      return;
    }
    if (!refreshToken) return;
    const session = await prisma.session.findUnique({
      where: { refreshTokenHash: hashToken(refreshToken) },
      select: { id: true, userId: true, familyId: true },
    });
    if (!session || session.userId !== userId) return;
    await prisma.session.updateMany({
      where: { familyId: session.familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'LOGOUT' },
    });
  }

  async sendVerificationEmail(userId: string, email: string): Promise<void> {
    const { token, hash } = generateVerificationToken();
    await prisma.verificationToken.create({
      data: {
        userId,
        type: 'EMAIL_VERIFICATION',
        tokenHash: hash,
        expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
      },
    });
    await sendMail({ to: email, ...verificationEmail(token) });
  }

  async verifyEmail(token: string): Promise<void> {
    const record = await prisma.verificationToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!record || record.type !== 'EMAIL_VERIFICATION' || record.usedAt) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'This verification link is no longer valid');
    }
    if (record.expiresAt.getTime() <= Date.now()) {
      throw new AppError(ErrorCode.TOKEN_EXPIRED, 'This verification link has expired');
    }
    await prisma.$transaction([
      prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date(), status: 'ACTIVE' },
      }),
    ]);
  }

  /** Always resolves — never reveals whether an address is registered. */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });
    if (!user) return;

    const { token, hash } = generateVerificationToken();
    await prisma.verificationToken.create({
      data: {
        userId: user.id,
        type: 'PASSWORD_RESET',
        tokenHash: hash,
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      },
    });
    await sendMail({ to: user.email, ...passwordResetEmail(token) });
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const record = await prisma.verificationToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!record || record.type !== 'PASSWORD_RESET' || record.usedAt) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'This reset link is no longer valid');
    }
    if (record.expiresAt.getTime() <= Date.now()) {
      throw new AppError(ErrorCode.TOKEN_EXPIRED, 'This reset link has expired');
    }

    // Changing the password invalidates every existing session.
    await prisma.$transaction([
      prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: await hashPassword(password) },
      }),
      prisma.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'PASSWORD_RESET' },
      }),
    ]);
  }

  async changePassword(userId: string, current: string, next: string): Promise<void> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user.passwordHash || !(await verifyPassword(user.passwordHash, current))) {
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, 'Current password is incorrect');
    }
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { passwordHash: await hashPassword(next) },
      }),
      prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'PASSWORD_CHANGED' },
      }),
    ]);
  }

  /** Verifies a Google/Apple ID token server-side, then links or creates the account. */
  async oauth(input: OAuthInput, meta: SessionMeta): Promise<AuthResponseDTO> {
    const profile =
      input.provider === 'google'
        ? await verifyGoogleIdToken(input.idToken, [env.GOOGLE_OAUTH_CLIENT_ID ?? ''])
        : await verifyAppleIdToken(
            input.idToken,
            [env.APPLE_OAUTH_CLIENT_ID ?? ''],
            input.fullName,
          );

    const providerField = profile.provider === 'GOOGLE' ? 'googleId' : 'appleId';
    let user = await prisma.user.findFirst({
      where: { [providerField]: profile.providerUserId } as Prisma.UserWhereInput,
    });

    if (!user && profile.email) {
      user = await prisma.user.findUnique({ where: { email: profile.email.toLowerCase() } });
      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            [providerField]: profile.providerUserId,
            authProviders: { set: [...new Set([...user.authProviders, profile.provider])] },
            emailVerifiedAt: user.emailVerifiedAt ?? (profile.emailVerified ? new Date() : null),
          } as Prisma.UserUpdateInput,
        });
      }
    }

    if (!user) {
      if (!profile.email) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'This provider did not share an email address, which is required to create an account',
        );
      }
      user = await prisma.user.create({
        data: {
          email: profile.email.toLowerCase(),
          displayName: profile.name ?? profile.email.split('@')[0],
          avatarUrl: profile.avatarUrl,
          emailVerifiedAt: profile.emailVerified ? new Date() : null,
          status: profile.emailVerified ? 'ACTIVE' : 'PENDING_VERIFICATION',
          language: env.DEFAULT_LOCALE,
          timezone: env.DEFAULT_TIMEZONE,
          currency: env.DEFAULT_CURRENCY,
          authProviders: [profile.provider],
          referralCode: await this.uniqueReferralCode(),
          [providerField]: profile.providerUserId,
        } as Prisma.UserCreateInput,
      });
      await this.attachReferral(user.id, input.referralCode);
    }

    if (user.status === 'BANNED') {
      throw new AppError(ErrorCode.ACCOUNT_BANNED, 'This account has been suspended');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: meta.ip ?? null },
    });

    const tokens = await this.issueTokens(
      { id: user.id, email: user.email, role: user.role as UserRole },
      meta,
    );
    return this.buildResponse(user.id, tokens);
  }
}
