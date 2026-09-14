# API

Fastify 5, ESM TypeScript. Base path `/api/v1`. A machine-readable description
is served at `GET /api/v1/openapi.json`.

## Conventions

- JSON in, JSON out. Request bodies, query strings and path parameters are
  validated with the Zod schemas in `@storm-tips/types`, so client and server
  agree on one definition.
- Errors always use the same envelope:

  ```json
  { "error": { "code": "ENTITLEMENT_REQUIRED", "message": "…", "requestId": "…" } }
  ```

- Money is returned as `{ amountCents, currency, formatted }` — the server
  formats for the caller's locale so no two clients round differently.
- Timestamps are ISO-8601 UTC strings.
- Responses are English. `Accept-Language` is not read, so a visitor whose
  browser prefers another language gets a complete page rather than blank
  fields. Cacheable responses carry `Vary: authorization`, which is what keeps
  a shared cache from serving a signed-in payload to an anonymous visitor. See
  [localization.md](localization.md).

### Error codes

| Code                                                                 | HTTP      | Meaning                                                       |
| -------------------------------------------------------------------- | --------- | ------------------------------------------------------------- |
| `VALIDATION_ERROR`                                                   | 422       | Request failed schema validation (`details` lists the fields) |
| `UNAUTHORIZED` / `TOKEN_EXPIRED`                                     | 401       | Missing or expired access token                               |
| `INVALID_CREDENTIALS`                                                | 401       | Wrong email or password                                       |
| `TOKEN_REUSED`                                                       | 401       | A rotated refresh token was replayed; the family is revoked   |
| `FORBIDDEN` / `ACCOUNT_BANNED` / `EMAIL_NOT_VERIFIED`                | 403       | Authenticated but not allowed                                 |
| `NOT_FOUND`                                                          | 404       | Unknown resource                                              |
| `CONFLICT` / `ALREADY_SETTLED`                                       | 409       | State already changed                                         |
| `PAYMENT_REQUIRED` / `ENTITLEMENT_REQUIRED` / `SUBSCRIPTION_EXPIRED` | 402       | Premium content without an entitlement                        |
| `COUPON_INVALID`                                                     | 422       | Coupon expired, exhausted or not applicable                   |
| `RATE_LIMITED`                                                       | 429       | Bucket exhausted; `retry-after` is set                        |
| `WEBHOOK_SIGNATURE_INVALID`                                          | 400       | Webhook signature check failed                                |
| `PROVIDER_ERROR` / `SERVICE_UNAVAILABLE`                             | 502 / 503 | Upstream problem                                              |

## Authentication

Access tokens are short-lived JWTs (15 minutes by default); refresh tokens live
for 30 days and are **rotated on every use**. Each refresh token belongs to a
family; presenting an already-rotated token revokes the whole family and returns
`TOKEN_REUSED`. Only hashes of refresh tokens are stored.

```http
Authorization: Bearer <access token>
```

| Method       | Path                                              | Notes                                               |
| ------------ | ------------------------------------------------- | --------------------------------------------------- |
| POST         | `/auth/register`                                  | Requires `acceptedTerms` and `ageConfirmed`         |
| POST         | `/auth/login`                                     | Credential bucket: `AUTH_RATE_LIMIT_MAX` per window |
| POST         | `/auth/refresh`                                   | Rotates the token pair                              |
| POST         | `/auth/logout`                                    | Revokes the presented refresh token                 |
| POST         | `/auth/oauth`                                     | Google / Apple identity token exchange              |
| POST         | `/auth/forgot-password`                           | Always 204, so addresses cannot be probed           |
| POST         | `/auth/reset-password`                            | Consumes a single-use token                         |
| POST         | `/auth/change-password`                           | Authenticated; revokes other sessions               |
| POST         | `/auth/verify-email`, `/auth/resend-verification` | Email verification                                  |
| GET / DELETE | `/auth/sessions`, `/auth/sessions/:familyId`      | List and revoke devices                             |

## Account

| Method               | Path                                  | Notes                                                |
| -------------------- | ------------------------------------- | ---------------------------------------------------- |
| GET / PATCH / DELETE | `/me`                                 | Profile; delete anonymises and revokes every session |
| GET                  | `/me/entitlements`                    | Effective product access                             |
| GET                  | `/me/subscriptions`, `/me/payments`   | Billing history                                      |
| GET                  | `/me/notifications`                   | Inbox (`POST /:id/read`, `POST /read-all`)           |
| POST / DELETE        | `/me/devices`, `/me/devices/:token`   | Push token registration                              |
| GET                  | `/me/referrals`, `/me/referrals/list` | Referral programme                                   |

## Catalogue

`GET /sports`, `/countries`, `/leagues`, `/leagues/:id`, `/leagues/:id/teams`,
`/teams`, `/bookmakers`, `/events`, `/events/live`, `/events/:id`, `/odds`,
`/odds/:id/history`. All public and cacheable.

## Tips

| Method | Path                                                                      | Notes                                       |
| ------ | ------------------------------------------------------------------------- | ------------------------------------------- |
| GET    | `/tips/free`, `/tips/vip`, `/tips/extra`, `/tips/combo`, `/tips/fix-odds` | Feed grouped by league, `?date=YYYY-MM-DD`  |
| GET    | `/tips/<product>/list`                                                    | The same tips, ungrouped and paginated      |
| GET    | `/tips/combo/groups`, `/tips/combo/groups/:id`                            | Accumulators                                |
| GET    | `/tips/fix-odds/plans`                                                    | Fix Odds packages on sale                   |
| GET    | `/tips/live`                                                              | Tips on events in play                      |
| GET    | `/tips/history`                                                           | Verified results archive (public by design) |
| GET    | `/tips/:id`                                                               | One tip                                     |
| GET    | `/tips/:product/headline`                                                 | The figures behind a paywall                |

These endpoints use _optional_ authentication: an anonymous visitor still gets
the feed, but premium tips arrive **locked**.

### What "locked" means

`isLocked: true` is not a client-side flag to honour — the server has already
removed the premium fields:

```json
{
  "id": "…", "product": "VIP", "isLocked": true,
  "selectionLabel": null, "selectionKey": null,
  "odds": null, "currentOdds": null, "analysis": null,
  "event": { … }, "league": { … }
}
```

The event, league and kickoff stay visible so the feed still reads as a feed.
Selection, odds and analysis never leave the server without an entitlement.

## Statistics

| Method | Path                           | Notes                                     |
| ------ | ------------------------------ | ----------------------------------------- |
| GET    | `/statistics?product=&window=` | Full breakdown for one product            |
| GET    | `/statistics/overview?window=` | Every product side by side                |
| GET    | `/statistics/snapshots`        | Persisted daily snapshots for long charts |

`window` is `D7`, `D30`, `D90`, `M6`, `M12` or `ALL`. Every figure is computed
from settled tips with a flat theoretical stake (`STATISTICS_STAKE`); nothing is
stored as a hand-entered number.

## Billing

| Method | Path                                                             | Notes                                               |
| ------ | ---------------------------------------------------------------- | --------------------------------------------------- |
| GET    | `/billing/products`, `/billing/plans`, `/billing/fix-odds-plans` | Catalogue                                           |
| GET    | `/billing/paywall/:product`                                      | Everything one paywall screen needs                 |
| GET    | `/billing/promotions`                                            | Audience-filtered banners                           |
| POST   | `/billing/coupons/validate`                                      | Price preview                                       |
| POST   | `/billing/checkout`                                              | Stripe Checkout session                             |
| POST   | `/billing/portal`                                                | Stripe customer portal                              |
| POST   | `/billing/purchases/verify`                                      | Verifies an Apple/Google receipt server-side        |
| POST   | `/billing/purchases/restore`                                     | Re-derives entitlements from stored state           |
| POST   | `/billing/subscriptions/cancel`                                  | Stripe only — store subs are cancelled in the store |

## Polls, analytics, webhooks

- `GET /polls`, `GET /polls/:id`, `POST /polls/:id/vote`
- `POST /analytics/events` and `POST /analytics/batch` — pseudonymous product events, no IP stored
- `POST /webhooks/stripe`, `/webhooks/apple`, `/webhooks/google` — signature
  verified, replay-protected through `WebhookEvent`

## Admin

Everything under `/admin` requires an `ADMIN` (or `EDITOR`, where applicable)
role and is written to `AuditLog`: dashboard, tips and combos (including
`publish` and `resettle`), users (including `ban` and `logout-all`), commerce
(plans, Fix Odds plans, coupons, promotions, payments, subscriptions),
catalogue, polls, notifications, providers, settings, logs, statistics and
reports.

## Rate limiting

Two buckets, both Redis-backed so they hold across instances: a global one
(`RATE_LIMIT_MAX` per `RATE_LIMIT_WINDOW`) and a stricter credential bucket
(`AUTH_RATE_LIMIT_MAX`) on login, registration and password reset. Responses
carry `x-ratelimit-limit`, `x-ratelimit-remaining` and `x-ratelimit-reset`.

## WebSocket

Connect to `/ws`. Messages are JSON.

```jsonc
// client → server
{ "type": "auth", "token": "<access token>" }
{ "type": "subscribe", "topics": ["live:events", "tips:VIP"] }
{ "type": "unsubscribe", "topics": ["odds"] }
{ "type": "ping" }
```

```jsonc
// server → client
{ "type": "subscribed", "topics": ["live:events"], "rejected": ["tips:VIP"] }
{ "type": "tip.published", "topic": "tips:FREE", "payload": { … } }
{ "type": "tip.settled",  "topic": "tips:FREE", "payload": { … } }
{ "type": "tip.odds",     "topic": "odds", "payload": { "tipId": "…", "currentOdds": 1.9, "oddsChanged": true } }
{ "type": "event.update", "topic": "live:events", "payload": { … } }
{ "type": "poll.update",  "topic": "polls", "payload": { … } }
{ "type": "pong", "at": "…" }
```

Public topics are `live:events`, `tips:FREE`, `polls` and `odds`. The premium
topics (`tips:VIP`, `tips:EXTRA`, `tips:COMBO`, `tips:FIX_ODDS`) are checked
against the same entitlement service as the REST feeds, and a subscription
without the entitlement is returned in `rejected` rather than silently ignored.

Broadcasts go through Redis pub/sub, so the worker can push to clients connected
to any API instance.

## Health and metrics

`GET /health` (liveness), `GET /ready` (database and Redis reachable) and
`GET /metrics` (Prometheus text format, enabled by `METRICS_ENABLED`) are served
outside the versioned prefix.
