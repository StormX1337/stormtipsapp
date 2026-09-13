import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import { REDIS_CHANNELS } from '@profit-tips/config';
import { verifyAccessToken } from '@profit-tips/auth';
import {
  WS_TOPICS,
  type BroadcastEnvelope,
  type ClientMessage,
  type ProductCode,
  type ServerMessage,
} from '@profit-tips/types';
import { logger } from '../lib/logger.js';
import { redisPublisher, redisSubscriber } from '../lib/redis.js';
import { entitlements } from '../services/entitlement.service.js';

interface Client {
  socket: WebSocket;
  userId: string | null;
  topics: Set<string>;
  isAlive: boolean;
}

const clients = new Set<Client>();

/** Topics that require an entitlement, and which product unlocks them. */
const TOPIC_PRODUCT: Record<string, ProductCode> = {
  [WS_TOPICS.tipsVip]: 'VIP',
  [WS_TOPICS.tipsExtra]: 'EXTRA',
  [WS_TOPICS.tipsCombo]: 'COMBO',
  [WS_TOPICS.tipsFixOdds]: 'FIX_ODDS',
};

const PUBLIC_TOPICS = new Set<string>([
  WS_TOPICS.liveEvents,
  WS_TOPICS.tipsFree,
  WS_TOPICS.polls,
  WS_TOPICS.odds,
]);

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState !== socket.OPEN) return;
  socket.send(JSON.stringify(message));
}

/**
 * Publishes to every API instance.
 *
 * The worker and the HTTP handlers both call this; Redis pub/sub is what lets
 * the gateway scale horizontally behind a load balancer.
 */
export async function broadcast(envelope: BroadcastEnvelope): Promise<void> {
  try {
    await redisPublisher.publish(REDIS_CHANNELS.broadcast, JSON.stringify(envelope));
  } catch (error) {
    logger.error({ err: error, topic: envelope.topic }, 'broadcast publish failed');
  }
}

function deliverLocally(envelope: BroadcastEnvelope): void {
  for (const client of clients) {
    if (envelope.userId && client.userId !== envelope.userId) continue;
    if (!client.topics.has(envelope.topic)) continue;
    send(client.socket, envelope.message);
  }
}

export const registerWebSocketGateway = fp(async function registerWebSocketGateway(
  app: FastifyInstance,
) {
  await redisSubscriber.subscribe(REDIS_CHANNELS.broadcast);
  redisSubscriber.on('message', (channel, payload) => {
    if (channel !== REDIS_CHANNELS.broadcast) return;
    try {
      deliverLocally(JSON.parse(payload) as BroadcastEnvelope);
    } catch (error) {
      logger.warn({ err: error }, 'malformed broadcast payload');
    }
  });

  // Drop sockets that stopped responding to pings.
  const heartbeat = setInterval(() => {
    for (const client of clients) {
      if (!client.isAlive) {
        client.socket.terminate();
        clients.delete(client);
        continue;
      }
      client.isAlive = false;
      try {
        client.socket.ping();
      } catch {
        clients.delete(client);
      }
    }
  }, 30_000);

  app.addHook('onClose', async () => {
    clearInterval(heartbeat);
    await redisSubscriber.unsubscribe(REDIS_CHANNELS.broadcast).catch(() => undefined);
  });

  app.get('/ws', { websocket: true }, (socket, request) => {
    const client: Client = { socket, userId: null, topics: new Set(), isAlive: true };
    clients.add(client);

    socket.on('pong', () => {
      client.isAlive = true;
    });

    const authorise = async (topics: string[]): Promise<{ granted: string[]; rejected: string[] }> => {
      const granted: string[] = [];
      const rejected: string[] = [];
      const products = await entitlements.productsFor(client.userId);
      for (const topic of topics) {
        if (PUBLIC_TOPICS.has(topic)) {
          granted.push(topic);
          continue;
        }
        const required = TOPIC_PRODUCT[topic];
        if (required && products.has(required)) granted.push(topic);
        else rejected.push(topic);
      }
      return { granted, rejected };
    };

    socket.on('message', (raw: Buffer) => {
      void (async () => {
        let message: ClientMessage;
        try {
          message = JSON.parse(raw.toString()) as ClientMessage;
        } catch {
          send(socket, { type: 'error', code: 'BAD_REQUEST', message: 'Malformed message' });
          return;
        }

        switch (message.type) {
          case 'ping':
            client.isAlive = true;
            send(socket, { type: 'pong', at: new Date().toISOString() });
            return;

          case 'auth': {
            try {
              const claims = await verifyAccessToken(message.token, app.tokenConfig);
              client.userId = claims.sub;
              // Re-authorise topics that were rejected before authentication.
              const { granted, rejected } = await authorise([...client.topics, ...Object.values(WS_TOPICS)]);
              client.topics = new Set(granted.filter((topic) => client.topics.has(topic)));
              send(socket, { type: 'subscribed', topics: [...client.topics], rejected });
            } catch {
              send(socket, { type: 'error', code: 'UNAUTHORIZED', message: 'Invalid token' });
            }
            return;
          }

          case 'subscribe': {
            const { granted, rejected } = await authorise(message.topics.slice(0, 20));
            for (const topic of granted) client.topics.add(topic);
            send(socket, { type: 'subscribed', topics: granted, rejected });
            return;
          }

          case 'unsubscribe':
            for (const topic of message.topics) client.topics.delete(topic);
            send(socket, { type: 'subscribed', topics: [...client.topics], rejected: [] });
            return;

          default:
            send(socket, { type: 'error', code: 'BAD_REQUEST', message: 'Unknown message type' });
        }
      })();
    });

    socket.on('close', () => {
      clients.delete(client);
    });
    socket.on('error', (error: Error) => {
      logger.debug({ err: error }, 'websocket error');
      clients.delete(client);
    });

    request.log.debug({ clients: clients.size }, 'websocket connected');
  });
});

export function connectedClients(): number {
  return clients.size;
}
