import { afterAll, describe, expect, it } from 'vitest';
import { closeApp, createTestUser, getApp, login } from './helpers.js';

/**
 * End-to-end language behaviour.
 *
 * The interface strings are translated by the clients; what is verified here is
 * the part only the server can do — returning editorial content (products,
 * plans, promotions, market names, analyses) in the requested language, and
 * never blanking a field that has no translation.
 */
describe('content localisation', () => {
  it('returns the paywall in the requested language', async () => {
    const app = await getApp();

    const german = (
      await app.inject({
        method: 'GET',
        url: '/api/v1/billing/paywall/combo',
        headers: { 'accept-language': 'de' },
      })
    ).json();
    const english = (
      await app.inject({
        method: 'GET',
        url: '/api/v1/billing/paywall/combo',
        headers: { 'accept-language': 'en' },
      })
    ).json();

    expect(german.product.tagline).toBe('Kuratierte Kombiwetten');
    expect(english.product.tagline).toBe('Curated accumulators');
    expect(english.product.benefits[0]).not.toBe(german.product.benefits[0]);
    expect(english.legal.disclaimer).toMatch(/no outcome is guaranteed/i);
    expect(german.legal.disclaimer).toMatch(/garantiert/i);

    // Prices are the same number, formatted for the locale.
    expect(english.plans[0].price.amountCents).toBe(german.plans[0].price.amountCents);
  });

  it('honours a regional tag and the quality-ordered header', async () => {
    const app = await getApp();
    for (const header of ['en-GB', 'en-US,en;q=0.9', 'fr-FR,en;q=0.8']) {
      const body = (
        await app.inject({
          method: 'GET',
          url: '/api/v1/billing/products',
          headers: { 'accept-language': header },
        })
      ).json();
      const combo = body.items.find((item: { code: string }) => item.code === 'COMBO');
      expect(combo.tagline, header).toBe('Curated accumulators');
    }
  });

  it('falls back to the default language for one we do not ship', async () => {
    const app = await getApp();
    const body = (
      await app.inject({
        method: 'GET',
        url: '/api/v1/billing/products',
        headers: { 'accept-language': 'fr-FR,fr;q=0.9' },
      })
    ).json();
    const combo = body.items.find((item: { code: string }) => item.code === 'COMBO');
    expect(combo.tagline).toBe('Kuratierte Kombiwetten');
  });

  it('lets an explicit ?locale override the header', async () => {
    const app = await getApp();
    const body = (
      await app.inject({
        method: 'GET',
        url: '/api/v1/billing/products?locale=en',
        headers: { 'accept-language': 'de' },
      })
    ).json();
    const combo = body.items.find((item: { code: string }) => item.code === 'COMBO');
    expect(combo.tagline).toBe('Curated accumulators');
  });

  it("prefers a signed-in user's stored language when the request does not ask", async () => {
    const app = await getApp();
    const user = await createTestUser({ language: 'en' });
    const { accessToken } = await login(app, user);

    const authenticated = (
      await app.inject({
        method: 'GET',
        url: '/api/v1/billing/paywall/combo',
        headers: { authorization: `Bearer ${accessToken}` },
      })
    ).json();
    expect(authenticated.product.tagline).toBe('Curated accumulators');

    // An explicit request still wins, so a switcher works before the profile
    // has been saved.
    const overridden = (
      await app.inject({
        method: 'GET',
        url: '/api/v1/billing/paywall/combo?locale=de',
        headers: { authorization: `Bearer ${accessToken}` },
      })
    ).json();
    expect(overridden.product.tagline).toBe('Kuratierte Kombiwetten');
  });

  it('translates market names and analyses on a tip', async () => {
    const app = await getApp();
    const feed = (
      await app.inject({ method: 'GET', url: '/api/v1/tips/free?includeSettled=true' })
    ).json();
    const tip = feed.groups.flatMap((group: { tips: unknown[] }) => group.tips)[0] as
      { id: string } | undefined;
    if (!tip) return;

    const german = (
      await app.inject({
        method: 'GET',
        url: `/api/v1/tips/${tip.id}`,
        headers: { 'accept-language': 'de' },
      })
    ).json();
    const english = (
      await app.inject({
        method: 'GET',
        url: `/api/v1/tips/${tip.id}`,
        headers: { 'accept-language': 'en' },
      })
    ).json();

    expect(english.marketName).not.toBe(german.marketName);
    expect(german.analysis).not.toBe(english.analysis);
    // The selection label is betting terminology and stays identical.
    expect(english.selectionLabel).toBe(german.selectionLabel);
  });

  it('never blanks a field that has no translation', async () => {
    const app = await getApp();
    const body = (
      await app.inject({
        method: 'GET',
        url: '/api/v1/billing/plans',
        headers: { 'accept-language': 'en' },
      })
    ).json();

    for (const plan of body.items) {
      expect(plan.name, plan.slug).not.toBe('');
      expect(typeof plan.name, plan.slug).toBe('string');
    }
  });

  it('does not expose the translation bundle on public responses', async () => {
    const app = await getApp();
    const body = (await app.inject({ method: 'GET', url: '/api/v1/billing/plans' })).json();
    for (const plan of body.items) {
      expect(plan.translations, plan.slug).toBeUndefined();
    }
  });
});

afterAll(async () => {
  await closeApp();
});
