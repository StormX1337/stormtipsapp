import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { AppError, ErrorCode } from '@profit-tips/types';

export interface OAuthProfile {
  provider: 'GOOGLE' | 'APPLE';
  providerUserId: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  avatarUrl: string | null;
}

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const GOOGLE_JWKS_URL = new URL('https://www.googleapis.com/oauth2/v3/certs');
const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URL = new URL('https://appleid.apple.com/auth/keys');

/** JWKS clients cache keys in-process and honour the cache headers Apple/Google send. */
const googleJwks = createRemoteJWKSet(GOOGLE_JWKS_URL, { cacheMaxAge: 10 * 60 * 1000 });
const appleJwks = createRemoteJWKSet(APPLE_JWKS_URL, { cacheMaxAge: 10 * 60 * 1000 });

interface GoogleIdTokenClaims extends JWTPayload {
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
}

interface AppleIdTokenClaims extends JWTPayload {
  email?: string;
  email_verified?: boolean | string;
  is_private_email?: boolean | string;
}

const asBool = (value: unknown): boolean => value === true || value === 'true';

/**
 * Verifies a Google ID token against Google's published JWKS.
 *
 * The signature, issuer, audience (our OAuth client id) and expiry are all
 * checked by `jwtVerify`; we never trust any field the client sends alongside.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  clientIds: string[],
): Promise<OAuthProfile> {
  if (clientIds.filter(Boolean).length === 0) {
    throw new AppError(ErrorCode.PROVIDER_ERROR, 'Google sign-in is not configured');
  }
  try {
    const { payload } = await jwtVerify<GoogleIdTokenClaims>(idToken, googleJwks, {
      issuer: GOOGLE_ISSUERS,
      audience: clientIds.filter(Boolean),
    });
    if (!payload.sub) throw new Error('missing subject');
    return {
      provider: 'GOOGLE',
      providerUserId: payload.sub,
      email: payload.email ?? null,
      emailVerified: asBool(payload.email_verified),
      name: payload.name ?? null,
      avatarUrl: payload.picture ?? null,
    };
  } catch (error) {
    throw new AppError(
      ErrorCode.UNAUTHORIZED,
      'Google ID token verification failed',
      process.env.NODE_ENV === 'development' ? { cause: String(error) } : undefined,
    );
  }
}

/**
 * Verifies an Apple ID token. Apple only returns the user's name on the very
 * first authorisation, so the caller may pass it in separately.
 */
export async function verifyAppleIdToken(
  idToken: string,
  clientIds: string[],
  fallbackName?: string,
): Promise<OAuthProfile> {
  if (clientIds.filter(Boolean).length === 0) {
    throw new AppError(ErrorCode.PROVIDER_ERROR, 'Apple sign-in is not configured');
  }
  try {
    const { payload } = await jwtVerify<AppleIdTokenClaims>(idToken, appleJwks, {
      issuer: APPLE_ISSUER,
      audience: clientIds.filter(Boolean),
    });
    if (!payload.sub) throw new Error('missing subject');
    return {
      provider: 'APPLE',
      providerUserId: payload.sub,
      email: payload.email ?? null,
      emailVerified: asBool(payload.email_verified),
      name: fallbackName ?? null,
      avatarUrl: null,
    };
  } catch (error) {
    throw new AppError(
      ErrorCode.UNAUTHORIZED,
      'Apple ID token verification failed',
      process.env.NODE_ENV === 'development' ? { cause: String(error) } : undefined,
    );
  }
}
