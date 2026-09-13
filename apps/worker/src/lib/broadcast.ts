import { REDIS_CHANNELS } from '@profit-tips/config';
import type { BroadcastEnvelope } from '@profit-tips/types';
import { redisPublisher } from '@profit-tips/api/lib/redis';
import { logger } from '@profit-tips/api/lib/logger';

/**
 * Publishes a realtime message from the worker.
 *
 * The worker has no sockets of its own; every API instance subscribes to this
 * Redis channel and relays the message to its own connected clients.
 */
export async function publish(envelope: BroadcastEnvelope): Promise<void> {
  try {
    await redisPublisher.publish(REDIS_CHANNELS.broadcast, JSON.stringify(envelope));
  } catch (error) {
    logger.error({ err: error, topic: envelope.topic }, 'worker broadcast failed');
  }
}
