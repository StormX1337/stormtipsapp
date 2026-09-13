/** Public runtime configuration. Only NEXT_PUBLIC_* values reach the browser. */
export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  wsUrl: process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4000/ws',
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'PROFIT TIPS',
  stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
} as const;

export const apiBase = `${config.apiUrl}/api/v1`;
