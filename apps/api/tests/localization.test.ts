import { afterAll, describe, expect, it } from 'vitest';
import { closeApp, createTestUser, getApp, login } from './helpers.js';

/**
 * The product ships English only.
 *
 * What is verified here is that the server says so consistently: editorial
 * content comes back in English whatever the request asks for, so a visitor
 * whose browser prefers another language still gets a complete page rather
 * than blank fields or a half-translated one.
 */
describe('content language', () => {
  it('serves the paywall in English', async () => {
    const app = await getApp();
    const body = (await app.inject({ method: 'GET', url: '/api/v1/billing/paywall/combo' })).json();

    expect(body.product.tagline).toBe('Curated accumulators');
    expect(body.product.benefits[0]).toBeTruthy();
    expect(body.legal.disclaimer).toMatch(/no outcome is guaranteed/i);
  });

  it('ignores Accept-Language rather than blanking the content', async () => {
    const app = await getApp();
    for (const header of ['de', 'de-AT', 'fr-FR,fr;q=0.9', 'en-GB', '*']) {
      const body = (
        await app.inject({
          method: 'GET',
          url: '/api/v1/billing/products',
          headers: { 'accept-language': header },
        })
      ).json();
      const combo = body.items.find((item: { code: string }) => item.code === 'COMBO');
      expect(combo.tagline, header).toBe('Curated accumulators');
      expect(combo.benefits.length, header).toBeGreaterThan(0);
    }
  });

  it("ignores an account's stored language too", async () => {
    const app = await getApp();
    const user = await createTestUser({ language: 'de' });
    const { accessToken } = await login(app, user);

    const body = (
      await app.inject({
        method: 'GET',
        url: '/api/v1/billing/paywall/combo',
        headers: { authorization: `Bearer ${accessToken}` },
      })
    ).json();
    expect(body.product.tagline).toBe('Curated accumulators');
  });

  it('serves market names and analyses in English', async () => {
    const app = await getApp();
    const feed = (
      await app.inject({ method: 'GET', url: '/api/v1/tips/free?includeSettled=true' })
    ).json();
    const first = feed.groups.flatMap((group: { tips: unknown[] }) => group.tips)[0] as
      { id: string } | undefined;
    if (!first) return;

    const tip = (await app.inject({ method: 'GET', url: `/api/v1/tips/${first.id}` })).json();
    expect(tip.marketName).toBeTruthy();
    // The generated analyses all open with one of the English phrase bank entries.
    if (tip.analysis) expect(tip.analysis).toMatch(/\b(the|our|recent|expected|head-to-head)\b/i);
  });
});

afterAll(closeApp);
