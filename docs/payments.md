# Payments

Three providers, one internal shape. Every adapter in `@storm-tips/payments`
converts its vendor's payload into a `NormalizedSubscription` (and, where
applicable, a `NormalizedPayment`), so `apps/api/src/services/billing.service.ts`
has exactly one code path for granting, extending and revoking access.

```
Stripe webhook  ┐
Apple ASSN v2   ├─► adapter ─► NormalizedSubscription ─► Subscription row ─► Entitlement
Google RTDN     ┘
```

**The client never grants access.** A store purchase is sent to the API, the API
re-verifies it with Apple or Google, and only then is an entitlement written.
The mobile app finishes the store transaction after that call succeeds, so a
purchase the backend has not recorded is never lost.

## Where each credential goes

| Provider | Variables                                                                                                                              | Obtained from                                                                              |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Stripe   | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`                      | Stripe Dashboard → Developers → API keys / Webhooks                                        |
| Apple    | `APPLE_BUNDLE_ID`, `APPLE_ISSUER_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `APPLE_ENVIRONMENT`                                         | App Store Connect → Users and Access → Integrations → In-App Purchase key (`AuthKey_*.p8`) |
| Google   | `GOOGLE_PLAY_PACKAGE_NAME`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64`, `GOOGLE_PUBSUB_AUDIENCE`, `GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL` | Google Cloud service account with the _Android Publisher_ role, linked in Play Console     |

Without a credential the corresponding adapter throws `PROVIDER_ERROR` with a
message naming the missing variable. Nothing is stubbed out and no purchase is
ever treated as successful because a key is absent.

## Stripe (web)

Used for card payments on the website.

1. `POST /billing/checkout` with a `planId` creates a Checkout Session for the
   plan's `stripePriceId`, carrying the user id in metadata.
2. The customer completes payment on Stripe's page.
3. Stripe posts to `POST /api/v1/webhooks/stripe`. The raw body is kept so the
   signature can be verified with `STRIPE_WEBHOOK_SECRET`.
4. `billing.upsertSubscription()` writes the subscription and recomputes
   entitlements.

Handled events: `checkout.session.completed`,
`customer.subscription.created|updated|deleted|paused|resumed`, `invoice.paid`,
`invoice.payment_succeeded`, `invoice.payment_failed`, `charge.refunded`.

`POST /billing/portal` returns a Stripe customer-portal URL for self-service
payment-method and cancellation management.

### Local testing

```bash
stripe listen --forward-to localhost:4000/api/v1/webhooks/stripe
stripe trigger checkout.session.completed
```

Copy the `whsec_…` that `stripe listen` prints into `STRIPE_WEBHOOK_SECRET`.

### Going live

The code needs no changes; what it needs is a price to charge and somewhere for
Stripe to call back.

1. **Keys.** Stripe Dashboard → Developers → API keys. Put the secret key in
   `STRIPE_SECRET_KEY` and the publishable one in both `STRIPE_PUBLISHABLE_KEY`
   and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. Test keys (`sk_test_…`) charge
   nothing and are the right place to start.

2. **A product and a price per plan.** One command does all of them:

   ```bash
   pnpm --filter @storm-tips/database stripe-sync-prices            # shows the plan
   pnpm --filter @storm-tips/database stripe-sync-prices -- --apply # creates them
   ```

   It reads the plans from the database, creates the matching product and
   recurring price in Stripe and writes each `price_…` back onto its plan. It
   uses the `STRIPE_SECRET_KEY` in `.env`, so the key never leaves the server.
   Plans that already carry a price id are left alone, and a product from an
   earlier run is reused rather than duplicated — it is found by the plan's
   slug in the product's metadata.

   By hand instead: Products → Add product, then a recurring price whose amount
   and interval match the plan, and paste its id into Admin → Plans →
   _Stripe Price ID_.

   A plan without a price id cannot be checked out: `POST /billing/checkout`
   has nothing to charge and says so.

   Stripe prices are immutable. Changing a plan's amount or interval means a
   new price: clear the plan's Stripe Price ID and run the command again.

3. **The webhook.** Developers → Webhooks → Add endpoint, pointing at
   `https://<your domain>/api/v1/webhooks/stripe`, subscribed to
   `checkout.session.completed`,
   `customer.subscription.created|updated|deleted|paused|resumed`,
   `invoice.paid`, `invoice.payment_succeeded`, `invoice.payment_failed` and
   `charge.refunded`. Put its signing secret in `STRIPE_WEBHOOK_SECRET`.

   This is the step that actually grants access — the browser returning from
   Stripe proves nothing, so the entitlement is written when the webhook
   arrives. An endpoint Stripe cannot reach means paid customers with no
   access, which is why the reverse proxy exempts `/api/v1/webhooks/` from the
   visitor rate limit.

4. **Return URLs.** `STRIPE_SUCCESS_URL` and `STRIPE_CANCEL_URL` must be public
   URLs on your own domain, not `localhost`.

5. **Check it.** Pay with Stripe's test card `4242 4242 4242 4242`, any future
   expiry and any CVC. The webhook's delivery attempt is visible in the
   dashboard, and the subscription appears under Admin → Subscriptions.

Switching to live keys later changes nothing but the keys: price ids are
per-mode, so swap in the live key, clear the test ids and run
`stripe-sync-prices -- --apply` again.

## Apple (iOS in-app subscriptions)

1. The app calls `purchaseSubscription(appleProductId)` (`react-native-iap`).
2. On success the signed StoreKit 2 transaction goes to
   `POST /billing/purchases/verify`.
3. The adapter verifies the JWS signature against Apple's root certificates and
   calls the App Store Server API for the subscription's current state.
4. App Store Server Notifications v2 arrive at `POST /api/v1/webhooks/apple` for
   renewals, refunds and revocations.

Entitlement-changing notification types: `SUBSCRIBED`, `DID_RENEW`,
`DID_CHANGE_RENEWAL_STATUS`, `DID_CHANGE_RENEWAL_PREF`, `EXPIRED`,
`GRACE_PERIOD_EXPIRED`, `DID_FAIL_TO_RENEW`, `REFUND`, `REVOKE`,
`OFFER_REDEEMED`.

Set `APPLE_ENVIRONMENT=Sandbox` while testing; the adapter then talks to the
sandbox endpoints. A sandbox receipt presented to production is rejected.

## Google Play (Android in-app subscriptions)

1. The app purchases the `googleProductId`.
2. The purchase token goes to `POST /billing/purchases/verify`.
3. The adapter calls `purchases.subscriptionsv2.get` with the service account
   and acknowledges the purchase.
4. Real-time developer notifications arrive through Pub/Sub at
   `POST /api/v1/webhooks/google`; the push request's OIDC token is checked
   against `GOOGLE_PUBSUB_AUDIENCE` and
   `GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL`.

Notification types 1–13 and 20 are mapped to their names before handling.

## Idempotency

Every webhook first claims its event id in `WebhookEvent` (unique per provider +
event id). A replay finds the row and is ignored; a failed handler marks the row
so it can be retried. This is what stops a redelivered renewal from extending a
subscription twice.

## Refunds and chargebacks

`charge.refunded` (Stripe), `REFUND`/`REVOKE` (Apple) and
`SUBSCRIPTION_REVOKED` (Google) all end the subscription and revoke the derived
entitlements immediately. The payment row keeps the refunded amount so revenue
reporting stays correct.

## Prices, coupons and currencies

Plans carry prices in minor units plus a currency; `packages/payments/pricing.ts`
derives the per-month figure, savings versus the monthly plan and the discounted
total for a coupon. `POST /billing/coupons/validate` returns that preview before
checkout so the number shown to the customer is the number that is charged.

Supported currencies are EUR, USD and GBP. Store products carry their own
localised prices, which the app reads from the store and shows in place of the
plan price when they differ.

## Testing without real credentials

`packages/payments/tests/payments.test.ts` covers the normalisation of each
provider's payloads and the entitlement derivation using recorded fixtures, so
the logic is verified without contacting any vendor.
