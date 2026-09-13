/* eslint-disable no-console */
/**
 * Development seed.
 *
 * Produces a complete, self-consistent dataset so that every screen of the
 * product has realistic content on a fresh machine: catalogue, fixtures, odds,
 * ~6 months of settled tips (settled by the real settlement engine), combos,
 * plans, subscribers, polls and referrals.
 *
 * The historical sample is intentionally shaped — see WIN_RATES — so the
 * dashboards have a plausible curve. That bias exists ONLY here; the running
 * application never generates results, it only settles real fixtures.
 *
 * Refuses to run against NODE_ENV=production.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { MockProvider, CATALOGUE_BOOKMAKERS, CATALOGUE_COUNTRIES, CATALOGUE_LEAGUES, CATALOGUE_SPORTS } from '@profit-tips/sports';
import { profitFor, returnFactor, settleCombo } from '@profit-tips/statistics';
import { generateReferralCode, hashPassword } from '@profit-tips/auth';
import type { MatchResult, SettlementOutcome } from '@profit-tips/statistics';
import type { ProductCode } from '@profit-tips/types';
import {
  SEED_COUPONS,
  SEED_FIX_ODDS_PLANS,
  SEED_MARKETS,
  SEED_PLANS,
  SEED_PRODUCTS,
} from './seed-data.js';
import {
  addDays,
  buildAnalysis,
  confidenceBandFor,
  createId,
  hashString,
  mulberry32,
  pick,
  between,
  selectionForOutcome,
  startOfUtcDay,
} from './seed-helpers.js';

const prisma = new PrismaClient();

const DAYS_HISTORY = 180;
const DAYS_FUTURE = 4;
const FLAT_STAKE = 10;

/** Demo-only hit rates per product (see file header). */
const WIN_RATES: Record<Exclude<ProductCode, 'FREE'> | 'FREE' | 'COMBO_LEG', number> = {
  FREE: 0.75,
  VIP: 0.62,
  EXTRA: 0.38,
  COMBO: 0.6,
  COMBO_LEG: 0.63,
  FIX_ODDS: 0.55,
};

const ODDS_RANGE: Record<string, [number, number]> = {
  FREE: [1.25, 1.62],
  VIP: [1.5, 2.25],
  EXTRA: [2.0, 4.6],
  COMBO_LEG: [1.4, 1.95],
};

interface Catalogue {
  sportIds: Map<string, string>;
  countryIds: Map<string, string>;
  leagueIds: Map<string, string>;
  teamIds: Map<string, string>;
  bookmakerIds: Map<string, string>;
  marketIds: Map<string, string>;
}

interface SeededEvent {
  id: string;
  providerEventId: string;
  sportKey: string;
  leagueKey: string;
  leagueId: string;
  sportId: string;
  countryId: string | null;
  startsAt: Date;
  status: string;
  homeName: string;
  awayName: string;
  result: MatchResult | null;
}

function guardProduction(): void {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'yes') {
    throw new Error(
      'Refusing to seed a production database. Set ALLOW_PRODUCTION_SEED=yes only if you are certain.',
    );
  }
}

async function reset(): Promise<void> {
  console.log('  · clearing existing data');
  // Order matters only for tables without ON DELETE CASCADE coverage.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      analytics_events, audit_logs, referral_rewards, referrals, poll_votes, poll_options, polls,
      notifications, device_tokens, webhook_events, coupon_redemptions, coupons, promotions,
      invoices, payments, entitlements, subscriptions, subscription_plans, fix_odds_plans, products,
      combo_items, combos, tip_results, tips, odds_history, odds, events, teams, leagues, markets,
      bookmakers, countries, sports, verification_tokens, sessions, users, api_providers,
      statistics_snapshots, app_settings
    RESTART IDENTITY CASCADE
  `);
}

async function seedCatalogue(): Promise<Catalogue> {
  console.log('  · catalogue (sports, countries, leagues, teams, bookmakers, markets)');
  const sportIds = new Map<string, string>();
  for (const [index, sport] of CATALOGUE_SPORTS.entries()) {
    const row = await prisma.sport.create({
      data: { key: sport.key, name: sport.name, icon: sport.icon, sortOrder: index },
    });
    sportIds.set(sport.key, row.id);
  }

  const countryIds = new Map<string, string>();
  for (const country of CATALOGUE_COUNTRIES) {
    const row = await prisma.country.create({
      data: { code: country.code, name: country.name, flagEmoji: country.flagEmoji },
    });
    countryIds.set(country.code, row.id);
  }

  const bookmakerIds = new Map<string, string>();
  for (const bookmaker of CATALOGUE_BOOKMAKERS) {
    const row = await prisma.bookmaker.create({
      data: {
        key: bookmaker.key,
        name: bookmaker.name,
        color: bookmaker.color,
        priority: bookmaker.priority,
        website: `https://example.com/${bookmaker.key}`,
      },
    });
    bookmakerIds.set(bookmaker.key, row.id);
  }

  const marketIds = new Map<string, string>();
  for (const market of SEED_MARKETS) {
    const row = await prisma.market.create({
      data: {
        key: market.key,
        type: market.type,
        name: market.name,
        hasLine: market.hasLine,
        sortOrder: market.sortOrder,
        sportId: sportIds.get('football') ?? null,
      },
    });
    marketIds.set(market.key, row.id);
  }

  const leagueIds = new Map<string, string>();
  const teamIds = new Map<string, string>();
  for (const league of CATALOGUE_LEAGUES) {
    const sportId = sportIds.get(league.sportKey);
    if (!sportId) continue;
    const row = await prisma.league.create({
      data: {
        providerLeagueId: `mock-${league.key}`,
        sportId,
        countryId: countryIds.get(league.countryCode) ?? null,
        key: league.key,
        name: league.name,
        shortName: league.shortName,
        tier: league.tier,
        priority: league.priority,
        season: '2026/27',
      },
    });
    leagueIds.set(league.key, row.id);

    for (const team of league.teams) {
      const teamKey = `${league.sportKey}:${team.name}`;
      if (teamIds.has(teamKey)) continue;
      const teamRow = await prisma.team.upsert({
        where: { sportId_name: { sportId, name: team.name } },
        update: { leagueId: row.id },
        create: {
          providerTeamId: `mock-${team.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          sportId,
          countryId: countryIds.get(league.countryCode) ?? null,
          leagueId: row.id,
          name: team.name,
          shortName: team.shortName,
          code: team.code,
          colorPrimary: team.color,
        },
      });
      teamIds.set(teamKey, teamRow.id);
    }
  }

  return { sportIds, countryIds, leagueIds, teamIds, bookmakerIds, marketIds };
}

async function seedCommerce(): Promise<Map<string, string>> {
  console.log('  · products, subscription plans, fix odds plans, coupons, promotions');
  for (const product of SEED_PRODUCTS) {
    await prisma.product.create({ data: product });
  }

  const planIds = new Map<string, string>();
  for (const plan of SEED_PLANS) {
    const row = await prisma.subscriptionPlan.create({
      data: {
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        products: plan.products,
        priceCents: plan.priceCents,
        compareAtPriceCents: plan.compareAtPriceCents ?? null,
        currency: 'EUR',
        interval: plan.interval,
        intervalCount: plan.intervalCount,
        trialDays: plan.trialDays,
        badge: plan.badge,
        highlight: plan.highlight ?? null,
        isPopular: plan.isPopular,
        sortOrder: plan.sortOrder,
        stripePriceId: plan.stripePriceId,
        appleProductId: plan.appleProductId,
        googleProductId: plan.googleProductId,
      },
    });
    planIds.set(plan.slug, row.id);
  }

  for (const plan of SEED_FIX_ODDS_PLANS) {
    await prisma.fixOddsPlan.create({
      data: {
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        priceCents: plan.priceCents,
        targetOdds: plan.targetOdds,
        maxOdds: plan.maxOdds,
        minConfidence: plan.minConfidence,
        picksPerPeriod: plan.picksPerPeriod,
        allowLive: plan.allowLive,
        requiresVip: plan.requiresVip,
        badge: plan.badge,
        sortOrder: plan.sortOrder,
        stripePriceId: plan.stripePriceId,
        appleProductId: plan.appleProductId,
        googleProductId: plan.googleProductId,
      },
    });
  }

  for (const coupon of SEED_COUPONS) {
    await prisma.coupon.create({
      data: {
        ...coupon,
        validUntil: addDays(new Date(), 90),
      },
    });
  }

  await prisma.promotion.createMany({
    data: [
      {
        title: 'Bereit für mehr?',
        subtitle: 'Abonnieren Sie unseren Newsletter und erhalten Sie jedes Wochenende noch mehr Fußballtipps und Sonderangebote',
        ctaLabel: 'Jetzt abonnieren',
        deepLink: 'profittips://paywall/COMBO',
        badge: 'NONE',
        audience: 'FREE_USERS',
        product: 'COMBO',
        gradientFrom: '#2B1B5E',
        gradientTo: '#8B5CF6',
        priority: 1,
      },
      {
        title: 'Combo + VIP + Extra',
        subtitle: 'Alle Premium-Produkte in einem Abo — spare 21,98 €',
        ctaLabel: 'Bundle sichern',
        deepLink: 'profittips://paywall/BUNDLE',
        badge: 'MOST_POPULAR',
        audience: 'ALL',
        planId: planIds.get('bundle-1m') ?? null,
        gradientFrom: '#FFD65C',
        gradientTo: '#FFC93C',
        priority: 2,
      },
      {
        title: 'Dein VIP-Zugang endet bald',
        subtitle: 'Verlängere jetzt und verpasse keine Analyse',
        ctaLabel: 'Verlängern',
        deepLink: 'profittips://subscription',
        badge: 'LIMITED',
        audience: 'EXPIRING_SUBSCRIBERS',
        product: 'VIP',
        gradientFrom: '#3A2D06',
        gradientTo: '#151821',
        priority: 3,
      },
    ],
  });

  return planIds;
}

interface SeededUsers {
  admin: { id: string };
  moderator: { id: string };
  demo: { id: string; email: string }[];
}

async function seedUsers(): Promise<SeededUsers> {
  console.log('  · users (admin, moderator, demo accounts)');
  const adminPassword = await hashPassword(process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!2026');
  const demoPassword = await hashPassword('DemoUser!2026');

  const admin = await prisma.user.create({
    data: {
      email: (process.env.SEED_ADMIN_EMAIL ?? 'admin@profittips.app').toLowerCase(),
      passwordHash: adminPassword,
      emailVerifiedAt: new Date(),
      displayName: 'Platform Admin',
      username: 'admin',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      countryCode: 'DE',
      referralCode: generateReferralCode(),
    },
  });

  const moderator = await prisma.user.create({
    data: {
      email: 'tipster@profittips.app',
      passwordHash: adminPassword,
      emailVerifiedAt: new Date(),
      displayName: 'Chef-Analyst',
      username: 'tipster',
      role: 'MODERATOR',
      status: 'ACTIVE',
      countryCode: 'DE',
      referralCode: generateReferralCode(),
    },
  });

  const random = mulberry32(hashString('users'));
  const firstNames = ['Lukas', 'Marie', 'Jonas', 'Emma', 'Felix', 'Laura', 'Tim', 'Sophie', 'Max', 'Anna'];
  const lastNames = ['Müller', 'Schmidt', 'Weber', 'Fischer', 'Becker', 'Wagner', 'Koch', 'Richter'];
  const demo: { id: string; email: string }[] = [];

  for (let index = 0; index < 36; index += 1) {
    const first = pick(firstNames, random);
    const last = pick(lastNames, random);
    const email = `${first.toLowerCase()}.${last.toLowerCase().replace(/ü/g, 'ue')}${index}@example.com`;
    const createdAt = addDays(new Date(), -Math.floor(random() * DAYS_HISTORY));
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: demoPassword,
        emailVerifiedAt: random() > 0.15 ? createdAt : null,
        displayName: `${first} ${last}`,
        role: 'USER',
        status: index === 35 ? 'BANNED' : 'ACTIVE',
        bannedAt: index === 35 ? new Date() : null,
        banReason: index === 35 ? 'Verstoß gegen die Nutzungsbedingungen' : null,
        countryCode: pick(['DE', 'AT', 'CH', 'GB', 'ES'], random),
        language: random() > 0.35 ? 'de' : 'en',
        currency: 'EUR',
        marketingOptIn: random() > 0.6,
        referralCode: generateReferralCode(),
        createdAt,
        lastLoginAt: addDays(new Date(), -Math.floor(random() * 10)),
      },
    });
    demo.push({ id: user.id, email: user.email });
  }

  return { admin, moderator, demo };
}

async function seedEvents(catalogue: Catalogue): Promise<SeededEvent[]> {
  console.log(`  · fixtures (${DAYS_HISTORY} days of history + ${DAYS_FUTURE} days ahead)`);
  const provider = new MockProvider();
  const from = startOfUtcDay(addDays(new Date(), -DAYS_HISTORY));
  const to = startOfUtcDay(addDays(new Date(), DAYS_FUTURE + 1));

  const providerEvents = await provider.getEvents({ from, to });
  const results = await provider.getResults({
    providerEventIds: providerEvents
      .filter((event) => event.status === 'FINISHED')
      .map((event) => event.providerEventId),
  });
  const resultById = new Map(results.map((result) => [result.providerEventId, result]));

  const rows: Prisma.EventCreateManyInput[] = [];
  const seeded: SeededEvent[] = [];

  for (const event of providerEvents) {
    const leagueId = catalogue.leagueIds.get(event.leagueKey);
    const sportId = catalogue.sportIds.get(event.sportKey);
    const homeId = catalogue.teamIds.get(`${event.sportKey}:${event.homeTeam.name}`);
    const awayId = catalogue.teamIds.get(`${event.sportKey}:${event.awayTeam.name}`);
    if (!leagueId || !sportId || !homeId || !awayId) continue;

    const id = createId('ev');
    const result = resultById.get(event.providerEventId);

    rows.push({
      id,
      providerEventId: event.providerEventId,
      providerSlug: event.providerEventId,
      sportId,
      leagueId,
      homeTeamId: homeId,
      awayTeamId: awayId,
      startsAt: new Date(event.startsAt),
      status: event.status,
      minute: event.minute ?? null,
      period: event.period ?? null,
      homeScore: result?.homeScore ?? event.homeScore ?? null,
      awayScore: result?.awayScore ?? event.awayScore ?? null,
      htHomeScore: result?.htHomeScore ?? null,
      htAwayScore: result?.htAwayScore ?? null,
      homeCorners: result?.homeCorners ?? null,
      awayCorners: result?.awayCorners ?? null,
      homeYellowCards: event.homeYellowCards ?? null,
      awayYellowCards: event.awayYellowCards ?? null,
      homeRedCards: event.homeRedCards ?? null,
      awayRedCards: event.awayRedCards ?? null,
      venue: event.venue ?? null,
      round: event.round ?? null,
      season: event.season ?? null,
      resultSyncedAt: result ? new Date(event.startsAt) : null,
    });

    seeded.push({
      id,
      providerEventId: event.providerEventId,
      sportKey: event.sportKey,
      leagueKey: event.leagueKey,
      leagueId,
      sportId,
      countryId: event.countryCode ? (catalogue.countryIds.get(event.countryCode) ?? null) : null,
      startsAt: new Date(event.startsAt),
      status: event.status,
      homeName: event.homeTeam.shortName ?? event.homeTeam.name,
      awayName: event.awayTeam.shortName ?? event.awayTeam.name,
      result: result
        ? {
            homeScore: result.homeScore,
            awayScore: result.awayScore,
            htHomeScore: result.htHomeScore ?? null,
            htAwayScore: result.htAwayScore ?? null,
            homeCorners: result.homeCorners ?? null,
            awayCorners: result.awayCorners ?? null,
            homeCards: result.homeCards ?? null,
            awayCards: result.awayCards ?? null,
          }
        : null,
    });
  }

  for (let index = 0; index < rows.length; index += 500) {
    await prisma.event.createMany({ data: rows.slice(index, index + 500), skipDuplicates: true });
  }
  console.log(`    ${rows.length} events`);
  return seeded;
}

async function seedOdds(catalogue: Catalogue, events: SeededEvent[]): Promise<void> {
  console.log('  · odds book for the near-term fixtures');
  const provider = new MockProvider();
  const window = events.filter(
    (event) =>
      event.startsAt.getTime() > Date.now() - 2 * 86_400_000 &&
      event.startsAt.getTime() < Date.now() + (DAYS_FUTURE + 1) * 86_400_000,
  );
  const byProviderId = new Map(window.map((event) => [event.providerEventId, event]));
  const providerOdds = await provider.getOdds({
    providerEventIds: [...byProviderId.keys()],
  });

  const marketKeyByType: Record<string, string> = {
    MATCH_WINNER: '1x2',
    DOUBLE_CHANCE: 'double-chance',
    OVER_UNDER: 'totals',
    BTTS: 'btts',
    ASIAN_HANDICAP: 'asian-handicap',
  };

  const rows: Prisma.OddCreateManyInput[] = [];
  const history: Prisma.OddsHistoryCreateManyInput[] = [];

  for (const entry of providerOdds) {
    const event = byProviderId.get(entry.providerEventId);
    const bookmakerId = catalogue.bookmakerIds.get(entry.bookmakerKey);
    const marketId = catalogue.marketIds.get(marketKeyByType[entry.marketType] ?? '');
    if (!event || !bookmakerId || !marketId) continue;

    const random = mulberry32(hashString(`${entry.providerEventId}${entry.selection}${entry.bookmakerKey}`));
    const opening = Math.round(entry.price * (0.94 + random() * 0.12) * 100) / 100;
    const id = createId('od');

    rows.push({
      id,
      eventId: event.id,
      bookmakerId,
      marketId,
      selection: entry.selection,
      line: entry.line,
      price: entry.price,
      openingPrice: opening,
      movement:
        entry.price > opening * 1.05
          ? 'SIGNIFICANT_UP'
          : entry.price < opening * 0.95
            ? 'SIGNIFICANT_DOWN'
            : entry.price > opening
              ? 'UP'
              : entry.price < opening
                ? 'DOWN'
                : 'STABLE',
      lastUpdate: new Date(entry.lastUpdate),
    });

    history.push(
      {
        id: createId('oh'),
        oddId: id,
        price: opening,
        delta: 0,
        recordedAt: new Date(Date.now() - 36 * 3_600_000),
      },
      {
        id: createId('oh'),
        oddId: id,
        price: entry.price,
        delta: Math.round(((entry.price - opening) / opening) * 10000) / 10000,
        recordedAt: new Date(entry.lastUpdate),
      },
    );
  }

  for (let index = 0; index < rows.length; index += 1000) {
    await prisma.odd.createMany({ data: rows.slice(index, index + 1000), skipDuplicates: true });
  }
  for (let index = 0; index < history.length; index += 1000) {
    await prisma.oddsHistory.createMany({ data: history.slice(index, index + 1000) });
  }
  console.log(`    ${rows.length} odds, ${history.length} history points`);
}

interface TipDraft {
  tip: Prisma.TipCreateManyInput;
  result: Prisma.TipResultCreateManyInput | null;
}

function buildTip(
  event: SeededEvent,
  product: ProductCode,
  catalogue: Catalogue,
  authorId: string,
  random: () => number,
  options: {
    oddsRange?: [number, number];
    winRate: number;
    isStandalone?: boolean;
    fixOddsPlanId?: string | null;
    targetOdds?: number;
  },
): TipDraft {
  const finished = event.result !== null;
  const wantWin = random() < options.winRate;
  const { candidate, outcome } = finished
    ? selectionForOutcome(event.result as MatchResult, wantWin, random, event.sportKey)
    : { candidate: pickUpcomingSelection(random, event.sportKey), outcome: 'PENDING' as const };

  const range = options.oddsRange ?? ODDS_RANGE.FREE!;
  const odds = options.targetOdds
    ? between(random, options.targetOdds * 0.88, options.targetOdds * 1.12)
    : between(random, range[0], range[1]);

  const bookmakerKey = pick(CATALOGUE_BOOKMAKERS.map((entry) => entry.key), random);
  const marketId = catalogue.marketIds.get(candidate.marketKey) ?? null;
  const label = candidate.label(event.homeName, event.awayName);
  const confidence =
    product === 'VIP'
      ? 70 + Math.floor(random() * 25)
      : product === 'EXTRA'
        ? 45 + Math.floor(random() * 25)
        : 55 + Math.floor(random() * 30);

  const publishAt = new Date(event.startsAt.getTime() - (2 + random() * 10) * 3_600_000);
  const currentOdds = Math.round(odds * (0.95 + random() * 0.1) * 100) / 100;
  const id = createId('tip');

  const tip: Prisma.TipCreateManyInput = {
    id,
    sportId: event.sportId,
    countryId: event.countryId,
    leagueId: event.leagueId,
    eventId: event.id,
    marketId: marketId ?? catalogue.marketIds.get('1x2')!,
    bookmakerId: catalogue.bookmakerIds.get(bookmakerKey) ?? null,
    marketType: candidate.marketType,
    selectionLabel: label,
    selectionKey: candidate.selectionKey,
    line: candidate.line,
    odds,
    originalOdds: odds,
    currentOdds,
    oddsChanged: Math.abs(currentOdds - odds) / odds > 0.05,
    stake: FLAT_STAKE,
    confidence,
    confidenceBand: confidenceBandFor(confidence),
    product,
    status: publishAt.getTime() <= Date.now() ? 'PUBLISHED' : 'SCHEDULED',
    outcome: finished ? (outcome as SettlementOutcome) : 'PENDING',
    isLive: false,
    isStandalone: options.isStandalone ?? true,
    analysis: buildAnalysis(event.homeName, event.awayName, label, random),
    tags: [event.leagueKey, candidate.marketKey],
    source: 'PROFIT TIPS Analyse-Team',
    publishAt,
    expiresAt: event.startsAt,
    settledAt: finished ? new Date(event.startsAt.getTime() + 115 * 60_000) : null,
    createdById: authorId,
    fixOddsPlanId: options.fixOddsPlanId ?? null,
    createdAt: publishAt,
  };

  const result: Prisma.TipResultCreateManyInput | null = finished
    ? {
        id: createId('tr'),
        tipId: id,
        outcome: outcome as SettlementOutcome,
        returnFactor: returnFactor(outcome as SettlementOutcome, odds),
        stake: FLAT_STAKE,
        profit: profitFor(outcome as SettlementOutcome, odds, FLAT_STAKE),
        homeScore: event.result?.homeScore ?? null,
        awayScore: event.result?.awayScore ?? null,
        settledBy: 'ENGINE',
        settledAt: new Date(event.startsAt.getTime() + 115 * 60_000),
      }
    : null;

  return { tip, result };
}

function pickUpcomingSelection(random: () => number, sportKey = 'football') {
  const allowsDraw = sportKey === 'football' || sportKey === 'ice-hockey';
  const candidates = [
    { marketKey: '1x2', marketType: 'MATCH_WINNER' as const, selectionKey: 'HOME', line: null, label: (h: string) => `${h.toUpperCase()} WIN` },
    { marketKey: '1x2', marketType: 'MATCH_WINNER' as const, selectionKey: 'AWAY', line: null, label: (_h: string, a: string) => `${a.toUpperCase()} WIN` },
    { marketKey: 'double-chance', marketType: 'DOUBLE_CHANCE' as const, selectionKey: 'HOME_OR_DRAW', line: null, label: (h: string) => `${h.toUpperCase()} WIN OR DRAW` },
    { marketKey: 'double-chance', marketType: 'DOUBLE_CHANCE' as const, selectionKey: 'AWAY_OR_DRAW', line: null, label: (_h: string, a: string) => `${a.toUpperCase()} WIN OR DRAW` },
    { marketKey: 'totals', marketType: 'OVER_UNDER' as const, selectionKey: 'OVER', line: 2.5, label: () => 'OVER 2.5 GOALS' },
    { marketKey: 'totals', marketType: 'OVER_UNDER' as const, selectionKey: 'UNDER', line: 2.5, label: () => 'UNDER 2.5 GOALS' },
    { marketKey: 'btts', marketType: 'BTTS' as const, selectionKey: 'BTTS_YES', line: null, label: () => 'BOTH TEAMS TO SCORE' },
  ].filter((candidate) => allowsDraw || candidate.marketType !== 'DOUBLE_CHANCE');
  return pick(candidates, random);
}

async function seedTipsAndCombos(
  catalogue: Catalogue,
  events: SeededEvent[],
  authorId: string,
): Promise<void> {
  console.log('  · tips, combos and settled results');
  const fixPlans = await prisma.fixOddsPlan.findMany({ select: { id: true, targetOdds: true } });

  const byDay = new Map<string, SeededEvent[]>();
  for (const event of events) {
    const key = startOfUtcDay(event.startsAt).toISOString().slice(0, 10);
    const list = byDay.get(key) ?? [];
    list.push(event);
    byDay.set(key, list);
  }

  const tips: Prisma.TipCreateManyInput[] = [];
  const results: Prisma.TipResultCreateManyInput[] = [];
  const combos: Prisma.ComboCreateManyInput[] = [];
  const comboItems: Prisma.ComboItemCreateManyInput[] = [];

  for (const [day, dayEvents] of [...byDay.entries()].sort()) {
    const random = mulberry32(hashString(`tips:${day}`));
    const pool = dayEvents.filter((event) => event.status === 'FINISHED' || event.startsAt.getTime() > Date.now());
    if (pool.length < 4) continue;
    const shuffled = [...pool].sort(() => random() - 0.5);
    let cursor = 0;
    const take = (): SeededEvent | null => (cursor < shuffled.length ? shuffled[cursor++]! : null);

    const push = (draft: TipDraft): void => {
      tips.push(draft.tip);
      if (draft.result) results.push(draft.result);
    };

    // FREE — the public feed
    for (let index = 0; index < 4; index += 1) {
      const event = take();
      if (!event) break;
      push(buildTip(event, 'FREE', catalogue, authorId, random, {
        oddsRange: ODDS_RANGE.FREE,
        winRate: WIN_RATES.FREE,
      }));
    }

    // VIP
    for (let index = 0; index < 3; index += 1) {
      const event = take();
      if (!event) break;
      push(buildTip(event, 'VIP', catalogue, authorId, random, {
        oddsRange: ODDS_RANGE.VIP,
        winRate: WIN_RATES.VIP,
      }));
    }

    // EXTRA — higher odds, lower hit rate
    for (let index = 0; index < 2; index += 1) {
      const event = take();
      if (!event) break;
      push(buildTip(event, 'EXTRA', catalogue, authorId, random, {
        oddsRange: ODDS_RANGE.EXTRA,
        winRate: WIN_RATES.EXTRA,
      }));
    }

    // FIX ODDS — one pick per plan every other day
    for (const plan of fixPlans) {
      if (random() > 0.5) continue;
      const event = take();
      if (!event) break;
      push(buildTip(event, 'FIX_ODDS', catalogue, authorId, random, {
        winRate: Math.min(0.85, (1 / Number(plan.targetOdds)) * 1.12),
        targetOdds: Number(plan.targetOdds),
        fixOddsPlanId: plan.id,
      }));
    }

    // COMBO — two accumulators per day, three or four legs each
    for (let comboIndex = 0; comboIndex < 2; comboIndex += 1) {
      const legCount = 3 + Math.floor(random() * 2);
      const legs: TipDraft[] = [];
      for (let leg = 0; leg < legCount; leg += 1) {
        const event = take();
        if (!event) break;
        legs.push(
          buildTip(event, 'COMBO', catalogue, authorId, random, {
            oddsRange: ODDS_RANGE.COMBO_LEG,
            winRate: WIN_RATES.COMBO_LEG,
            isStandalone: false,
          }),
        );
      }
      if (legs.length < 2) break;

      const comboId = createId('cmb');
      const totalOdds = legs.reduce((acc, leg) => acc * Number(leg.tip.odds), 1);
      const allSettled = legs.every((leg) => leg.result !== null);
      const settlement = allSettled
        ? settleCombo(
            legs.map((leg) => ({
              outcome: leg.result!.outcome as SettlementOutcome,
              odds: Number(leg.tip.odds),
            })),
            FLAT_STAKE,
          )
        : null;

      const publishAt = new Date(
        Math.min(...legs.map((leg) => new Date(leg.tip.publishAt as Date).getTime())),
      );

      combos.push({
        id: comboId,
        title: `${legCount}er-Kombi · ${day}`,
        subtitle: `${legs.length} Auswahlen · Gesamtquote ${totalOdds.toFixed(2)}`,
        product: 'COMBO',
        status: publishAt.getTime() <= Date.now() ? 'PUBLISHED' : 'SCHEDULED',
        outcome: settlement ? settlement.outcome : 'PENDING',
        totalOdds: Math.round(totalOdds * 1000) / 1000,
        stake: FLAT_STAKE,
        returnFactor: settlement ? settlement.returnFactor : null,
        profit: settlement ? settlement.profit : null,
        analysis:
          'Kombination aus mehreren Einzelanalysen. Jede Auswahl ist separat begründet; die Kombi-Abrechnung erfolgt automatisch über die Einzelergebnisse.',
        publishAt,
        expiresAt: new Date(Math.min(...legs.map((leg) => (leg.tip.expiresAt as Date).getTime()))),
        settledAt: settlement ? new Date(`${day}T23:00:00.000Z`) : null,
        createdById: authorId,
        createdAt: publishAt,
      });

      legs.forEach((leg, index) => {
        push(leg);
        comboItems.push({
          id: createId('ci'),
          comboId,
          tipId: leg.tip.id as string,
          sortOrder: index,
        });
      });
    }
  }

  for (let index = 0; index < tips.length; index += 500) {
    await prisma.tip.createMany({ data: tips.slice(index, index + 500) });
  }
  for (let index = 0; index < results.length; index += 500) {
    await prisma.tipResult.createMany({ data: results.slice(index, index + 500) });
  }
  for (let index = 0; index < combos.length; index += 500) {
    await prisma.combo.createMany({ data: combos.slice(index, index + 500) });
  }
  for (let index = 0; index < comboItems.length; index += 500) {
    await prisma.comboItem.createMany({ data: comboItems.slice(index, index + 500) });
  }

  console.log(`    ${tips.length} tips (${results.length} settled), ${combos.length} combos`);

  // A handful of live tips on fixtures that are in play right now.
  const liveEvents = events.filter((event) => event.status === 'LIVE' || event.status === 'HALFTIME');
  if (liveEvents.length > 0) {
    const random = mulberry32(hashString('live'));
    for (const event of liveEvents.slice(0, 4)) {
      const draft = buildTip(event, 'VIP', catalogue, authorId, random, {
        oddsRange: [1.6, 2.6],
        winRate: 0.5,
      });
      await prisma.tip.create({
        data: {
          ...draft.tip,
          id: createId('tip'),
          isLive: true,
          outcome: 'LIVE',
          status: 'PUBLISHED',
          publishAt: new Date(),
          settledAt: null,
        },
      });
    }
  }
}

async function seedSubscriptions(users: SeededUsers, planIds: Map<string, string>): Promise<void> {
  console.log('  · subscriptions, entitlements, payments and invoices');
  const plans = await prisma.subscriptionPlan.findMany();
  const random = mulberry32(hashString('subs'));
  let invoiceCounter = 1000;

  for (const [index, user] of users.demo.entries()) {
    if (random() > 0.55) continue; // ~45 % of demo users subscribe
    const plan = pick(plans, random);
    const startedAt = addDays(new Date(), -Math.floor(random() * 120));
    const months = plan.interval === 'YEAR' ? plan.intervalCount * 12 : plan.intervalCount;
    const periodEnd = addDays(startedAt, months * 30);
    const expired = periodEnd.getTime() < Date.now();
    const cancelled = random() > 0.8;

    const subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        provider: pick(['STRIPE', 'APPLE', 'GOOGLE'] as const, random),
        providerSubscriptionId: `dev_sub_${index}_${Math.floor(random() * 1e6)}`,
        providerCustomerId: `dev_cus_${index}`,
        providerStatus: expired ? 'canceled' : 'active',
        status: expired ? 'EXPIRED' : cancelled ? 'CANCELED' : 'ACTIVE',
        products: plan.products,
        startedAt,
        currentPeriodStart: startedAt,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: cancelled,
        canceledAt: cancelled ? addDays(periodEnd, -5) : null,
        endedAt: expired ? periodEnd : null,
        priceCents: plan.priceCents,
        currency: plan.currency,
      },
    });

    if (!expired) {
      for (const product of plan.products) {
        await prisma.entitlement.create({
          data: {
            userId: user.id,
            product,
            source: 'SUBSCRIPTION',
            subscriptionId: subscription.id,
            grantedAt: startedAt,
            expiresAt: periodEnd,
          },
        });
      }
    }

    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        subscriptionId: subscription.id,
        provider: subscription.provider,
        providerPaymentId: `dev_pi_${index}_${Math.floor(random() * 1e6)}`,
        providerStatus: 'succeeded',
        status: 'SUCCEEDED',
        amountCents: plan.priceCents,
        currency: plan.currency,
        description: plan.name,
        paidAt: startedAt,
        createdAt: startedAt,
      },
    });

    invoiceCounter += 1;
    await prisma.invoice.create({
      data: {
        userId: user.id,
        paymentId: payment.id,
        subscriptionId: subscription.id,
        number: `PT-2026-${invoiceCounter}`,
        status: 'PAID',
        amountDueCents: plan.priceCents,
        amountPaidCents: plan.priceCents,
        taxCents: Math.round(plan.priceCents * 0.19),
        currency: plan.currency,
        lines: [{ description: plan.name, amountCents: plan.priceCents, quantity: 1 }],
        issuedAt: startedAt,
        paidAt: startedAt,
      },
    });
  }

  // The bundle plan powers the admin's own account so every screen is unlocked in dev.
  const bundleId = planIds.get('bundle-1m');
  if (bundleId) {
    const bundle = plans.find((plan) => plan.id === bundleId);
    const subscription = await prisma.subscription.create({
      data: {
        userId: users.admin.id,
        planId: bundleId,
        provider: 'MANUAL',
        providerSubscriptionId: 'dev_admin_bundle',
        providerStatus: 'active',
        status: 'ACTIVE',
        products: bundle?.products ?? ['COMBO', 'VIP', 'EXTRA'],
        startedAt: addDays(new Date(), -10),
        currentPeriodStart: addDays(new Date(), -10),
        currentPeriodEnd: addDays(new Date(), 355),
      },
    });
    for (const product of ['COMBO', 'VIP', 'EXTRA', 'FIX_ODDS'] as ProductCode[]) {
      await prisma.entitlement.create({
        data: {
          userId: users.admin.id,
          product,
          source: 'ADMIN_GRANT',
          subscriptionId: product === 'FIX_ODDS' ? null : subscription.id,
          grantedById: users.admin.id,
          grantedAt: addDays(new Date(), -10),
          expiresAt: addDays(new Date(), 355),
          note: 'Seed: full access for the platform owner account',
        },
      });
    }
  }
}

async function seedPolls(events: SeededEvent[], users: SeededUsers): Promise<void> {
  console.log('  · polls and votes');
  const random = mulberry32(hashString('polls'));
  const upcoming = events
    .filter((event) => event.startsAt.getTime() > Date.now())
    .slice(0, 3);

  const definitions = [
    {
      question: 'Wer gewinnt das Topspiel?',
      kind: 'MATCH_WINNER' as const,
      options: ['Heimsieg', 'Unentschieden', 'Auswärtssieg'],
      eventId: upcoming[0]?.id ?? null,
    },
    {
      question: 'Wie viele Tore fallen am Wochenende im Schnitt?',
      kind: 'GOALS' as const,
      options: ['Unter 2,5', 'Genau 3', 'Über 3,5'],
      eventId: null,
    },
    {
      question: 'Welche Liga liefert dir die besten Analysen?',
      kind: 'LEAGUE' as const,
      options: ['Premier League', 'Bundesliga', 'LaLiga', 'Serie A'],
      eventId: null,
    },
    {
      question: 'Welches Produkt soll als Nächstes ausgebaut werden?',
      kind: 'BEST_TIP' as const,
      options: ['VIP', 'Combo', 'Extra', 'Fix Odds'],
      eventId: null,
    },
  ];

  for (const [index, definition] of definitions.entries()) {
    const poll = await prisma.poll.create({
      data: {
        question: definition.question,
        kind: definition.kind,
        status: index === 3 ? 'CLOSED' : 'ACTIVE',
        eventId: definition.eventId,
        startsAt: addDays(new Date(), -3),
        endsAt: index === 3 ? addDays(new Date(), -1) : addDays(new Date(), 4),
        createdById: users.moderator.id,
        options: {
          create: definition.options.map((label, order) => ({ label, sortOrder: order })),
        },
      },
      include: { options: true },
    });

    let total = 0;
    for (const user of users.demo) {
      if (random() > 0.45) continue;
      const option = pick(poll.options, random);
      await prisma.pollVote.create({
        data: { pollId: poll.id, optionId: option.id, userId: user.id },
      });
      await prisma.pollOption.update({
        where: { id: option.id },
        data: { voteCount: { increment: 1 } },
      });
      total += 1;
    }
    await prisma.poll.update({ where: { id: poll.id }, data: { totalVotes: total } });
  }
}

async function seedReferrals(users: SeededUsers): Promise<void> {
  console.log('  · referrals and rewards');
  const random = mulberry32(hashString('referrals'));
  const referrer = users.demo[0];
  if (!referrer) return;

  for (const referee of users.demo.slice(1, 7)) {
    const qualified = random() > 0.4;
    const referral = await prisma.referral.create({
      data: {
        code: 'SEEDCODE',
        referrerId: referrer.id,
        refereeId: referee.id,
        status: qualified ? 'REWARDED' : 'PENDING',
        qualifiedAt: qualified ? addDays(new Date(), -Math.floor(random() * 30)) : null,
        rewardedAt: qualified ? addDays(new Date(), -Math.floor(random() * 20)) : null,
      },
    });
    if (qualified) {
      await prisma.referralReward.create({
        data: {
          referralId: referral.id,
          userId: referrer.id,
          type: 'FREE_DAYS',
          status: 'GRANTED',
          days: 7,
          grantedAt: new Date(),
          expiresAt: addDays(new Date(), 90),
        },
      });
    }
    await prisma.user.update({
      where: { id: referee.id },
      data: { referredById: referrer.id },
    });
  }
}

async function seedProvidersAndSettings(): Promise<void> {
  console.log('  · API providers and application settings');
  await prisma.apiProvider.createMany({
    data: [
      {
        slug: 'mock',
        name: 'Mock provider (offline)',
        kind: 'SPORTS',
        isActive: true,
        priority: 1,
        pollIntervalSeconds: 120,
        rateLimitPerMinute: 1000,
        enabledSports: ['football', 'tennis', 'basketball', 'ice-hockey', 'baseball'],
        config: { note: 'Deterministic offline fixtures — no credentials required.' },
      },
      {
        slug: 'sportsgameodds',
        name: 'SportsGameOdds',
        kind: 'SPORTS',
        baseUrl: 'https://api.sportsgameodds.com/v2',
        isActive: false,
        priority: 10,
        pollIntervalSeconds: 120,
        rateLimitPerMinute: 60,
        config: { docs: 'https://sportsgameodds.com/docs' },
      },
      {
        slug: 'theoddsapi',
        name: 'The Odds API',
        kind: 'ODDS',
        baseUrl: 'https://api.the-odds-api.com/v4',
        isActive: false,
        priority: 20,
        pollIntervalSeconds: 300,
        rateLimitPerMinute: 30,
        config: { docs: 'https://the-odds-api.com/liveapi/guides/v4/' },
      },
    ],
  });

  await prisma.appSetting.createMany({
    data: [
      {
        key: 'referral_program',
        value: {
          rewardType: 'FREE_DAYS',
          rewardDays: 7,
          rewardAmountCents: 0,
          minPurchaseCents: 1999,
          expiresInDays: 90,
          isActive: true,
        },
      },
      {
        key: 'statistics',
        value: { stake: FLAT_STAKE, currency: 'EUR' },
      },
      {
        key: 'responsible_gambling',
        value: {
          minimumAge: 18,
          helplineUrl: 'https://www.bzga.de/service/beratungsstellen/',
          showOnPaywall: true,
        },
      },
    ],
  });
}

async function summary(): Promise<void> {
  const [users, events, tips, settled, combos, plans, subscriptions] = await Promise.all([
    prisma.user.count(),
    prisma.event.count(),
    prisma.tip.count(),
    prisma.tipResult.count(),
    prisma.combo.count(),
    prisma.subscriptionPlan.count(),
    prisma.subscription.count(),
  ]);

  const comboTips = await prisma.tip.count({ where: { product: 'COMBO', outcome: { in: ['WON', 'HALF_WON'] } } });

  console.log('\n  Seed complete:');
  console.table({
    users,
    events,
    tips,
    settledTips: settled,
    combos,
    plans,
    subscriptions,
    successfulComboAnalyses: comboTips,
  });
  console.log(`\n  Admin login: ${process.env.SEED_ADMIN_EMAIL ?? 'admin@profittips.app'} / ${process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!2026'}`);
  console.log('  Demo user login: any seeded @example.com address / DemoUser!2026\n');
}

async function main(): Promise<void> {
  console.log('\nSeeding PROFIT TIPS development database…\n');
  guardProduction();
  await reset();
  const catalogue = await seedCatalogue();
  const planIds = await seedCommerce();
  const users = await seedUsers();
  const events = await seedEvents(catalogue);
  await seedOdds(catalogue, events);
  await seedTipsAndCombos(catalogue, events, users.moderator.id);
  await seedSubscriptions(users, planIds);
  await seedPolls(events, users);
  await seedReferrals(users);
  await seedProvidersAndSettings();
  await summary();
}

main()
  .catch((error) => {
    console.error('\nSeed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
