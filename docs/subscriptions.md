# Subscriptions and entitlements

## Products

| Code       | What it sells                           |
| ---------- | --------------------------------------- |
| `FREE`     | Always available; no entitlement needed |
| `VIP`      | The main premium feed                   |
| `EXTRA`    | Additional higher-variance selections   |
| `COMBO`    | Daily accumulators                      |
| `FIX_ODDS` | Packages that target a fixed odds range |

`FREE` is implicit — every user, signed in or not, has it.

## Plans

A `SubscriptionPlan` is what a customer buys. It carries:

- `products` — one or more product codes the plan unlocks (a bundle simply lists
  several);
- `price` in minor units plus a currency, and the derived `pricePerMonth`,
  `savings` and `savingsPercent` used by the paywall ribbons;
- `interval` / `intervalCount` / `months`;
- `trialDays`, `badge` (`MOST_POPULAR`, `BEST_VALUE`, `LIMITED`, `SALE`, `NEW`),
  `highlight`, `isPopular`;
- the vendor ids: `stripePriceId`, `appleProductId`, `googleProductId`.

The seed ships 1 / 3 / 6-month plans per product and a multi-product bundle;
everything is editable in the admin console, and nothing about pricing is
hard-coded in a client.

`FixOddsPlan` is a separate product shape: a target odds band, a maximum odds
cap, a minimum confidence, how many picks per period, and optional sport/league
restrictions.

## Subscription lifecycle

`SubscriptionStatus` is normalised across all three vendors:

| Status         | Grants access              | Meaning                                       |
| -------------- | -------------------------- | --------------------------------------------- |
| `INCOMPLETE`   | no                         | Checkout started, payment not confirmed       |
| `TRIALING`     | yes                        | Inside a free trial                           |
| `ACTIVE`       | yes                        | Paid and current                              |
| `PAST_DUE`     | yes                        | Payment failed, retries in progress           |
| `GRACE_PERIOD` | yes                        | Vendor grace window after a failed renewal    |
| `CANCELED`     | yes, until the period ends | Cancelled but paid through `currentPeriodEnd` |
| `PAUSED`       | no                         | Paused by the customer (Google Play)          |
| `EXPIRED`      | no                         | Period over, not renewed                      |

`subscriptionGrantsAccess()` in `@profit-tips/payments` is the single rule: the
status must be access-granting **and** the later of `currentPeriodEnd` and
`gracePeriodEndsAt` must still be in the future.

## Entitlements

An `Entitlement` row is `(user, product, grantedAt, expiresAt, revokedAt,
source)`. Sources are a subscription, a manual admin grant, or a referral
reward. Entitlements are derived state: the billing service rewrites them
whenever a subscription changes, and the admin console can grant or revoke one
directly (recorded in `AuditLog`).

`EntitlementService` is the only thing that answers "may this user see this?":

- reads the user's entitlement rows _and_ subscriptions;
- collapses them with the pure rules above into a set of products;
- caches the result in Redis for 60 seconds, and invalidates that cache
  explicitly on every subscription, entitlement or admin change.

Every premium read path in the API calls it — feeds, single tips, combos, the
WebSocket topic subscription and the paywall. A client that sets
`isLocked: false` on its own copy of a tip gains nothing: the fields were never
sent.

## Expiry

The worker runs `subscriptions:check` hourly. It moves lapsed subscriptions to
`EXPIRED`, revokes the derived entitlements and invalidates the cache.
`subscriptions:reminders` runs daily at 09:00 and notifies customers whose
subscription ends within the next few days — subject to their notification
preferences.

## Cancellation

- **Stripe** — `POST /billing/subscriptions/cancel` sets `cancelAtPeriodEnd`
  (or cancels immediately when asked). Access continues until the period ends.
- **Apple and Google** — the platforms require cancellation in the store. The
  API returns a `VALIDATION_ERROR` explaining exactly where to cancel, and the
  apps link straight to the store's subscription settings.

## Restore

`POST /billing/purchases/restore` re-derives entitlements from stored
subscriptions. On device, "Restore" additionally asks the store for the
account's purchases and re-verifies each one server-side, which covers a
reinstall or a new device.

## Referral rewards

A qualified referral grants a time-limited entitlement (or credit) through the
same entitlement table, so a rewarded user is indistinguishable from a paying
one at the access-control layer — and equally revocable.
