import { Worker, Queue, type Processor } from 'bullmq';
import { QUEUE_NAMES } from '@profit-tips/config';
import { disconnectPrisma } from '@profit-tips/database';
import { env } from '@profit-tips/api/lib/env';
import { logger } from '@profit-tips/api/lib/logger';
import { redis, closeRedis } from '@profit-tips/api/lib/redis';
import { syncFixturesJob, syncLiveJob, syncOddsJob } from './jobs/sports.js';
import { settleDueJob, syncResultsJob } from './jobs/results.js';
import {
  kickoffRemindersJob,
  publishComboJob,
  publishDueTipsJob,
  publishTipJob,
  refreshTipOddsJob,
} from './jobs/tips.js';
import {
  checkPushReceiptsJob,
  fanOutNotificationJob,
  sendNotificationJob,
  sendScheduledJob,
} from './jobs/notifications.js';
import { expireSubscriptionsJob, expiringRemindersJob } from './jobs/subscriptions.js';
import { cleanupJob, closePollsJob, recomputeStatisticsJob } from './jobs/maintenance.js';

/** Job name → processor, per queue. */
const HANDLERS: Record<string, Record<string, Processor>> = {
  [QUEUE_NAMES.sports]: {
    'sync:fixtures': syncFixturesJob as Processor,
    'sync:live': syncLiveJob as Processor,
  },
  [QUEUE_NAMES.odds]: {
    'sync:odds': syncOddsJob as Processor,
    'refresh:tip-odds': refreshTipOddsJob as Processor,
  },
  [QUEUE_NAMES.results]: {
    'sync:results': syncResultsJob as Processor,
    'settle:due': settleDueJob as Processor,
  },
  [QUEUE_NAMES.tips]: {
    'publish:tip': publishTipJob as Processor,
    'publish:combo': publishComboJob as Processor,
    'publish:due': publishDueTipsJob as Processor,
    'reminders:kickoff': kickoffRemindersJob as Processor,
  },
  [QUEUE_NAMES.notifications]: {
    'notification:fanout': fanOutNotificationJob as Processor,
    'notification:send': sendNotificationJob as Processor,
    'notification:scheduled': sendScheduledJob as Processor,
    'notification:receipts': checkPushReceiptsJob as Processor,
  },
  [QUEUE_NAMES.subscriptions]: {
    'subscriptions:check': expireSubscriptionsJob as Processor,
    'subscriptions:reminders': expiringRemindersJob as Processor,
  },
  [QUEUE_NAMES.statistics]: {
    'stats:recompute': recomputeStatisticsJob as Processor,
  },
  [QUEUE_NAMES.maintenance]: {
    cleanup: cleanupJob as Processor,
    'polls:close': closePollsJob as Processor,
  },
};

/** Per-queue concurrency. Network-bound queues get more, DB-heavy ones fewer. */
const CONCURRENCY: Record<string, number> = {
  [QUEUE_NAMES.sports]: 2,
  [QUEUE_NAMES.odds]: 2,
  [QUEUE_NAMES.results]: 2,
  [QUEUE_NAMES.tips]: 4,
  [QUEUE_NAMES.notifications]: 6,
  [QUEUE_NAMES.subscriptions]: 1,
  [QUEUE_NAMES.statistics]: 1,
  [QUEUE_NAMES.maintenance]: 1,
};

/**
 * Repeatable schedules.
 *
 * `jobId` is stable per schedule so restarting the worker never creates a
 * duplicate repeatable job.
 */
const SCHEDULES: {
  queue: string;
  name: string;
  cron: string;
  data?: Record<string, unknown>;
}[] = [
  { queue: QUEUE_NAMES.sports, name: 'sync:fixtures', cron: '*/15 * * * *' },
  { queue: QUEUE_NAMES.sports, name: 'sync:live', cron: '* * * * *' },
  { queue: QUEUE_NAMES.odds, name: 'sync:odds', cron: '*/5 * * * *' },
  { queue: QUEUE_NAMES.odds, name: 'refresh:tip-odds', cron: '*/10 * * * *' },
  { queue: QUEUE_NAMES.results, name: 'sync:results', cron: '*/5 * * * *' },
  { queue: QUEUE_NAMES.results, name: 'settle:due', cron: '*/10 * * * *' },
  { queue: QUEUE_NAMES.tips, name: 'publish:due', cron: '* * * * *' },
  { queue: QUEUE_NAMES.tips, name: 'reminders:kickoff', cron: '*/5 * * * *' },
  { queue: QUEUE_NAMES.notifications, name: 'notification:scheduled', cron: '* * * * *' },
  { queue: QUEUE_NAMES.notifications, name: 'notification:receipts', cron: '*/10 * * * *' },
  { queue: QUEUE_NAMES.subscriptions, name: 'subscriptions:check', cron: '0 * * * *' },
  { queue: QUEUE_NAMES.subscriptions, name: 'subscriptions:reminders', cron: '0 9 * * *' },
  { queue: QUEUE_NAMES.statistics, name: 'stats:recompute', cron: '*/30 * * * *' },
  { queue: QUEUE_NAMES.maintenance, name: 'cleanup', cron: '30 3 * * *' },
  { queue: QUEUE_NAMES.maintenance, name: 'polls:close', cron: '*/5 * * * *' },
];

const workers: Worker[] = [];
const queues: Queue[] = [];

async function registerSchedules(): Promise<void> {
  const byQueue = new Map<string, Queue>();
  for (const schedule of SCHEDULES) {
    let queue = byQueue.get(schedule.queue);
    if (!queue) {
      queue = new Queue(schedule.queue, { connection: redis });
      byQueue.set(schedule.queue, queue);
      queues.push(queue);
    }
    await queue.add(schedule.name, schedule.data ?? {}, {
      repeat: { pattern: schedule.cron, tz: env.DEFAULT_TIMEZONE },
      jobId: `repeat:${schedule.name}`,
      removeOnComplete: { age: 3_600, count: 200 },
      removeOnFail: { age: 86_400 },
    });
  }
  logger.info({ schedules: SCHEDULES.length }, 'repeatable jobs registered');
}

function startWorkers(): void {
  for (const [queueName, handlers] of Object.entries(HANDLERS)) {
    const worker = new Worker(
      queueName,
      async (job) => {
        const handler = handlers[job.name];
        if (!handler) {
          logger.warn({ queue: queueName, job: job.name }, 'no handler registered — ignoring');
          return { ignored: true };
        }
        const started = Date.now();
        const result = await handler(job, job.token);
        logger.debug(
          { queue: queueName, job: job.name, ms: Date.now() - started },
          'job finished',
        );
        return result;
      },
      {
        connection: redis,
        concurrency: CONCURRENCY[queueName] ?? 2,
        // Fail a stalled job rather than letting it block the queue forever.
        maxStalledCount: 2,
        stalledInterval: 60_000,
      },
    );

    worker.on('failed', (job, error) => {
      logger.error(
        { queue: queueName, job: job?.name, attempts: job?.attemptsMade, err: error },
        'job failed',
      );
    });
    worker.on('error', (error) => logger.error({ err: error, queue: queueName }, 'worker error'));

    workers.push(worker);
  }
  logger.info({ queues: workers.length }, 'workers started');
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'worker shutting down');
  try {
    await Promise.all(workers.map((worker) => worker.close()));
    await Promise.all(queues.map((queue) => queue.close()));
    await closeRedis();
    await disconnectPrisma();
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, 'error during worker shutdown');
    process.exit(1);
  }
}

async function main(): Promise<void> {
  logger.info({ env: env.NODE_ENV, provider: env.SPORTS_PROVIDER }, 'PROFIT TIPS worker starting');
  startWorkers();
  await registerSchedules();

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      void shutdown(signal);
    });
  }
  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'unhandled rejection in worker');
  });
}

main().catch((error) => {
  logger.fatal({ err: error }, 'worker failed to start');
  process.exit(1);
});
