# Deployment

Four deployable services — `api`, `worker`, `web`, `admin` — plus PostgreSQL,
Redis and an optional nginx front. Everything is containerised; the same images
run in staging and production.

## Images

| Service | Dockerfile                       | Contents                                   |
| ------- | -------------------------------- | ------------------------------------------ |
| API     | `infra/docker/Dockerfile.api`    | tsup bundle + Prisma client + Argon2 addon |
| Worker  | `infra/docker/Dockerfile.worker` | Same, with the BullMQ processors           |
| Web     | `infra/docker/Dockerfile.web`    | Next.js standalone output                  |
| Admin   | `infra/docker/Dockerfile.admin`  | Next.js standalone output, `noindex`       |

All four are multi-stage, install with `--frozen-lockfile`, drop to the
unprivileged `node` user, and ship no build tooling. The API and worker generate
the Prisma client against the exact `node_modules` the runtime uses.

The Next.js images bake `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` at build
time — those are build arguments, not runtime environment variables, because
Next.js inlines them into the client bundle.

## Running the stack

```bash
cp .env.example .env          # fill in real values first
docker compose -f infra/docker/docker-compose.yml --env-file .env up -d --build
```

The compose file refuses to start when `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `ENCRYPTION_KEY` or `INTERNAL_API_TOKEN` is missing. That
is deliberate: no default secret exists anywhere in this repository.

Startup order is enforced by the compose file: PostgreSQL and Redis become
healthy, the one-shot `migrate` service applies migrations and exits, then the
API starts. The API never serves against an older schema.

Optional profiles:

```bash
--profile proxy   # nginx with TLS termination (see infra/nginx/README.md)
--profile dev     # Mailpit on http://localhost:8025
```

Seeding is deliberately **not** part of the container startup. Run it manually,
once, against a fresh database:

```bash
pnpm db:seed
```

## Ports

| Service | Container | Published by default                         |
| ------- | --------- | -------------------------------------------- |
| API     | 4000      | `${API_PORT:-4000}`                          |
| Web     | 3000      | `${WEB_PORT:-3000}`                          |
| Admin   | 3001      | `${ADMIN_PORT:-3001}`                        |
| nginx   | 80 / 443  | `${HTTP_PORT:-8080}` / `${HTTPS_PORT:-8443}` |

PostgreSQL and Redis are **not** published — only the application containers
reach them. Keep it that way in production and put the admin console behind an
IP allowlist or VPN as well.

## CI/CD

| Workflow                        | Trigger            | Work                                                                                                            |
| ------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml`      | push, pull request | Lint, typecheck, tests against real PostgreSQL and Redis services, build, Expo Android bundle, container builds |
| `.github/workflows/release.yml` | tag `v*`, manual   | Builds and pushes the four images to GHCR, then deploys                                                         |
| `.github/workflows/codeql.yml`  | push, PR, weekly   | CodeQL security-and-quality analysis                                                                            |

The deploy job is gated on a GitHub Environment, so production can require a
manual approval. It expects `DEPLOY_HOST`, `DEPLOY_USER` and `DEPLOY_SSH_KEY`;
with none configured it logs a notice and succeeds rather than failing the
pipeline.

### Deploy order

1. `docker compose pull`
2. `docker compose up -d migrate` — migrations first, always
3. `docker compose up -d api worker web admin`

Migrations must be backward compatible for the duration of a rolling deploy: add
a column before writing to it, and remove one only after the last release that
reads it is gone.

## Health and readiness

| Endpoint       | Use                                        |
| -------------- | ------------------------------------------ |
| `GET /health`  | Liveness. Process is up                    |
| `GET /ready`   | Readiness. Database and Redis reachable    |
| `GET /metrics` | Prometheus text format (`METRICS_ENABLED`) |

The API and web images declare Docker healthchecks; point your orchestrator's
readiness probe at `/ready` so traffic only arrives once dependencies answer.

## Scaling

- **API** — stateless; run as many replicas as needed. WebSocket fan-out goes
  through Redis pub/sub, so a client connected to any instance receives every
  broadcast.
- **Worker** — repeatable jobs use stable job ids, so several worker replicas
  share one schedule instead of duplicating it. Per-queue concurrency is set in
  `apps/worker/src/registry.ts`.
- **PostgreSQL** — put PgBouncer in front for many API replicas and set
  `DIRECT_DATABASE_URL` to the direct port for migrations.
- **Redis** — must be a single logical instance (or a cluster with the queues
  pinned); BullMQ needs `maxmemory-policy noeviction`, which the compose file
  sets.

## Backups and restore

```bash
pg_dump --format=custom --file=backup-$(date +%F).dump "$DATABASE_URL"
pg_restore --clean --if-exists --dbname "$DATABASE_URL" backup-2026-01-01.dump
```

Take a dump before every migration-carrying deploy, store it off-host, and
rehearse the restore. Redis holds only caches and queue state; losing it delays
jobs but destroys no customer data.

## Rollback

Images are tagged with the release tag and the commit sha, so rolling back is
re-deploying the previous tag. A migration is not rolled back automatically —
if a release contained a destructive migration, restore the dump taken before
it. That is the reason destructive changes should be split across two releases.

## Operational runbook

| Symptom                 | First check                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| Feeds empty for today   | Is the worker running? `sync:fixtures` and `publish:due` in its logs                                |
| Tips stuck as `PENDING` | Provider results: `sync:results`, then `settle:due`; check `/metrics` and Admin → Providers         |
| Statistics look stale   | `stats:recompute` runs every 30 minutes; the API also caches for 5 minutes                          |
| Purchases not unlocking | Webhook delivery, then the `WebhookEvent` table; replays are idempotent by design                   |
| 429 responses           | `RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_MAX`; both buckets are Redis-backed and shared across instances |
