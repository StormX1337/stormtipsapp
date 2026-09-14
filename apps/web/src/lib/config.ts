/**
 * Public runtime configuration. Only NEXT_PUBLIC_* values reach the browser.
 *
 * `NEXT_PUBLIC_API_URL` is deliberately optional. Left unset, the browser talks
 * to this app's own origin and Next.js proxies `/api` through to the API (see
 * `next.config.ts`). One origin means no CORS to configure, no absolute URL
 * baked into the client bundle, and no need to expose the API port publicly —
 * which is what makes the app work from a phone without any further setup.
 *
 * Set it only when the API really is on another origin the browser must reach
 * directly; then that origin has to appear in the API's `CORS_ORIGINS`.
 */
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';

/**
 * A secret key pasted into the publishable slot would be baked into the client
 * bundle and served to every visitor. Dropping it degrades checkout to "not
 * configured", which is recoverable; shipping it is not.
 */
function publishableKey(): string {
  const value = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
  if (/^(sk|rk)_/.test(value)) {
    console.error(
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY holds a Stripe SECRET key and was ignored. ' +
        'Use the pk_ key, and roll the secret key in Stripe → Developers → API keys.',
    );
    return '';
  }
  return value;
}

export const config = {
  apiUrl,
  /**
   * Empty unless configured: Next.js rewrites do not proxy the WebSocket
   * upgrade, so realtime needs either a direct URL or a reverse proxy that
   * does (see `infra/nginx/nginx.conf`). Without it the live screen polls,
   * which is why it is not worth opening a connection that cannot succeed.
   */
  wsUrl: process.env.NEXT_PUBLIC_WS_URL ?? '',
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'STORM TIPS',
  stripePublishableKey: publishableKey(),
} as const;

/** Browser-side base. Relative when the proxy is used. */
export const apiBase = `${apiUrl}/api/v1`;

/**
 * Server-side base. A React Server Component's `fetch` cannot use a relative
 * URL, so it addresses the API directly — over the private network, not
 * through the browser-facing origin.
 */
export const serverApiBase = `${process.env.API_INTERNAL_URL ?? 'http://localhost:4000'}/api/v1`;
