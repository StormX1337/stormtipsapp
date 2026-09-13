import { disconnectPrisma } from '@profit-tips/database';
import { buildServer } from './server.js';
import { env } from './lib/env.js';
import { logger } from './lib/logger.js';
import { closeRedis } from './lib/redis.js';
import { closeQueues } from './lib/queues.js';

async function start(): Promise<void> {
  const app = await buildServer();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutting down');
    try {
      // Stop accepting connections first, then release downstream resources.
      await app.close();
      await closeQueues();
      await closeRedis();
      await disconnectPrisma();
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, 'error during shutdown');
      process.exit(1);
    }
  };

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      void shutdown(signal);
    });
  }

  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'unhandled promise rejection');
  });
  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'uncaught exception — exiting');
    process.exit(1);
  });

  await app.listen({ port: env.API_PORT, host: env.API_HOST });
  logger.info(`PROFIT TIPS API listening on http://${env.API_HOST}:${env.API_PORT}`);
}

start().catch((error) => {
  logger.fatal({ err: error }, 'failed to start API');
  process.exit(1);
});
