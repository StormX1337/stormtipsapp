# Database

PostgreSQL 16 with Prisma 6. The schema lives in
`packages/database/prisma/schema.prisma` (39 models) and is the single place
where the data model is defined — the API, worker, seed and admin all import the
generated client from `@storm-tips/database`.

## Client

`packages/database/src/client.ts` exports a **lazy** singleton:

```ts
export const prisma: PrismaClient = new Proxy({} as PrismaClient, { … });
```

The proxy defers construction until the first property access. That matters
because several entry points import the client before `.env` has been loaded; a
client constructed at import time would capture an undefined `DATABASE_URL`.

In development the instance is cached on `globalThis` so a hot reload does not
open a new pool on every change. `disconnectPrisma()` closes it on shutdown.

## Model groups

| Group      | Models                                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Identity   | `User`, `Session`, `VerificationToken`                                                                                                                       |
| Catalogue  | `Sport`, `Country`, `League`, `Team`, `Event`                                                                                                                |
| Odds       | `Bookmaker`, `Market`, `Odd`, `OddsHistory`                                                                                                                  |
| Editorial  | `Tip`, `TipResult`, `Combo`, `ComboItem`                                                                                                                     |
| Commerce   | `Product`, `SubscriptionPlan`, `FixOddsPlan`, `Subscription`, `Entitlement`, `Payment`, `Invoice`, `Coupon`, `CouponRedemption`, `Promotion`, `WebhookEvent` |
| Engagement | `Notification`, `DeviceToken`, `Poll`, `PollOption`, `PollVote`, `Referral`, `ReferralReward`                                                                |
| Operations | `ApiProvider`, `StatisticsSnapshot`, `AnalyticsEvent`, `AuditLog`, `AppSetting`                                                                              |

### The models worth knowing

**`Tip`** is the editorial unit: an event, a market, a selection, the odds when
published, the current odds, a confidence score, the product it belongs to and
the written analysis. A published tip is immutable in the parts that decide its
outcome; edits are recorded in `AuditLog`.

**`TipResult`** is written exactly once per tip, guarded by a unique constraint
on `tipId`. It stores the outcome, the return factor, the stake, the resulting
profit and the verified score. The settlement service treats a unique-constraint
violation as "someone else already settled this" and reports no outcome rather
than double-counting — that guard is covered by a test.

**`Entitlement`** is the only thing the API consults when deciding whether a
user may see premium content. It is derived from subscriptions, manual grants
and referral rewards, never from anything the client sends.

**`WebhookEvent`** gives payment webhooks idempotency: the provider event id is
unique, so a replayed Stripe or Google delivery is claimed once and ignored
afterwards.

**`translations`** is a JSON column on every model that carries reader-facing
text (`products`, `subscription_plans`, `fix_odds_plans`, `coupons`,
`promotions`, `polls`, `poll_options`, `markets`, `tips`, `combos`). It holds per-locale overrides of
the row's own columns; anything missing falls back to the column, so a partial
translation degrades to the authored text. See
[localization.md](localization.md).

**`StatisticsSnapshot`** caches the computed figures per product and window so
the paywall does not recompute six months of tips on every request. The worker
refreshes it every 30 minutes; the numbers themselves always come from settled
tips.

## Migrations

```bash
pnpm db:migrate            # prisma migrate dev   (interactive, development)
pnpm db:migrate:deploy     # prisma migrate deploy (CI, containers)
pnpm db:push               # prototype without creating a migration
pnpm db:reset              # drop, re-migrate, re-seed  (destructive)
pnpm db:studio             # Prisma Studio
```

Migrations live in `packages/database/prisma/migrations`. The container stack
runs `migrate deploy` in a dedicated `migrate` service that must exit
successfully before the API starts, so the API never serves against an older
schema.

Set `DIRECT_DATABASE_URL` when a connection pooler (PgBouncer, Prisma
Accelerate) sits in front of PostgreSQL: Prisma uses it for migrations, which
need a session-level connection.

## Seed

`packages/database/prisma/seed.ts` builds a complete dataset:

- the catalogue from `packages/sports` (sports, countries, leagues, teams,
  bookmakers) — no third-party logos, only names and colours;
- fixtures and odds from the deterministic `MockProvider`;
- roughly six months of tips, settled by the **real** settlement engine against
  generated match results;
- combos assembled from those tips and settled by the same engine;
- subscription plans (1 / 3 / 6 months plus a multi-product bundle), demo
  subscribers, polls, referrals and provider records.

The historical sample is deliberately shaped so dashboards have a plausible
curve. That bias exists **only in the seed**; the running application never
invents a result — it settles what the provider reports.

## Backups

`pg_dump` the database before every deploy that carries a migration:

```bash
pg_dump --format=custom --file=storm-tips-$(date +%F).dump "$DATABASE_URL"
```

The container stack keeps data in the named volume `postgres-data`; back up the
volume or dump from inside the container, and test a restore before relying on
it.
