import { Worker, Queue } from 'bullmq';
import { disconnectPrisma } from '@storm-tips/database';
import { env } from '@storm-tips/api/lib/env';
import { logger } from '@storm-tips/api/lib/logger';
import { redis, closeRedis } from '@storm-tips/api/lib/redis';
import { CONCURRENCY, HANDLERS, SCHEDULES } from './registry.js';

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
        logger.debug({ queue: queueName, job: job.name, ms: Date.now() - started }, 'job finished');
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
  logger.info({ env: env.NODE_ENV, provider: env.SPORTS_PROVIDER }, 'STORM TIPS worker starting');
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
