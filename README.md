# PROFIT TIPS

Sports-analysis platform: a public feed of free tips, paid VIP / Combo / Extra /
Fix Odds products, verified performance statistics, an admin back office and a
native app.

The application publishes **analyses**, not promises. Every figure it shows is
the recomputed result of tips that have already been settled against a verified
match result. Nothing in the product claims a guaranteed profit — see
[docs/responsible-gambling.md](docs/responsible-gambling.md).

## What is in the box

| Workspace                | Purpose                                                               |
| ------------------------ | --------------------------------------------------------------------- |
| `apps/api`               | Fastify 5 REST + WebSocket API, the single source of entitlements     |
| `apps/worker`            | BullMQ workers: fixtures, odds, results, settlement, push, statistics |
| `apps/web`               | Next.js 15 customer site (feeds, paywalls, statistics, account)       |
| `apps/admin`             | Next.js 15 back office (tips, combos, users, commerce, providers)     |
| `apps/mobile`            | Expo SDK 54 / React Native app (iOS + Android)                        |
| `packages/database`      | Prisma schema, migrations and the seed                                |
| `packages/types`         | DTOs, enums and the Zod request schemas shared by every app           |
| `packages/statistics`    | Settlement rules and the statistics engine (pure functions)           |
| `packages/sports`        | Sports-data provider abstraction (mock, SportsGameOdds, The Odds API) |
| `packages/payments`      | Stripe, Apple StoreKit 2 and Google Play adapters                     |
| `packages/notifications` | Expo push, FCM, APNs and email templates                              |
| `packages/auth`          | Argon2id hashing, JWT issuing, refresh-token rotation                 |
| `packages/config`        | Validated environment and application constants                       |
| `packages/ui`            | Design tokens, formatters, i18n catalogues and legal copy             |

## Quick start

```bash
# 1. Requirements: Node 22, pnpm 10, PostgreSQL 16, Redis 7
corepack enable

# 2. Configure
cp .env.example .env
#    then fill in DATABASE_URL, JWT_*, ENCRYPTION_KEY (see docs/setup.md)

# 3. Install, migrate, seed
pnpm install
pnpm db:migrate
pnpm db:seed

# 4. Run API, worker, web and admin together
pnpm dev
```

| Service | URL                                                                  |
| ------- | -------------------------------------------------------------------- |
| API     | http://localhost:4000 (`/api/v1`, OpenAPI at `/api/v1/openapi.json`) |
| Web     | http://localhost:3000                                                |
| Admin   | http://localhost:3001                                                |
| Mobile  | `pnpm dev:mobile`, then open Expo Go or a development build          |

The seed creates an administrator from `SEED_ADMIN_EMAIL` /
`SEED_ADMIN_PASSWORD`. Change both before exposing the stack to a network.

Everything also runs in containers:

```bash
docker compose -f infra/docker/docker-compose.yml --env-file .env up -d --build
```

## Everyday commands

```bash
pnpm dev            # api + worker + web + admin
pnpm dev:mobile     # Expo dev server
pnpm lint           # ESLint across the workspace (zero warnings allowed)
pnpm typecheck      # tsc --noEmit in every package
pnpm test           # Vitest (unit + API integration)
pnpm build          # build every deployable app
pnpm db:migrate     # create/apply a migration in development
pnpm db:studio      # Prisma Studio
```

## How the important parts fit together

- **Entitlements are server-side only.** A premium tip leaves the API with its
  selection, odds and analysis stripped unless the request carries an active
  entitlement. The client never decides what to unlock.
- **Purchases are verified by the server.** Stripe webhooks, Apple App Store
  Server Notifications v2 and Google Play RTDN all converge on one normalised
  subscription record; the app finishes a store transaction only after the API
  confirms it.
- **Statistics are computed, never typed in.** Win rate, ROI, yield, return on
  stake, average odds and streaks are derived from settled tips with a fixed
  theoretical stake, including correct half-win/half-loss handling for Asian
  quarter lines.
- **Results come from a provider, not from a human.** The worker syncs fixtures,
  odds and results, then the settlement engine decides each tip's outcome.

## Documentation

| Document                                                     | Contents                                    |
| ------------------------------------------------------------ | ------------------------------------------- |
| [docs/setup.md](docs/setup.md)                               | Local environment, every variable explained |
| [docs/architecture.md](docs/architecture.md)                 | System design and request lifecycle         |
| [docs/research.md](docs/research.md)                         | Reference analysis, prior art, sources      |
| [docs/database.md](docs/database.md)                         | Data model, migrations, seed                |
| [docs/api.md](docs/api.md)                                   | Endpoints, auth, errors, WebSocket protocol |
| [docs/payments.md](docs/payments.md)                         | Stripe, Apple and Google integration        |
| [docs/subscriptions.md](docs/subscriptions.md)               | Plans, entitlements, lifecycle              |
| [docs/sports-providers.md](docs/sports-providers.md)         | Provider abstraction and switching          |
| [docs/notifications.md](docs/notifications.md)               | Push, email and preferences                 |
| [docs/mobile.md](docs/mobile.md)                             | Expo app, builds, store submission          |
| [docs/deployment.md](docs/deployment.md)                     | Containers, CI/CD, operations               |
| [docs/security.md](docs/security.md)                         | Threat model and controls                   |
| [docs/responsible-gambling.md](docs/responsible-gambling.md) | Compliance rules the product follows        |

## Licence

Proprietary. No third-party source code, artwork, logos or brand assets are
bundled: every icon, crest and illustration in the apps is drawn at runtime from
the design tokens in `packages/ui`.
