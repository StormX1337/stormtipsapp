import { prisma } from '@profit-tips/database';
import type { AnalyticsEventName } from '@profit-tips/types';
import { logger } from '../lib/logger.js';

export interface TrackInput {
  name: AnalyticsEventName;
  properties?: Record<string, unknown>;
  userId?: string | null;
  anonymousId?: string | null;
  platform?: string | null;
  appVersion?: string | null;
  locale?: string | null;
}

/**
 * Product analytics.
 *
 * Events are pseudonymous: we store a user id only when the caller is
 * authenticated, otherwise a client-generated anonymous id. No IP address and
 * no free-text personal data is retained.
 */
export class AnalyticsService {
  async track(events: TrackInput[]): Promise<number> {
    if (events.length === 0) return 0;
    try {
      const { count } = await prisma.analyticsEvent.createMany({
        data: events.map((event) => ({
          userId: event.userId ?? null,
          anonymousId: event.anonymousId ?? null,
          name: event.name,
          properties: (event.properties ?? {}) as never,
          platform: event.platform ?? null,
          appVersion: event.appVersion ?? null,
          locale: event.locale ?? null,
        })),
      });
      return count;
    } catch (error) {
      // Analytics must never break a user-facing request.
      logger.warn({ err: error }, 'analytics write failed');
      return 0;
    }
  }

  /** Funnel counts for the admin dashboard. */
  async funnel(days = 30): Promise<{ name: string; count: number }[]> {
    const since = new Date(Date.now() - days * 86_400_000);
    const rows = await prisma.analyticsEvent.groupBy({
      by: ['name'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { name: 'desc' } },
    });
    return rows.map((row) => ({ name: row.name, count: row._count._all }));
  }
}

export const analytics = new AnalyticsService();
