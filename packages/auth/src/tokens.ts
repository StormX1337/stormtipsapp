import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { AppError, ErrorCode, type UserRole } from '@profit-tips/types';

export interface AccessTokenClaims extends JWTPayload {
  sub: string;
  role: UserRole;
  email: string;
  /** Session family — lets us revoke every token issued from one login. */
  sid: string;
}

/** The claims a caller supplies; `iat`/`exp`/`iss`/`aud` are set by the signer. */
export interface AccessTokenInput {
  sub: string;
  role: UserRole;
  email: string;
  sid: string;
}

export interface TokenConfig {
  accessSecret: string;
  refreshSecret: string;
  accessTtl: string;
  refreshTtl: string;
  issuer?: string;
  audience?: string;
}

const encoder = new TextEncoder();

/** Parses "15m" / "30d" / "3600" into seconds. */
export function parseDuration(value: string): number {
  const match = /^(\d+)\s*(ms|s|m|h|d|w)?$/i.exec(value.trim());
  if (!match) throw new Error(`Invalid duration: ${value}`);
  const amount = Number(match[1]);
  const unit = (match[2] ?? 's').toLowerCase();
  const factors: Record<string, number> = { ms: 0.001, s: 1, m: 60, h: 3600, d: 86400, w: 604800 };
  return Math.round(amount * (factors[unit] ?? 1));
}

export async function signAccessToken(
  claims: AccessTokenInput,
  config: TokenConfig,
): Promise<{ token: string; expiresIn: number }> {
  const expiresIn = parseDuration(config.accessTtl);
  const now = Math.floor(Date.now() / 1000);
  const builder = new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(now + expiresIn)
    .setSubject(claims.sub);
  if (config.issuer) builder.setIssuer(config.issuer);
  if (config.audience) builder.setAudience(config.audience);
  const token = await builder.sign(encoder.encode(config.accessSecret));
  return { token, expiresIn };
}

export async function verifyAccessToken(
  token: string,
  config: TokenConfig,
): Promise<AccessTokenClaims> {
  try {
    const { payload } = await jwtVerify(token, encoder.encode(config.accessSecret), {
      issuer: config.issuer,
      audience: config.audience,
      algorithms: ['HS256'],
    });
    return payload as AccessTokenClaims;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid token';
    if (message.includes('exp'))
      throw new AppError(ErrorCode.TOKEN_EXPIRED, 'Access token expired');
    throw new AppError(ErrorCode.UNAUTHORIZED, 'Invalid access token');
  }
}

/**
 * Refresh tokens are opaque random strings — never JWTs.
 * Only a SHA-256 digest is stored, so a database leak cannot be replayed.
 */
export function generateRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(48).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function safeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/** Single-use tokens for email verification and password reset. */
export function generateVerificationToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

/** Human-friendly referral code, e.g. "PT7K2M9Q". */
export function generateReferralCode(length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(length);
  let code = '';
  for (let index = 0; index < length; index += 1) {
    code += alphabet[(bytes[index] ?? 0) % alphabet.length];
  }
  return code;
}

export function refreshTokenExpiry(config: TokenConfig, from = new Date()): Date {
  return new Date(from.getTime() + parseDuration(config.refreshTtl) * 1000);
}
