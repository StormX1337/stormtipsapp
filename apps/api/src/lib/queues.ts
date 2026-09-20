import { Queue, type JobsOptions } from 'bullmq';
import { QUEUE_NAMES } from '@storm-tips/config';
import { redis } from './redis.js';
import { logger } from './logger.js';

/**
 * Queue producers.
 *
 * The API only ever *enqueues*; every processor lives in `apps/worker`. Job ids
 * are passed explicitly wherever a job must not run twice (settlement,
 * notification fan-out), which is what makes those jobs idempotent.
 */
const defaultJobOptions: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2_000 },
  removeOnComplete: { age: 3_600, count: 1_000 },
  removeOnFail: { age: 86_400 },
};

const queues = new Map<string, Queue>();

export function getQueue(name: string): Queue {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue(name, { connection: redis, defaultJobOptions });
    queue.on('error', (error) => logger.error({ err: error, queue: name }, 'queue error'));
    queues.set(name, queue);
  }
  return queue;
}

/**
 * BullMQ refuses a custom job id containing `:` — the separator in its own Redis
 * keys — and every id below was written with one. Each was rejected at runtime
 * and the job silently dropped, which is how this shipped: scheduled publishing
 * and every push notification had been failing, visible only as one line in the
 * worker log.
 *
 * Sanitising here rather than at each call site is deliberate. The ids that
 * matter most are `dedupeKey`s built by route handlers, so a rule that lives
 * with the callers is a rule that the next caller misses.
 */
export function safeJobId(value: string): string {
  return value.replace(/:/g, '-');
}

export async function enqueue<T extends object>(
  queueName: string,
  jobName: string,
  payload: T,
  options: JobsOptions = {},
): Promise<void> {
  const safe = options.jobId ? { ...options, jobId: safeJobId(options.jobId) } : options;
  try {
    await getQueue(queueName).add(jobName, payload, safe);
  } catch (error) {
    logger.error({ err: error, queueName, jobName }, 'failed to enqueue job');
  }
}

export const jobs = {
  syncFixtures: (payload: { providerSlug?: string; days?: number } = {}) =>
    enqueue(QUEUE_NAMES.sports, 'sync:fixtures', payload),
  syncOdds: (payload: { eventIds?: string[] } = {}) =>
    enqueue(QUEUE_NAMES.odds, 'sync:odds', payload),
  syncResults: (payload: { eventIds?: string[] } = {}) =>
    enqueue(QUEUE_NAMES.results, 'sync:results', payload),
  settleTips: () => enqueue(QUEUE_NAMES.results, 'settle:due', {}),
  publishTip: (tipId: string, runAt?: Date) =>
    enqueue(
      QUEUE_NAMES.tips,
      'publish:tip',
      { tipId },
      {
        jobId: `publish:${tipId}`,
        delay: runAt ? Math.max(0, runAt.getTime() - Date.now()) : 0,
      },
    ),
  publishCombo: (comboId: string, runAt?: Date) =>
    enqueue(
      QUEUE_NAMES.tips,
      'publish:combo',
      { comboId },
      {
        jobId: `publish-combo:${comboId}`,
        delay: runAt ? Math.max(0, runAt.getTime() - Date.now()) : 0,
      },
    ),
  recomputeStatistics: () => enqueue(QUEUE_NAMES.statistics, 'stats:recompute', {}),
  sendNotification: (notificationId: string) =>
    enqueue(
      QUEUE_NAMES.notifications,
      'notification:send',
      { notificationId },
      { jobId: `notify:${notificationId}` },
    ),
  fanOutNotification: (payload: {
    type: string;
    templateKey?: string;
    values?: Record<string, string | number>;
    title?: string;
    body?: string;
    translations?: Record<string, { title?: string; body?: string }>;
    data?: Record<string, unknown>;
    deepLink?: string | null;
    imageUrl?: string | null;
    audience: {
      products?: string[];
      userIds?: string[];
      onlyFreeUsers?: boolean;
      locale?: string;
      /** The match this is about, for readers who only want their favourites. */
      about?: { leagueId?: string | null; teamIds?: string[] };
    };
    scheduledAt?: string | null;
    dedupeKey?: string;
  }) =>
    enqueue(QUEUE_NAMES.notifications, 'notification:fanout', payload, {
      jobId: payload.dedupeKey,
      delay: payload.scheduledAt
        ? Math.max(0, new Date(payload.scheduledAt).getTime() - Date.now())
        : 0,
    }),
  checkSubscriptions: () => enqueue(QUEUE_NAMES.subscriptions, 'subscriptions:check', {}),
};

export async function closeQueues(): Promise<void> {
  await Promise.allSettled([...queues.values()].map((queue) => queue.close()));
  queues.clear();
}
