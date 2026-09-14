# Local setup

## Requirements

| Tool       | Version  | Notes                                             |
| ---------- | -------- | ------------------------------------------------- |
| Node.js    | 22 LTS   | `engines` enforces `>=22`                         |
| pnpm       | 10       | `corepack enable` installs the pinned version     |
| PostgreSQL | 16       | 15 also works; the schema uses no 16-only feature |
| Redis      | 7        | Queues, caching and WebSocket fan-out             |
| Docker     | optional | Only needed for the container stack               |

The workspace uses pnpm's **hoisted** node-linker (`.npmrc`). React Native's
Metro bundler walks `node_modules` upwards and cannot resolve pnpm's isolated
symlink layout, so a hoisted tree is required for `apps/mobile` to bundle.

## First run

```bash
corepack enable
cp .env.example .env
pnpm install
```

Fill in at least these four values before anything will start:

```bash
# 32-byte hex secrets
openssl rand -hex 32   # → JWT_ACCESS_SECRET
openssl rand -hex 32   # → JWT_REFRESH_SECRET
openssl rand -hex 32   # → ENCRYPTION_KEY   (must be exactly 64 hex chars)
```

plus `DATABASE_URL` pointing at your PostgreSQL instance. `packages/config`
validates the whole environment at boot and refuses to start the process with a
readable list of problems rather than failing later at runtime.

```bash
pnpm db:migrate     # applies migrations (interactive; creates the DB objects)
pnpm db:seed        # catalogue, ~6 months of settled tips, plans, demo users
pnpm dev            # api :4000, worker, web :3000, admin :3001
pnpm dev:mobile     # Expo dev server
```

`pnpm db:migrate` wraps `prisma migrate dev` and is interactive by design. In CI
and in containers use `pnpm db:migrate:deploy`, which is not.

## What the seed produces

A complete, self-consistent dataset so every screen has realistic content:
the sport/country/league/team catalogue, fixtures with odds, roughly six months
of **settled** tips (settled by the real settlement engine, not hand-written
outcomes), combos, subscription plans, demo subscribers, polls and referrals.

The seed refuses to run when `NODE_ENV=production`.

The admin account it writes comes from `SEED_ADMIN_EMAIL` and
`SEED_ADMIN_PASSWORD`; the seed prints both when it finishes. Those accounts are
written on a fresh seed only, so to recover a login without wiping the database:

```bash
pnpm --filter @storm-tips/database set-password <email> '<password>'
```

It hashes with the same KDF the API uses, and lists the staff accounts that do
exist when the address is unknown.

Mock fixtures are deterministic: `MOCK_PROVIDER_SEED` (default `storm-tips`)
drives the generator, and the seed and the running worker must agree on it, or
the worker will rewrite fixtures the seed already stored.

## Environment variables

### Core

| Variable                              | Default                 | Meaning                                              |
| ------------------------------------- | ----------------------- | ---------------------------------------------------- |
| `NODE_ENV`                            | `development`           | `development` \| `test` \| `staging` \| `production` |
| `LOG_LEVEL`                           | `info`                  | pino level; `silent` in tests                        |
| `API_PORT` / `API_HOST`               | `4000` / `0.0.0.0`      | API bind address                                     |
| `API_PUBLIC_URL`                      | `http://localhost:4000` | Used in emails, webhooks, deep links                 |
| `WEB_PUBLIC_URL` / `ADMIN_PUBLIC_URL` | `:3000` / `:3001`       | Used for redirects                                   |
| `CORS_ORIGINS`                        | localhost origins       | Comma-separated allowlist                            |

### Data stores

| Variable              | Required                      | Meaning                                                                                |
| --------------------- | ----------------------------- | -------------------------------------------------------------------------------------- |
| `DATABASE_URL`        | yes                           | PostgreSQL connection string                                                           |
| `DIRECT_DATABASE_URL` | no                            | Non-pooled URL for `prisma migrate`; set it when PgBouncer or Accelerate sits in front |
| `REDIS_URL`           | no (`redis://localhost:6379`) | Queues, cache, pub/sub                                                                 |

### Security

| Variable                               | Required           | Meaning                                                                |
| -------------------------------------- | ------------------ | ---------------------------------------------------------------------- |
| `JWT_ACCESS_SECRET`                    | yes                | ≥ 32 chars; signs 15-minute access tokens                              |
| `JWT_REFRESH_SECRET`                   | yes                | ≥ 32 chars; signs refresh tokens                                       |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL`   | `15m` / `30d`      | Token lifetimes                                                        |
| `ENCRYPTION_KEY`                       | yes                | Exactly 64 hex chars; AES-256-GCM key for provider credentials at rest |
| `INTERNAL_API_TOKEN`                   | yes in production  | Worker → API service calls                                             |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW` | `300` / `1 minute` | Global bucket                                                          |
| `AUTH_RATE_LIMIT_MAX`                  | `10`               | Stricter bucket for login, register and reset                          |

### Integrations

Every integration is **optional in development** and the code degrades to a
clearly reported error instead of pretending to work:

| Area        | Variables                                                                 | Without them                                             |
| ----------- | ------------------------------------------------------------------------- | -------------------------------------------------------- |
| Stripe      | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_*_URL`              | Checkout returns a configuration error; nothing is faked |
| Apple IAP   | `APPLE_ISSUER_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `APPLE_BUNDLE_ID` | Receipt verification is refused                          |
| Google Play | `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64`, `GOOGLE_PLAY_PACKAGE_NAME`     | Purchase verification is refused                         |
| Sports data | `SPORTS_PROVIDER`, `SPORTS_API_KEY`, `THEODDSAPI_KEY`                     | `mock` provider serves deterministic fixtures            |
| Push        | `EXPO_ACCESS_TOKEN`, `FCM_*`, `APNS_*`                                    | Notifications are stored but not delivered               |
| Email       | `SMTP_*`                                                                  | Mail is logged instead of sent (use Mailpit locally)     |

See [payments.md](payments.md), [sports-providers.md](sports-providers.md) and
[notifications.md](notifications.md) for exactly where each credential is
obtained and which file consumes it.

### Product defaults

| Variable                  | Default         | Meaning                                        |
| ------------------------- | --------------- | ---------------------------------------------- |
| `DEFAULT_CURRENCY`        | `EUR`           | `EUR` \| `USD` \| `GBP`                        |
| `DEFAULT_LOCALE`          | `de`            | `de` \| `en`                                   |
| `DEFAULT_TIMEZONE`        | `Europe/Berlin` | Feed day boundaries and cron                   |
| `STATISTICS_STAKE`        | `10`            | Flat theoretical stake behind every ROI figure |
| `ODDS_MOVEMENT_THRESHOLD` | `0.05`          | Relative delta that marks odds as moved        |

### Client variables

`NEXT_PUBLIC_*` and `EXPO_PUBLIC_*` values are **compiled into the client
bundle**. Only put public information there — never a secret key.

`NEXT_PUBLIC_API_URL` is optional and best left empty. Empty means the web and
admin apps call `/api` on their own origin and the Next.js server proxies it to
`API_INTERNAL_URL`. That is one origin, so there is no CORS allowlist to
maintain, the API port does not have to be reachable from the internet, and the
same build works from any hostname — including a phone on your LAN.

Set it only when the browser genuinely has to reach the API on another origin.
Then that origin must also appear in the API's `CORS_ORIGINS`.

`NEXT_PUBLIC_WS_URL` is separate: Next.js rewrites cannot proxy a WebSocket
upgrade, so live updates need either a direct URL to the API or a reverse proxy
that handles the upgrade (`infra/nginx/nginx.conf` does). Left empty, the live
screen polls instead.

The Expo app has no proxy in front of it and always needs an absolute
`EXPO_PUBLIC_API_URL` the device can reach — `localhost` there means the
phone.

## Troubleshooting

| Symptom                                               | Cause and fix                                                                 |
| ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| `Invalid environment configuration` at boot           | A required variable is missing or malformed; the message lists each one       |
| `Environment variable not found: DIRECT_DATABASE_URL` | Prisma reads `.env` itself; set the variable even if it equals `DATABASE_URL` |
| `pnpm db:migrate` seems to hang                       | It is interactive; use `pnpm db:migrate:deploy` in scripts                    |
| Metro cannot resolve a workspace package              | `node-linker=hoisted` must stay in `.npmrc`; reinstall after changing it      |
| Expo Go cannot open the in-app purchase screen        | Store purchases need a development or production build, not Expo Go           |
