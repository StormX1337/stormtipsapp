import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@profit-tips/database';
import {
  authHeader,
  closeApp,
  createTestUser,
  deleteTestUser,
  getApp,
  login,
} from './helpers.js';

const createdUsers: string[] = [];
const createdCoupons: string[] = [];

afterAll(async () => {
  await prisma.couponRedemption.deleteMany({ where: { couponId: { in: createdCoupons } } });
  await prisma.coupon.deleteMany({ where: { id: { in: createdCoupons } } });
  for (const id of createdUsers) await deleteTestUser(id);
  await closeApp();
});

describe('health', () => {
  it('reports liveness', async () => {
    const app = await getApp();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('ok');
  });

  it('reports readiness with dependency checks', async () => {
    const app = await getApp();
    const response = await app.inject({ method: 'GET', url: '/ready' });
    expect(response.json().checks).toEqual({ database: true, redis: true });
  });

  it('exposes an OpenAPI document', async () => {
    const app = await getApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/openapi.json' });
    const document = response.json();
    expect(document.openapi).toBe('3.1.0');
    expect(Object.keys(document.paths).length).toBeGreaterThan(20);
  });

  it('returns a structured 404 with a request id', async () => {
    const app = await getApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/does-not-exist' });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
    expect(response.json().error.requestId).toBeTruthy();
  });

  it('echoes the request id header', async () => {
    const app = await getApp();
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'my-trace-id' },
    });
    expect(response.headers['x-request-id']).toBe('my-trace-id');
  });
});

describe('statistics', () => {
  it('computes figures from settled tips only', async () => {
    const app = await getApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/statistics?product=COMBO&window=ALL',
    });
    const stats = response.json();

    expect(stats.settledTips).toBeGreaterThan(0);
    expect(stats.won + stats.lost + stats.void + stats.halfWon + stats.halfLost).toBe(
      stats.settledTips,
    );
    expect(stats.winRate).toBeGreaterThan(0);
    expect(stats.avgOdds).toBeGreaterThan(1);
    expect(stats.byDay.length).toBeGreaterThan(0);
    // The cumulative series must end at the reported profit.
    const last = stats.byDay[stats.byDay.length - 1];
    expect(last.cumulativeProfit).toBeCloseTo(stats.profit, 1);
  });

  it('reflects the window in the covered day count', async () => {
    const app = await getApp();
    const week = await app.inject({ method: 'GET', url: '/api/v1/statistics?window=D7' });
    const month = await app.inject({ method: 'GET', url: '/api/v1/statistics?window=D30' });
    expect(week.json().days).toBe(7);
    expect(month.json().days).toBe(30);
    expect(month.json().settledTips).toBeGreaterThanOrEqual(week.json().settledTips);
  });

  it('returns a per-product overview', async () => {
    const app = await getApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/statistics/overview' });
    const products = response.json().items.map((item: { product: string }) => item.product);
    expect(products).toContain('VIP');
    expect(products).toContain('COMBO');
  });

  it('rejects an unknown window', async () => {
    const app = await getApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/statistics?window=NOPE' });
    expect(response.statusCode).toBe(422);
  });
});

describe('plans and paywall', () => {
  it('computes per-month price and savings from the stored plan rows', async () => {
    const app = await getApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/billing/plans' });
    const plans = response.json().items;

    const threeMonths = plans.find((plan: { slug: string }) => plan.slug === 'combo-3m');
    expect(threeMonths.price.amountCents).toBe(7999);
    expect(threeMonths.pricePerMonth.amountCents).toBe(2666);
    expect(threeMonths.savings.amountCents).toBeGreaterThan(0);

    const bundle = plans.find((plan: { slug: string }) => plan.slug === 'bundle-1m');
    expect(bundle.badge).toBe('MOST_POPULAR');
    expect(bundle.products).toEqual(expect.arrayContaining(['COMBO', 'VIP', 'EXTRA']));
  });

  it('returns a complete paywall payload with verified statistics', async () => {
    const app = await getApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/billing/paywall/combo' });
    const body = response.json();

    expect(body.product.code).toBe('COMBO');
    expect(body.plans.length).toBeGreaterThan(0);
    expect(body.statistics.successfulAnalyses).toBeGreaterThan(0);
    expect(body.statistics.days).toBeGreaterThan(0);
    expect(body.unlocked).toBe(false);
    // Compliance: the paywall must carry the age notice and disclaimer.
    expect(body.legal.minimumAge).toBe(18);
    expect(body.legal.disclaimer).toMatch(/garantiert/i);
  });

  it('404s for an unknown product', async () => {
    const app = await getApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/billing/paywall/nope' });
    expect(response.statusCode).toBe(404);
  });
});

describe('coupons', () => {
  it('validates a percentage coupon and computes the final price', async () => {
    const app = await getApp();
    const user = await createTestUser();
    createdUsers.push(user.id);
    const tokens = await login(app, user);

    const coupon = await prisma.coupon.create({
      data: { code: `TEST${Date.now()}`, discountType: 'PERCENTAGE', discountValue: 25 },
    });
    createdCoupons.push(coupon.id);
    const plan = await prisma.subscriptionPlan.findFirstOrThrow({ where: { slug: 'combo-1m' } });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/coupons/validate',
      headers: authHeader(tokens.accessToken),
      payload: { code: coupon.code, planId: plan.id },
    });

    const body = response.json();
    expect(body.valid).toBe(true);
    expect(body.discountCents).toBe(Math.round(plan.priceCents * 0.25));
    expect(body.finalPriceCents).toBe(plan.priceCents - body.discountCents);
  });

  it('rejects an expired coupon with a reason', async () => {
    const app = await getApp();
    const user = await createTestUser();
    createdUsers.push(user.id);
    const tokens = await login(app, user);

    const coupon = await prisma.coupon.create({
      data: {
        code: `EXPIRED${Date.now()}`,
        discountType: 'PERCENTAGE',
        discountValue: 25,
        validUntil: new Date(Date.now() - 86_400_000),
      },
    });
    createdCoupons.push(coupon.id);
    const plan = await prisma.subscriptionPlan.findFirstOrThrow({ where: { slug: 'combo-1m' } });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/coupons/validate',
      headers: authHeader(tokens.accessToken),
      payload: { code: coupon.code, planId: plan.id },
    });
    expect(response.json().valid).toBe(false);
    expect(response.json().reason).toMatch(/expired/i);
  });

  it('requires authentication', async () => {
    const app = await getApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/coupons/validate',
      payload: { code: 'ANY' },
    });
    expect(response.statusCode).toBe(401);
  });
});

describe('polls', () => {
  it('lists polls with tallies', async () => {
    const app = await getApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/polls' });
    const body = response.json();
    expect(body.items.length).toBeGreaterThan(0);
    const poll = body.items[0];
    expect(poll.options.length).toBeGreaterThanOrEqual(2);
    expect(poll.hasVoted).toBe(false);
  });

  it('records a vote once and rejects a second', async () => {
    const app = await getApp();
    const user = await createTestUser();
    createdUsers.push(user.id);
    const tokens = await login(app, user);

    const poll = await prisma.poll.findFirstOrThrow({
      where: { status: 'ACTIVE', allowMultiple: false },
      include: { options: true },
    });
    const optionId = poll.options[0]!.id;
    const before = poll.options[0]!.voteCount;

    const first = await app.inject({
      method: 'POST',
      url: `/api/v1/polls/${poll.id}/vote`,
      headers: authHeader(tokens.accessToken),
      payload: { optionIds: [optionId] },
    });
    expect(first.statusCode).toBe(201);
    expect(first.json().hasVoted).toBe(true);

    const second = await app.inject({
      method: 'POST',
      url: `/api/v1/polls/${poll.id}/vote`,
      headers: authHeader(tokens.accessToken),
      payload: { optionIds: [optionId] },
    });
    expect(second.statusCode).toBe(409);

    const option = await prisma.pollOption.findUniqueOrThrow({ where: { id: optionId } });
    expect(option.voteCount).toBe(before + 1);
  });

  it('rejects an option from a different poll', async () => {
    const app = await getApp();
    const user = await createTestUser();
    createdUsers.push(user.id);
    const tokens = await login(app, user);

    const [pollA, pollB] = await prisma.poll.findMany({
      where: { status: 'ACTIVE' },
      include: { options: true },
      take: 2,
    });
    if (!pollA || !pollB) return;

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/polls/${pollA.id}/vote`,
      headers: authHeader(tokens.accessToken),
      payload: { optionIds: [pollB.options[0]!.id] },
    });
    expect(response.statusCode).toBe(422);
  });

  it('requires authentication to vote', async () => {
    const app = await getApp();
    const poll = await prisma.poll.findFirstOrThrow({ where: { status: 'ACTIVE' } });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/polls/${poll.id}/vote`,
      payload: { optionIds: ['x'] },
    });
    expect(response.statusCode).toBe(401);
  });
});

describe('catalogue', () => {
  it('lists sports and leagues', async () => {
    const app = await getApp();
    const sports = await app.inject({ method: 'GET', url: '/api/v1/sports' });
    expect(sports.json().items.length).toBeGreaterThan(0);

    const leagues = await app.inject({ method: 'GET', url: '/api/v1/leagues' });
    expect(leagues.json().items[0].country).toBeTruthy();
  });

  it('paginates events and clamps the page size', async () => {
    const app = await getApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/events?limit=5&page=2' });
    const body = response.json();
    expect(body.items.length).toBeLessThanOrEqual(5);
    expect(body.page).toBe(2);
    expect(body.total).toBeGreaterThan(0);
  });

  it('rejects an out-of-range page size', async () => {
    const app = await getApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/events?limit=5000' });
    expect(response.statusCode).toBe(422);
  });
});

describe('analytics', () => {
  it('accepts a batch of pseudonymous events', async () => {
    const app = await getApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/analytics/batch',
      payload: {
        events: [
          { name: 'app_open', anonymousId: 'anon-1', platform: 'ios' },
          { name: 'paywall_view', properties: { product: 'COMBO' }, anonymousId: 'anon-1' },
        ],
      },
    });
    expect(response.statusCode).toBe(202);
    expect(response.json().accepted).toBe(2);
  });

  it('rejects an unknown event name', async () => {
    const app = await getApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/analytics/events',
      payload: { name: 'not_a_real_event' },
    });
    expect(response.statusCode).toBe(422);
  });
});
