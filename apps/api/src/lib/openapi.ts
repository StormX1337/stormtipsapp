import { z } from 'zod';
import {
  checkoutSchema,
  createTipSchema,
  loginSchema,
  registerSchema,
  statisticsQuerySchema,
  tipFeedQuerySchema,
  verifyStorePurchaseSchema,
  voteSchema,
} from '@storm-tips/types';
import { API_PREFIX, APP_NAME } from '@storm-tips/config';
import { env } from './env.js';

type JsonSchema = Record<string, unknown>;

/** Zod → JSON Schema for the documented request bodies. */
function toJson(schema: z.ZodType): JsonSchema {
  return z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as JsonSchema;
}

const errorResponse: JsonSchema = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: {},
        requestId: { type: 'string' },
      },
      required: ['code', 'message'],
    },
  },
};

const bearer = [{ bearerAuth: [] as string[] }];

function operation(
  summary: string,
  tag: string,
  options: {
    secured?: boolean;
    body?: z.ZodType;
    query?: z.ZodType;
    responses?: Record<string, string>;
  } = {},
): JsonSchema {
  const parameters: JsonSchema[] = [];
  if (options.query) {
    const json = toJson(options.query);
    const properties = (json.properties ?? {}) as Record<string, JsonSchema>;
    for (const [name, schema] of Object.entries(properties)) {
      parameters.push({
        name,
        in: 'query',
        required: Array.isArray(json.required) && json.required.includes(name),
        schema,
      });
    }
  }

  return {
    summary,
    tags: [tag],
    ...(options.secured ? { security: bearer } : {}),
    ...(parameters.length > 0 ? { parameters } : {}),
    ...(options.body
      ? {
          requestBody: {
            required: true,
            content: { 'application/json': { schema: toJson(options.body) } },
          },
        }
      : {}),
    responses: {
      '200': { description: options.responses?.['200'] ?? 'Success' },
      '401': {
        description: 'Unauthenticated',
        content: { 'application/json': { schema: errorResponse } },
      },
      '402': {
        description: 'A subscription is required for this content',
        content: { 'application/json': { schema: errorResponse } },
      },
      '422': {
        description: 'Validation failed',
        content: { 'application/json': { schema: errorResponse } },
      },
      '429': {
        description: 'Rate limited',
        content: { 'application/json': { schema: errorResponse } },
      },
    },
  };
}

/**
 * Hand-assembled OpenAPI description of the public surface.
 *
 * Request bodies are generated from the same Zod schemas the handlers validate
 * with, so the document cannot drift from the implementation.
 */
export function openApiDocument(): JsonSchema {
  return {
    openapi: '3.1.0',
    info: {
      title: `${APP_NAME} API`,
      version: '1.0.0',
      description:
        'Sports analysis platform API. Premium content is gated server-side by entitlements; ' +
        'locked tips are returned with their premium fields removed.',
    },
    servers: [{ url: `${env.API_PUBLIC_URL}${API_PREFIX}` }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    tags: [
      { name: 'Auth' },
      { name: 'Profile' },
      { name: 'Catalogue' },
      { name: 'Tips' },
      { name: 'Statistics' },
      { name: 'Billing' },
      { name: 'Polls' },
      { name: 'Admin' },
      { name: 'Webhooks' },
    ],
    paths: {
      '/auth/register': { post: operation('Create an account', 'Auth', { body: registerSchema }) },
      '/auth/login': { post: operation('Log in', 'Auth', { body: loginSchema }) },
      '/auth/refresh': { post: operation('Rotate the refresh token', 'Auth') },
      '/auth/logout': { post: operation('Log out', 'Auth', { secured: true }) },
      '/auth/oauth': { post: operation('Sign in with Google or Apple', 'Auth') },
      '/auth/forgot-password': { post: operation('Request a password reset', 'Auth') },
      '/auth/reset-password': { post: operation('Complete a password reset', 'Auth') },
      '/me': {
        get: operation('Current user', 'Profile', { secured: true }),
        patch: operation('Update the profile', 'Profile', { secured: true }),
        delete: operation('Delete the account', 'Profile', { secured: true }),
      },
      '/me/subscriptions': { get: operation('My subscriptions', 'Profile', { secured: true }) },
      '/me/payments': { get: operation('My purchase history', 'Profile', { secured: true }) },
      '/me/devices': { post: operation('Register a push token', 'Profile', { secured: true }) },
      '/me/referrals': { get: operation('Referral summary', 'Profile', { secured: true }) },
      '/sports': { get: operation('List sports', 'Catalogue') },
      '/leagues': { get: operation('List leagues', 'Catalogue') },
      '/events': { get: operation('List events', 'Catalogue') },
      '/odds': { get: operation('Odds for one event', 'Catalogue') },
      '/tips/free': { get: operation('Free tip feed', 'Tips', { query: tipFeedQuerySchema }) },
      '/tips/vip': {
        get: operation('VIP tip feed (locked without entitlement)', 'Tips', {
          query: tipFeedQuerySchema,
        }),
      },
      '/tips/extra': { get: operation('Extra tip feed', 'Tips', { query: tipFeedQuerySchema }) },
      '/tips/combo': { get: operation('Combo tip feed', 'Tips', { query: tipFeedQuerySchema }) },
      '/tips/fix-odds': { get: operation('Fix Odds feed', 'Tips', { query: tipFeedQuerySchema }) },
      '/tips/combo/groups': { get: operation('Combo accumulators', 'Tips') },
      '/tips/history': { get: operation('Verified results history', 'Tips') },
      '/tips/live': { get: operation('Live tips', 'Tips') },
      '/tips/{id}': { get: operation('One tip', 'Tips') },
      '/statistics': {
        get: operation('Computed performance statistics', 'Statistics', {
          query: statisticsQuerySchema,
        }),
      },
      '/statistics/overview': { get: operation('Statistics for every product', 'Statistics') },
      '/billing/plans': { get: operation('Active subscription plans', 'Billing') },
      '/billing/paywall/{product}': { get: operation('Paywall payload for a product', 'Billing') },
      '/billing/checkout': {
        post: operation('Create a Stripe checkout session', 'Billing', {
          secured: true,
          body: checkoutSchema,
        }),
      },
      '/billing/purchases/verify': {
        post: operation('Verify an App Store / Play Store purchase', 'Billing', {
          secured: true,
          body: verifyStorePurchaseSchema,
        }),
      },
      '/billing/purchases/restore': {
        post: operation('Restore purchases', 'Billing', { secured: true }),
      },
      '/polls': { get: operation('Active polls', 'Polls') },
      '/polls/{id}/vote': {
        post: operation('Vote in a poll', 'Polls', { secured: true, body: voteSchema }),
      },
      '/admin/tips': {
        get: operation('List every tip', 'Admin', { secured: true }),
        post: operation('Create a tip', 'Admin', { secured: true, body: createTipSchema }),
      },
      '/admin/tips/{id}/settle': {
        post: operation('Settle a tip manually', 'Admin', { secured: true }),
      },
      '/admin/dashboard': { get: operation('Operational dashboard', 'Admin', { secured: true }) },
      '/webhooks/stripe': { post: operation('Stripe webhook (signature verified)', 'Webhooks') },
      '/webhooks/apple': { post: operation('App Store Server Notification V2', 'Webhooks') },
      '/webhooks/google': { post: operation('Google Play RTDN (Pub/Sub push)', 'Webhooks') },
    },
  };
}
