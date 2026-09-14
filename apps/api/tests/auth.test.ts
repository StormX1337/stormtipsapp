import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@profit-tips/database';
import {
  closeApp,
  createTestUser,
  deleteTestUser,
  getApp,
  login,
  TEST_PASSWORD,
} from './helpers.js';

const createdUsers: string[] = [];

afterAll(async () => {
  for (const id of createdUsers) await deleteTestUser(id);
  await closeApp();
});

describe('POST /auth/register', () => {
  it('creates an account and returns tokens', async () => {
    const app = await getApp();
    const email = `reg-${Date.now()}@example.test`;
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password: TEST_PASSWORD,
        displayName: 'New user',
        acceptedTerms: true,
        ageConfirmed: true,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.user.email).toBe(email);
    expect(body.user.referralCode).toBeTruthy();
    expect(body.tokens.accessToken).toBeTruthy();
    expect(body.tokens.tokenType).toBe('Bearer');
    // The password hash must never appear in a response.
    expect(JSON.stringify(body)).not.toContain('argon2');

    createdUsers.push(body.user.id);
  });

  it('rejects a weak password', async () => {
    const app = await getApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: `weak-${Date.now()}@example.test`,
        password: 'short',
        acceptedTerms: true,
        ageConfirmed: true,
      },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('requires terms and age confirmation', async () => {
    const app = await getApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: `terms-${Date.now()}@example.test`, password: TEST_PASSWORD },
    });
    expect(response.statusCode).toBe(422);
  });

  it('refuses a duplicate email', async () => {
    const app = await getApp();
    const user = await createTestUser();
    createdUsers.push(user.id);
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: user.email,
        password: TEST_PASSWORD,
        acceptedTerms: true,
        ageConfirmed: true,
      },
    });
    expect(response.statusCode).toBe(409);
  });
});

describe('POST /auth/login', () => {
  it('logs in with valid credentials', async () => {
    const app = await getApp();
    const user = await createTestUser();
    createdUsers.push(user.id);
    const tokens = await login(app, user);
    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).not.toBe(tokens.accessToken);
  });

  it('rejects a wrong password with the same message as an unknown address', async () => {
    const app = await getApp();
    const user = await createTestUser();
    createdUsers.push(user.id);

    const wrongPassword = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: user.email, password: 'Wrong!Password1' },
    });
    const unknownUser = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'nobody@example.test', password: 'Wrong!Password1' },
    });

    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownUser.statusCode).toBe(401);
    expect(wrongPassword.json().error.message).toBe(unknownUser.json().error.message);
  });

  it('blocks a banned account', async () => {
    const app = await getApp();
    const user = await createTestUser({ status: 'BANNED' });
    createdUsers.push(user.id);
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: user.email, password: user.password },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('ACCOUNT_BANNED');
  });
});

describe('POST /auth/refresh', () => {
  it('rotates the refresh token', async () => {
    const app = await getApp();
    const user = await createTestUser();
    createdUsers.push(user.id);
    const first = await login(app, user);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: first.refreshToken },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().tokens.refreshToken).not.toBe(first.refreshToken);
  });

  it('revokes the whole family when a rotated token is replayed', async () => {
    const app = await getApp();
    const user = await createTestUser();
    createdUsers.push(user.id);
    const first = await login(app, user);

    const rotated = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: first.refreshToken },
    });
    const second = rotated.json().tokens.refreshToken;

    // Replaying the consumed token is treated as a leak.
    const replay = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: first.refreshToken },
    });
    expect(replay.statusCode).toBe(401);
    expect(replay.json().error.code).toBe('TOKEN_REUSED');

    // …and the token issued from it no longer works either.
    const afterRevoke = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: second },
    });
    expect(afterRevoke.statusCode).toBe(401);
  });

  it('rejects an unknown refresh token', async () => {
    const app = await getApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: 'x'.repeat(64) },
    });
    expect(response.statusCode).toBe(401);
  });
});

describe('password reset', () => {
  it('answers identically for known and unknown addresses', async () => {
    const app = await getApp();
    const user = await createTestUser();
    createdUsers.push(user.id);

    const known = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: { email: user.email },
    });
    const unknown = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: { email: 'nobody@example.test' },
    });

    expect(known.statusCode).toBe(200);
    expect(unknown.statusCode).toBe(200);
    expect(known.body).toBe(unknown.body);
  });

  it('stores only a digest of the reset token', async () => {
    const app = await getApp();
    const user = await createTestUser();
    createdUsers.push(user.id);
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: { email: user.email },
    });

    const token = await prisma.verificationToken.findFirst({
      where: { userId: user.id, type: 'PASSWORD_RESET' },
    });
    expect(token?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('protected routes', () => {
  it('rejects a missing token', async () => {
    const app = await getApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/me' });
    expect(response.statusCode).toBe(401);
  });

  it('rejects a malformed token', async () => {
    const app = await getApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: 'Bearer not-a-jwt' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('returns the profile for a valid token', async () => {
    const app = await getApp();
    const user = await createTestUser();
    createdUsers.push(user.id);
    const tokens = await login(app, user);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().email).toBe(user.email);
  });
});
