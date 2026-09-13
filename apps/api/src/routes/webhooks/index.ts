import type { FastifyInstance } from 'fastify';
import { AppError, ErrorCode } from '@profit-tips/types';
import { billing } from '../../services/billing.service.js';
import { referrals } from '../../services/referral.service.js';
import { logger } from '../../lib/logger.js';

/**
 * Payment webhooks.
 *
 * Every handler follows the same three steps:
 *   1. verify the signature (a forged call must never reach step 2),
 *   2. claim the event id so a retry is a no-op,
 *   3. apply the normalised payload and mark the event processed.
 *
 * Handlers always answer 2xx once the event is recorded, so providers stop
 * retrying even when downstream processing needs a follow-up.
 */
export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  // Webhooks are authenticated by signature, not by token; a generous limit
  // avoids dropping a legitimate burst of provider retries.
  const limit = { config: { rateLimit: { max: 600, timeWindow: '1 minute' } } };

  app.post('/stripe', limit, async (request, reply) => {
    const signature = request.headers['stripe-signature'];
    const rawBody = (request as { rawBody?: Buffer }).rawBody;
    if (typeof signature !== 'string' || !rawBody) {
      throw new AppError(ErrorCode.WEBHOOK_SIGNATURE_INVALID, 'Missing Stripe signature or body');
    }

    const event = billing.stripe.constructEvent(rawBody, signature);
    const fresh = await billing.claimWebhook('STRIPE', event.id, event.type, event);
    if (!fresh) return reply.status(200).send({ received: true, duplicate: true });

    try {
      const envelope = await billing.stripe.normalizeEvent(event);
      await billing.applyWebhook(envelope);

      // A first successful payment qualifies the referral that introduced the user.
      if (envelope.payment?.status === 'SUCCEEDED' && envelope.payment.userRef) {
        await referrals.qualify(envelope.payment.userRef, envelope.payment.amountCents);
      }
      await billing.completeWebhook('STRIPE', event.id, 'PROCESSED');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await billing.completeWebhook('STRIPE', event.id, 'FAILED', message);
      logger.error({ err: error, eventId: event.id }, 'stripe webhook processing failed');
      // 500 so Stripe retries — the event row records the failure for replay.
      return reply.status(500).send({ received: false });
    }

    return reply.status(200).send({ received: true });
  });

  app.post('/apple', limit, async (request, reply) => {
    const body = request.body as { signedPayload?: string };
    if (!body?.signedPayload) {
      throw new AppError(ErrorCode.WEBHOOK_SIGNATURE_INVALID, 'Missing signedPayload');
    }

    const envelope = await billing.apple.handleNotification(body.signedPayload);
    const fresh = await billing.claimWebhook('APPLE', envelope.eventId, envelope.type, envelope.raw);
    if (!fresh) return reply.status(200).send({ received: true, duplicate: true });

    try {
      await billing.applyWebhook(envelope);
      await billing.completeWebhook('APPLE', envelope.eventId, 'PROCESSED');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await billing.completeWebhook('APPLE', envelope.eventId, 'FAILED', message);
      logger.error({ err: error, eventId: envelope.eventId }, 'apple notification failed');
      return reply.status(500).send({ received: false });
    }

    return reply.status(200).send({ received: true });
  });

  app.post('/google', limit, async (request, reply) => {
    await billing.google.verifyPushToken(request.headers.authorization);

    const { message, messageId } = billing.google.decodePushBody(
      request.body as { message?: { data?: string; messageId?: string } },
    );

    const fresh = await billing.claimWebhook(
      'GOOGLE',
      messageId,
      message.subscriptionNotification ? 'subscription' : 'other',
      message,
    );
    // Pub/Sub requires a 2xx or it redelivers forever.
    if (!fresh) return reply.status(204).send();

    try {
      const envelope = await billing.google.handleNotification(message, messageId);
      await billing.applyWebhook(envelope);
      await billing.completeWebhook('GOOGLE', messageId, 'PROCESSED');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await billing.completeWebhook('GOOGLE', messageId, 'FAILED', errorMessage);
      logger.error({ err: error, messageId }, 'google RTDN processing failed');
      return reply.status(500).send({ received: false });
    }

    return reply.status(204).send();
  });
}
