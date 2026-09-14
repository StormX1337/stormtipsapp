import { prisma, type Prisma } from '@storm-tips/database';
import { CACHE_TTL, REDIS_KEYS } from '@storm-tips/config';
import {
  AppError,
  type ComboDTO,
  type Paginated,
  type ProductCode,
  type TipDTO,
  type TipFeedDTO,
  type TipFeedGroupDTO,
} from '@storm-tips/types';
import { cacheInvalidatePattern } from '../lib/cache.js';
import { paginate, skipTake, type PageParams } from '../lib/http.js';
import { serializeBookmaker, serializeLeague } from '../serializers/catalogue.js';
import { comboInclude, serializeCombo, serializeTip, tipInclude } from '../serializers/tip.js';
import { entitlements } from './entitlement.service.js';

export interface FeedOptions extends PageParams {
  product: ProductCode;
  date?: string;
  from?: string;
  to?: string;
  sportId?: string;
  leagueId?: string;
  outcome?: string;
  live?: boolean;
  includeSettled?: boolean;
  timezone?: string;
  /** Language the editorial text is returned in. */
}

/** Day boundaries for a YYYY-MM-DD key, interpreted in the viewer's timezone. */
function dayRange(date: string, timezone: string): { start: Date; end: Date } {
  // Determine the UTC offset that applies on that date in the target zone.
  const probe = new Date(`${date}T12:00:00Z`);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'longOffset',
  });
  const offsetPart = formatter
    .formatToParts(probe)
    .find((part) => part.type === 'timeZoneName')?.value;
  const match = /GMT([+-]\d{2}):?(\d{2})?/.exec(offsetPart ?? '');
  const offsetMinutes = match
    ? Number(match[1]) * 60 +
      (Number(match[1]) < 0 ? -Number(match[2] ?? 0) : Number(match[2] ?? 0))
    : 0;

  const start = new Date(`${date}T00:00:00Z`);
  start.setUTCMinutes(start.getUTCMinutes() - offsetMinutes);
  const end = new Date(start.getTime() + 86_400_000);
  return { start, end };
}

export class TipService {
  private baseWhere(options: FeedOptions): Prisma.TipWhereInput {
    const where: Prisma.TipWhereInput = {
      product: options.product,
      status: 'PUBLISHED',
      isStandalone: true,
      publishAt: { lte: new Date() },
    };

    if (options.date) {
      const { start, end } = dayRange(options.date, options.timezone ?? 'Europe/Berlin');
      where.event = { startsAt: { gte: start, lt: end } };
    } else if (options.from || options.to) {
      where.event = {
        startsAt: {
          ...(options.from ? { gte: new Date(options.from) } : {}),
          ...(options.to ? { lte: new Date(options.to) } : {}),
        },
      };
    }

    if (options.sportId) where.sportId = options.sportId;
    if (options.leagueId) where.leagueId = options.leagueId;
    if (options.outcome) where.outcome = options.outcome as never;
    if (options.live !== undefined) where.isLive = options.live;
    if (options.includeSettled === false) where.outcome = { in: ['PENDING', 'LIVE'] };

    return where;
  }

  /**
   * The product feed, grouped by league exactly as the UI renders it.
   * Premium tips the viewer cannot access are returned locked, never omitted —
   * the paywall needs to show what is behind it.
   */
  async feed(options: FeedOptions, userId: string | null): Promise<TipFeedDTO> {
    const unlocked = await entitlements.has(userId, options.product);
    const where = this.baseWhere(options);

    const tips = await prisma.tip.findMany({
      where,
      include: tipInclude,
      orderBy: [{ event: { startsAt: 'asc' } }, { createdAt: 'asc' }],
      take: 200,
    });

    const groups = new Map<string, TipFeedGroupDTO>();
    for (const tip of tips) {
      const key = tip.leagueId;
      const existing = groups.get(key);
      const dto = serializeTip(tip, unlocked);
      if (existing) {
        existing.tips.push(dto);
      } else {
        groups.set(key, {
          league: serializeLeague(tip.league),
          bookmaker: serializeBookmaker(tip.bookmaker),
          tips: [dto],
        });
      }
    }

    const ordered = [...groups.values()].sort(
      (a, b) => a.league.priority - b.league.priority || a.league.name.localeCompare(b.league.name),
    );

    return {
      date: options.date ?? new Date().toISOString().slice(0, 10),
      product: options.product,
      groups: ordered,
      totalTips: tips.length,
      lockedTips: unlocked ? 0 : tips.length,
    };
  }

  async list(options: FeedOptions, userId: string | null): Promise<Paginated<TipDTO>> {
    const unlocked = await entitlements.has(userId, options.product);
    const where = this.baseWhere(options);
    const { skip, take } = skipTake(options);

    const [tips, total] = await Promise.all([
      prisma.tip.findMany({
        where,
        include: tipInclude,
        orderBy: [{ event: { startsAt: 'desc' } }],
        skip,
        take,
      }),
      prisma.tip.count({ where }),
    ]);

    return paginate(
      tips.map((tip) => serializeTip(tip, unlocked)),
      total,
      options,
    );
  }

  async byId(id: string, userId: string | null): Promise<TipDTO> {
    const tip = await prisma.tip.findUnique({ where: { id }, include: tipInclude });
    if (!tip || tip.status === 'DRAFT' || tip.status === 'CANCELLED') {
      throw AppError.notFound('Tip');
    }
    const unlocked = await entitlements.has(userId, tip.product as ProductCode);
    return serializeTip(tip, unlocked);
  }

  /** Verified results history — settled tips only, newest first. */
  async history(
    options: PageParams & {
      product?: ProductCode;
      from?: string;
      to?: string;
      outcome?: string;
      leagueId?: string;
      marketType?: string;
    },
    _userId: string | null,
  ): Promise<Paginated<TipDTO>> {
    const where: Prisma.TipWhereInput = {
      status: 'PUBLISHED',
      outcome: { in: ['WON', 'LOST', 'VOID', 'HALF_WON', 'HALF_LOST'] },
      ...(options.product ? { product: options.product } : {}),
      ...(options.outcome ? { outcome: options.outcome as never } : {}),
      ...(options.leagueId ? { leagueId: options.leagueId } : {}),
      ...(options.marketType ? { marketType: options.marketType as never } : {}),
      ...(options.from || options.to
        ? {
            settledAt: {
              ...(options.from ? { gte: new Date(`${options.from}T00:00:00Z`) } : {}),
              ...(options.to ? { lte: new Date(`${options.to}T23:59:59Z`) } : {}),
            },
          }
        : {}),
    };

    const { skip, take } = skipTake(options);
    const [tips, total] = await Promise.all([
      prisma.tip.findMany({
        where,
        include: tipInclude,
        orderBy: { settledAt: 'desc' },
        skip,
        take,
      }),
      prisma.tip.count({ where }),
    ]);

    // Settled history is a matter of record: once a tip is settled its
    // selection and result are public, so nothing is masked here.
    return paginate(
      tips.map((tip) => serializeTip(tip, true)),
      total,
      options,
    );
  }

  async combos(
    options: PageParams & {
      date?: string;
      timezone?: string;
      includeSettled?: boolean;
    },
    userId: string | null,
  ): Promise<Paginated<ComboDTO>> {
    const unlocked = await entitlements.has(userId, 'COMBO');
    const where: Prisma.ComboWhereInput = {
      status: 'PUBLISHED',
      publishAt: { lte: new Date() },
    };
    if (options.date) {
      const { start, end } = dayRange(options.date, options.timezone ?? 'Europe/Berlin');
      where.publishAt = { gte: start, lt: end };
    }
    if (options.includeSettled === false) where.outcome = 'PENDING';

    const { skip, take } = skipTake(options);
    const [combos, total] = await Promise.all([
      prisma.combo.findMany({
        where,
        include: comboInclude,
        orderBy: { publishAt: 'desc' },
        skip,
        take,
      }),
      prisma.combo.count({ where }),
    ]);

    return paginate(
      combos.map((combo) => serializeCombo(combo, unlocked)),
      total,
      options,
    );
  }

  async comboById(id: string, userId: string | null): Promise<ComboDTO> {
    const combo = await prisma.combo.findUnique({ where: { id }, include: comboInclude });
    if (!combo || combo.status === 'DRAFT') throw AppError.notFound('Combo');
    const unlocked = await entitlements.has(userId, combo.product as ProductCode);
    return serializeCombo(combo, unlocked);
  }

  /** Live tips across every product the viewer can see. */
  async live(userId: string | null): Promise<TipDTO[]> {
    const tips = await prisma.tip.findMany({
      where: {
        isLive: true,
        status: 'PUBLISHED',
        outcome: { in: ['PENDING', 'LIVE'] },
      },
      include: tipInclude,
      orderBy: { publishAt: 'desc' },
      take: 50,
    });

    const products = await entitlements.productsFor(userId);
    return tips.map((tip) => serializeTip(tip, products.has(tip.product as ProductCode)));
  }

  async invalidateFeedCache(): Promise<void> {
    await cacheInvalidatePattern(`${REDIS_KEYS.tipFeed('*', '*')}`);
  }
}

export const tips = new TipService();
export const FEED_CACHE_TTL = CACHE_TTL.tipFeed;
