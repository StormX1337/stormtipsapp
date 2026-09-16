/**
 * Whether a stored price id is one Stripe can actually charge.
 *
 * Older seeds wrote a plausible-looking `price_dev_…` placeholder. It satisfies
 * a plain "is one set?" check and then fails at Stripe with "No such price", so
 * the checkout, the price-sync script, the health check and the admin all ask
 * here instead — one rule, so they cannot drift apart.
 *
 * It lives in this package rather than `@storm-tips/payments` because the admin
 * console needs it too, and importing payments into a browser bundle drags in
 * the Google Play server SDK, which needs Node's `net` and fails the build.
 */
export function isUsableStripePriceId(priceId: string | null | undefined): priceId is string {
  return typeof priceId === 'string' && priceId.length > 0 && !priceId.startsWith('price_dev_');
}
