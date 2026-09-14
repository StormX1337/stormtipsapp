import { describe, expect, it } from 'vitest';
import { hashPassword, needsRehash, passwordStrength, verifyPassword } from '../src/password.js';
import {
  generateReferralCode,
  generateRefreshToken,
  hashToken,
  parseDuration,
  safeCompare,
  signAccessToken,
  verifyAccessToken,
  type TokenConfig,
} from '../src/tokens.js';
import { decryptSecret, encryptSecret, isEncrypted, maskSecret } from '../src/crypto.js';
import { can, hasRole, isAdmin } from '../src/permissions.js';

const config: TokenConfig = {
  accessSecret: 'a'.repeat(48),
  refreshSecret: 'b'.repeat(48),
  accessTtl: '15m',
  refreshTtl: '30d',
  issuer: 'storm-tips',
  audience: 'storm-tips-api',
};

describe('password hashing', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('Sup3rSecret!Pass');
    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(verifyPassword(hash, 'Sup3rSecret!Pass')).resolves.toBe(true);
    await expect(verifyPassword(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('never stores the plaintext', async () => {
    const hash = await hashPassword('Sup3rSecret!Pass');
    expect(hash).not.toContain('Sup3rSecret');
  });

  it('returns false instead of throwing on a malformed hash', async () => {
    await expect(verifyPassword('not-a-hash', 'x')).resolves.toBe(false);
    await expect(verifyPassword('', 'x')).resolves.toBe(false);
  });

  it('flags weak parameters for rehashing', async () => {
    expect(needsRehash('$argon2id$v=19$m=4096,t=1,p=1$abc$def')).toBe(true);
    expect(needsRehash(await hashPassword('Sup3rSecret!Pass'))).toBe(false);
  });

  it('scores password strength', () => {
    expect(passwordStrength('short')).toBe(0);
    expect(passwordStrength('LongEnough1!x')).toBeGreaterThanOrEqual(3);
  });
});

describe('tokens', () => {
  it('parses durations', () => {
    expect(parseDuration('15m')).toBe(900);
    expect(parseDuration('30d')).toBe(2_592_000);
    expect(parseDuration('45')).toBe(45);
    expect(() => parseDuration('nope')).toThrow();
  });

  it('signs and verifies an access token', async () => {
    const { token, expiresIn } = await signAccessToken(
      { sub: 'user-1', role: 'USER', email: 'a@b.c', sid: 'family-1' },
      config,
    );
    expect(expiresIn).toBe(900);
    const claims = await verifyAccessToken(token, config);
    expect(claims.sub).toBe('user-1');
    expect(claims.role).toBe('USER');
    expect(claims.sid).toBe('family-1');
  });

  it('rejects a token signed with a different secret', async () => {
    const { token } = await signAccessToken(
      { sub: 'user-1', role: 'USER', email: 'a@b.c', sid: 'f' },
      config,
    );
    await expect(
      verifyAccessToken(token, { ...config, accessSecret: 'c'.repeat(48) }),
    ).rejects.toThrow(/Invalid access token/);
  });

  it('rejects an expired token', async () => {
    const { token } = await signAccessToken(
      { sub: 'user-1', role: 'USER', email: 'a@b.c', sid: 'f' },
      { ...config, accessTtl: '1s' },
    );
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await expect(verifyAccessToken(token, config)).rejects.toThrow();
  });

  it('generates opaque refresh tokens that are stored only as a digest', () => {
    const { token, hash } = generateRefreshToken();
    expect(token).not.toEqual(hash);
    expect(hash).toHaveLength(64);
    expect(hashToken(token)).toBe(hash);
  });

  it('compares strings in constant time', () => {
    expect(safeCompare('abc', 'abc')).toBe(true);
    expect(safeCompare('abc', 'abd')).toBe(false);
    expect(safeCompare('abc', 'abcd')).toBe(false);
  });

  it('generates unambiguous referral codes', () => {
    const code = generateReferralCode();
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]+$/);
  });
});

describe('secret encryption', () => {
  const key = 'f'.repeat(64);

  it('round-trips a secret', () => {
    const encrypted = encryptSecret('super-secret-api-key', key);
    expect(encrypted).not.toContain('super-secret');
    expect(isEncrypted(encrypted)).toBe(true);
    expect(decryptSecret(encrypted, key)).toBe('super-secret-api-key');
  });

  it('produces a different ciphertext each time', () => {
    expect(encryptSecret('x', key)).not.toBe(encryptSecret('x', key));
  });

  it('fails when the key is wrong', () => {
    const encrypted = encryptSecret('x', key);
    expect(() => decryptSecret(encrypted, '0'.repeat(64))).toThrow();
  });

  it('rejects a malformed key', () => {
    expect(() => encryptSecret('x', 'too-short')).toThrow(/64 hexadecimal/);
  });

  it('masks a secret for display', () => {
    expect(maskSecret('sk_live_1234567890abcd')).toBe('sk_l••••••••abcd');
  });
});

describe('permissions', () => {
  it('ranks roles', () => {
    expect(hasRole('ADMIN', 'MODERATOR')).toBe(true);
    expect(hasRole('MODERATOR', 'ADMIN')).toBe(false);
    expect(isAdmin('SUPER_ADMIN')).toBe(true);
  });

  it('gates capabilities by role', () => {
    expect(can('MODERATOR', 'tips:write')).toBe(true);
    expect(can('MODERATOR', 'tips:settle')).toBe(false);
    expect(can('ADMIN', 'tips:settle')).toBe(true);
    expect(can('ADMIN', 'users:role')).toBe(false);
    expect(can('SUPER_ADMIN', 'users:role')).toBe(true);
  });
});
