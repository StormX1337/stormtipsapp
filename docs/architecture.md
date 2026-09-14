# STORM TIPS — Architecture

## 1. System overview

```
                    ┌──────────────────────────────────────────────┐
                    │                  Clients                     │
   iOS / Android ──▶│  apps/mobile   (Expo SDK 54 · expo-router)   │
   Browser       ──▶│  apps/web      (Next.js 15 · App Router)     │
   Operators     ──▶│  apps/admin    (Next.js 15 · admin console)  │
                    └───────────────┬──────────────────────────────┘
                                    │ HTTPS  /api/v1   +  WSS /ws
                    ┌───────────────▼──────────────────────────────┐
                    │  apps/api — Fastify 5 (TypeScript, ESM)      │
                    │  auth · entitlements · tips · odds · stats   │
                    │  polls · payments · webhooks · admin · ws    │
                    └───┬───────────────┬──────────────┬───────────┘
                        │               │              │
                ┌───────▼──────┐ ┌──────▼──────┐ ┌─────▼────────────┐
                │ PostgreSQL16 │ │   Redis 7   │ │ external systems │
                │  (Prisma)    │ │ cache·queue │ │ Stripe·Apple·    │
                └───────▲──────┘ └──────▲──────┘ │ Google·Expo·FCM· │
                        │               │        │ sports providers │
                    ┌───┴───────────────┴───┐    └──────────────────┘
                    │ apps/worker (BullMQ)  │
                    │ fixtures · odds ·     │
                    │ results · stats ·     │
                    │ notifications · subs  │
                    └───────────────────────┘
```

Everything is one **pnpm workspace** monorepo; domain logic lives in `packages/*` so that the
API, the worker and the tests all execute exactly the same code.

## 2. Workspace layout

```
apps/
  api/        Fastify REST + WebSocket server              (port 4000)
  worker/     BullMQ workers & repeatable (cron) jobs
  web/        Next.js user-facing web app                  (port 3000)
  admin/      Next.js admin dashboard                      (port 3001)
  mobile/     Expo / React Native application
packages/
  config/     Shared tsconfig/eslint/prettier + runtime env loader (zod-validated)
  types/      Shared domain types, enums, Zod contracts, i18n message keys
  database/   Prisma schema, migrations, client singleton, seed
  auth/       Password hashing, JWT access/refresh rotation, OAuth verifiers
  sports/     SportsDataProvider interface + SportsGameOdds / TheOddsAPI / Mock adapters
  payments/   Stripe / Apple / Google adapters → NormalizedSubscription
  statistics/ Settlement engine, combo maths, statistics aggregation (pure functions)
  notifications/ Expo push · FCM v1 · APNs transports + templating
  ui/         Design tokens, formatters, i18n catalogues and legal copy (web + mobile)
infra/
  docker/     Dockerfiles for api / worker / web / admin + docker-compose stack
  nginx/      TLS terminating reverse proxy config
.github/
  workflows/  CI (lint · typecheck · test · build · images), release, CodeQL
docs/
```

## 3. Runtime processes

| Process    | Command           | Responsibility                                               |
| ---------- | ----------------- | ------------------------------------------------------------ |
| `api`      | `pnpm dev:api`    | Stateless HTTP + WS. Horizontally scalable.                  |
| `worker`   | `pnpm dev:worker` | All scheduled + background work. Single queue, many workers. |
| `web`      | `pnpm dev:web`    | Next.js SSR/ISR.                                             |
| `admin`    | `pnpm dev:admin`  | Next.js, admin-only.                                         |
| `postgres` | docker            | System of record.                                            |
| `redis`    | docker            | Cache, rate-limit counters, BullMQ, WS fan-out (pub/sub).    |

## 4. Request lifecycle

1. `requestId` hook assigns/propagates `x-request-id`; `pino` child logger binds it.
2. `@fastify/helmet` + `@fastify/cors` apply security headers / origin allowlist.
3. `@fastify/rate-limit` (Redis store) applies a global limit; sensitive routes add a stricter one.
4. Zod validates `params` / `query` / `body`; failures become `422 VALIDATION_ERROR`.
5. `authenticate` pre-handler verifies the access JWT and loads a slim user record.
6. `requireEntitlement('VIP')` (or `COMBO`/`EXTRA`/`FIX_ODDS`) consults `EntitlementService`,
   which reads **subscriptions in the database**, never a client claim.
7. Handler runs; responses are serialized by Fastify's schema compiler.
8. `errorHandler` maps `AppError` → `{ error: { code, message, details, requestId } }`.

## 5. Data model (high level)

Identity: `User` → `Session`(refresh-token family) → `AuditLog`
Catalogue: `Sport` → `Country` → `League` → `Team` → `Event`
Odds: `Bookmaker`, `Market`, `Odd`, `OddsHistory`
Content: `Tip` (+ `TipResult`), `Combo` → `ComboItem`
Commerce: `Product`, `SubscriptionPlan`, `Subscription`, `Entitlement`, `Payment`,
`Invoice`, `Coupon`, `CouponRedemption`, `Promotion`, `WebhookEvent`
Engagement: `Poll` → `PollOption` → `PollVote`, `Notification`, `DeviceToken`,
`Referral`, `ReferralReward`
Ops: `ApiProvider`, `StatisticsSnapshot`, `AnalyticsEvent`

Full ERD and index rationale: [`docs/database.md`](./database.md).

## 6. Premium access model

```
SubscriptionPlan ──includes──▶ Product(VIP | COMBO | EXTRA | FIX_ODDS)
        ▲                                   │
        │ purchased via Stripe/Apple/Google │ grants
        │                                   ▼
      Subscription ─────────────────────▶ Entitlement(userId, product, expiresAt, source)
```

- A `Subscription` row is created/updated **only** by a verified webhook or a verified
  store receipt — never by the client.
- `Entitlement` rows are derived; admins can also grant/revoke them manually
  (`source = ADMIN_GRANT`) which is fully audit-logged.
- `EntitlementService.has(userId, product)` is the only place access is decided, and it is
  called by REST handlers, the WS gateway and the tip serializer (which masks locked tips).

## 7. Tip pipeline

```
Admin creates Tip (status=DRAFT, publishAt=T)
        │
        ├─ odds snapshot stored as originalOdds
        │
  worker: publish:due (every minute)
        │ publishAt <= now  →  status=PUBLISHED, push notification fan-out
        ▼
  Event kicks off → tip is LIVE-locked (no further edits)
        │
  worker: sync:results (every 5 min)
        │ provider returns final score
        ▼
  SettlementEngine.settle(tip, result) → WON | LOST | VOID | HALF_WON | HALF_LOST
        │ (idempotent: TipResult has a unique tipId; guarded by a transaction)
        ▼
  worker: stats:recompute → StatisticsSnapshot per (product, window) → Redis cache
```

Combos are settled by combining their items: any `LOST` item ⇒ combo `LOST`; all `WON` ⇒
`WON`; mixed half/void outcomes multiply their per-item return factors, which is exactly how
a bookmaker settles an accumulator.

## 8. Odds engine

Every provider poll writes an `Odd` (current) and appends an `OddsHistory` row when the price
actually changed. `openingOdds` is the first observation, `closingOdds` is frozen at kickoff.
`OddsMovement` (`UP` / `DOWN` / `STABLE` / `SIGNIFICANT`) is computed from
`(current − opening) / opening` against a configurable threshold (default 5%). Tips display
_Original odds_ vs _Current odds_ and flag `oddsChanged` when the delta exceeds the threshold.

## 9. Statistics engine

`packages/statistics` is pure and side-effect free:

- `settleSelection()` — market → outcome truth tables (incl. quarter lines).
- `returnFactor(outcome, odds)` — 0, 1 (void), `odds`, `1 + (odds−1)/2`, `0.5`.
- `aggregate(tips[], { stake })` — totals, win rate, ROI, yield, average odds, profit,
  best/worst streak, and grouped breakdowns (day/week/month/league/market/product).

The API caches each `(product, window)` aggregate in Redis for 5 minutes and persists a daily
`StatisticsSnapshot` for fast historical charts.

## 10. Real-time

`apps/api` exposes `GET /ws`. A client subscribes to topics (`live:events`, `tips:FREE`,
`tips:VIP`, …). Topic authorisation reuses `EntitlementService`. The worker publishes to a Redis
channel; every API instance re-broadcasts to its local sockets, so the gateway scales
horizontally. Clients fall back to polling (15-20 s) when the socket cannot be established.

## 11. Security posture

- Argon2id password hashing, refresh-token **rotation with reuse detection** (a replayed
  refresh token revokes the whole session family).
- Access tokens 15 min, refresh tokens 30 days, both signed with separate secrets.
- Provider API keys are encrypted at rest (AES-256-GCM, key from `ENCRYPTION_KEY`).
- Webhooks verify signatures (Stripe HMAC, Apple JWS chain, Google Pub/Sub OIDC) and are
  idempotent via `WebhookEvent`.
- `helmet` CSP/HSTS, strict CORS allowlist, Redis-backed rate limits, Zod validation
  everywhere, Prisma parameterised queries, output escaping in React.
- Every privileged mutation writes an `AuditLog` row (actor, action, entity, before/after, IP).

Details: [`docs/security.md`](./security.md).

## 12. Environments

`development` (docker-compose, mock sports provider, Stripe test keys) →
`staging` (real providers in sandbox) → `production`. Configuration is 100% environment driven
and validated at boot by `packages/config`; the process refuses to start with an invalid config.
