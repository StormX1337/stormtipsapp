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

The Next.js images do **not** bake an API URL by default. The browser calls
`/api` on the app's own origin and the Next server proxies it to
`API_INTERNAL_URL` (a runtime variable, `http://api:4000` on the compose
network). One origin: no CORS allowlist to maintain, no API port to publish,
and the same image runs behind any hostname.

`NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` remain available as build
arguments for the case where the browser must address the API directly. They
are build arguments rather than runtime variables because Next.js inlines them
into the client bundle, so changing one means rebuilding the image.

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

## Checking a deployment

```bash
pnpm health
```

Read-only, and it answers the question every outage here has actually started
with: _why is nothing happening?_ Each check exists because the failure it
catches was silent — the app kept serving and the symptom appeared somewhere
else entirely.

| Check          | Catches                                                                  |
| -------------- | ------------------------------------------------------------------------ |
| Disk           | the full disk that makes Redis and Postgres refuse writes                |
| Redis          | unreachable, wrong password, or refusing writes after a failed snapshot  |
| Worker         | no heartbeat, or jobs piling up and failing                              |
| Database       | unreachable, or migrations unfinished                                    |
| Stripe keys    | placeholders, a secret key in the publishable slot, mismatched test/live |
| Plans          | active plans with no usable Stripe price — nothing can be bought         |
| Store products | plans with no Apple or Google product id — in-app purchase fails         |
| Provider keys  | a stored API key that the current `ENCRYPTION_KEY` can no longer decrypt |
| Configuration  | values still left at their `.env.example` placeholder                    |

Each failure prints the command or the admin page that fixes it, and the
command exits non-zero when anything failed, so it works as a deployment gate.

## Moving the heavy directories to a second volume

When the root filesystem fills up, everything stops in confusing ways — Redis
refuses writes, Postgres cannot extend a file, builds fail halfway. Attaching a
volume and moving the four things that actually grow is the durable fix.

Take the volume's mount point from `df -h` (on Hetzner it looks like
`/mnt/HC_Volume_123456789`) and use it in place of `$VOL` below.

**First, make sure it survives a reboot.** If the volume is not in `/etc/fstab`,
nothing mounts at boot and Postgres will not start:

```bash
grep -q "$VOL" /etc/fstab && echo "in fstab" || echo "NOT in fstab — add it"
```

### 1. The checkout (easiest, usually the biggest single win)

`node_modules` across this workspace is several GB. Stop the apps, move the
directory, and leave a symlink so every path and script keeps working:

```bash
mv /root/stormtipsapp "$VOL/stormtipsapp"
ln -s "$VOL/stormtipsapp" /root/stormtipsapp
```

### 2. The pnpm store

Pointing pnpm at a new store does not reclaim the old one — it is simply
abandoned where it is, and the move across filesystems has already turned the
workspace's hardlinks into full copies. So delete it and reinstall, which links
everything back into the store on the volume:

```bash
du -sh /root/.local/share/pnpm/store /root/.pnpm-store 2>/dev/null
pnpm config set store-dir "$VOL/pnpm-store"
rm -rf /root/.local/share/pnpm/store /root/.pnpm-store
pnpm install
```

### 3. Redis

Find how Redis is actually installed first — the service name and paths differ
between a distribution package, a container and a self-compiled build, and
guessing wastes a stopped service:

```bash
systemctl list-units --type=service | grep -i redis
redis-cli CONFIG GET dir          # where it saves today
redis-cli INFO server | grep config_file
```

Then, with `$SVC` as the service name from the first command and `$OLD` as the
directory from the second:

```bash
systemctl stop "$SVC"
mkdir -p "$VOL/redis" && mv "$OLD"/* "$VOL/redis/"
chown -R redis:redis "$VOL/redis"
# set `dir $VOL/redis` in the config file the third command named
systemctl start "$SVC"
redis-cli CONFIG GET dir          # must print the new path
```

### 4. PostgreSQL

The one that needs care. Take a dump first — it costs a minute and is the
difference between a mistake and a disaster:

Read the major version from the running server rather than assuming one — the
paths carry it, and a wrong guess makes every command below fail silently
against a directory that does not exist:

```bash
pg_lsclusters                     # version, cluster and data directory
VER=$(pg_lsclusters -h | awk 'NR==1{print $1}')
```

```bash
sudo -u postgres pg_dumpall > "$VOL/backup-$(date +%F).sql"
ls -lh "$VOL"/backup-*.sql        # confirm it is not empty before going on
systemctl stop postgresql
mkdir -p "$VOL/postgresql/$VER"
rsync -a "/var/lib/postgresql/$VER/main/" "$VOL/postgresql/$VER/main/"
chown -R postgres:postgres "$VOL/postgresql"
chmod 700 "$VOL/postgresql/$VER/main"
# set `data_directory = '$VOL/postgresql/$VER/main'` in
# /etc/postgresql/$VER/main/postgresql.conf
systemctl start postgresql
sudo -u postgres psql -c "SHOW data_directory;"
```

Keep the old directory until the new one has served for a few days, then remove
it:

```bash
mv "/var/lib/postgresql/$VER/main" "/var/lib/postgresql/$VER/main.old"
```

`pnpm health` reports every mount it can find, so after the move it shows both
the volume and the root filesystem — the point being that `/` filling up again
stays visible instead of hiding behind a roomy volume.

## The worker is not optional

The API serves requests; **everything that happens on a schedule happens in
`apps/worker`** — fixtures, live scores, odds, results, settlement, scheduled
publishing, subscription expiry and push notifications. Run it alongside the
API, not instead of it:

```bash
pnpm --filter @storm-tips/worker dev     # development
pnpm --filter @storm-tips/worker start   # production
```

With the worker stopped nothing announces it: the API answers, the admin loads,
the site renders — the data simply stops moving, which looks like a data
provider that has gone quiet. So the worker writes a heartbeat key to Redis
every 15 seconds with a 60-second TTL, `GET /admin/ops/workers` reads it, and
the admin console shows a standing banner on every page while it is missing.

The heartbeat is what decides, rather than BullMQ's own worker registration:
that registration is a live Redis connection, so whether it disappears with the
process depends on how the process died and on Redis's `timeout` setting — a
stopped worker was still counted as connected a minute later. A key that
expires unless something renews it cannot be wrong in that direction.

The same endpoint reports each queue's depth and failures, so a worker that is
running but wedged is visible too.

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

## Putting it on a domain

Worked example for `tips.stormclient.xyz` on a single host running the apps
directly (not the compose stack). `infra/nginx/tips.stormclient.xyz.conf` is the
matching reverse-proxy config; the compose variant is `infra/nginx/nginx.conf`.

The shape: nginx terminates TLS and serves the site on one origin. The browser
calls `/api` on that same origin, so there is no CORS to configure and the API
port never has to be reachable from outside. `/ws` is forwarded with the upgrade
header, which is what a Next.js rewrite cannot do — so realtime streams instead
of polling.

### 1. DNS

Two A records, both to the host's IPv4 address:

| Type | Name         | Content       | Proxy             |
| ---- | ------------ | ------------- | ----------------- |
| A    | `tips`       | the host's IP | off while issuing |
| A    | `admin.tips` | the host's IP | off while issuing |

Leave the proxy (the orange cloud) **off** until the certificate is issued —
Cloudflare answers the HTTP-01 challenge with its own edge otherwise. Turn it on
afterwards and set SSL/TLS mode to **Full (strict)**, which requires the real
certificate on the origin that step 3 installs.

### 2. Open the ports

Only 80 and 443 belong on the public internet. 3000, 3001 and 4000 stay local:
nginx reaches them over loopback.

```bash
sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw deny 3000/tcp && sudo ufw deny 3001/tcp && sudo ufw deny 4000/tcp
```

### 3. Certificate and proxy

This is a circle that has to be broken in the right order: the full config
refuses to load without a certificate, and certbot's webroot challenge needs a
web server already answering on port 80 for the domain. So port 80 is served
first by an HTTP-only bootstrap, and the full config goes in afterwards.

```bash
sudo apt-get install -y nginx certbot
sudo mkdir -p /var/www/certbot

# 3a. Serve the challenge directory — and nothing else — under both hostnames.
sudo cp infra/nginx/acme-bootstrap.conf /etc/nginx/sites-available/tips
sudo ln -sf /etc/nginx/sites-available/tips /etc/nginx/sites-enabled/tips
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# 3b. Prove it is reachable from the internet before spending a rate limit.
echo ok | sudo tee /var/www/certbot/.well-known/acme-challenge/ping >/dev/null
curl -s http://tips.stormclient.xyz/.well-known/acme-challenge/ping        # ok
curl -s http://admin.tips.stormclient.xyz/.well-known/acme-challenge/ping  # ok

# 3c. Now the certificate.
sudo certbot certonly --webroot -w /var/www/certbot \
  -d tips.stormclient.xyz -d admin.tips.stormclient.xyz

# 3d. Swap in the real config, which can now find the certificate.
sudo cp infra/nginx/tips.stormclient.xyz.conf /etc/nginx/sites-available/tips
sudo nginx -t && sudo systemctl reload nginx
```

If 3b returns 404, port 80 is still being answered by something else — check
`ls /etc/nginx/sites-enabled/` and that `systemctl reload nginx` actually
succeeded. A failed reload leaves the _previous_ config serving, which is
exactly how a stale default site ends up 404ing the challenge.

Certbot installs its own renewal timer; `systemctl list-timers certbot` shows
it. Renewals need no bootstrap: the full config keeps serving the same challenge
directory on port 80.

### 4. Environment

```dotenv
WEB_PUBLIC_URL=https://tips.stormclient.xyz
ADMIN_PUBLIC_URL=https://admin.tips.stormclient.xyz
API_PUBLIC_URL=https://tips.stormclient.xyz

# Empty: the browser calls /api on the site's own origin.
NEXT_PUBLIC_API_URL=
# nginx forwards the upgrade, so realtime can finally be switched on.
NEXT_PUBLIC_WS_URL=wss://tips.stormclient.xyz/ws

API_INTERNAL_URL=http://localhost:4000
# Only for `next dev`; drop it once you run production builds.
ALLOWED_DEV_ORIGINS=tips.stormclient.xyz,admin.tips.stormclient.xyz

# The site is same-origin, so it needs no entry. Expo Go does.
CORS_ORIGINS=http://localhost:8081
```

Nothing here is baked into a bundle, so a domain change needs no rebuild.

### 5. Verify

```bash
curl -I  http://tips.stormclient.xyz            # 301 to https
curl -s  https://tips.stormclient.xyz/health    # {"status":"ok"}
curl -s  https://tips.stormclient.xyz/api/v1/billing/paywall/combo | head -c 80
```

Then open the site, and the console at `https://admin.tips.stormclient.xyz`.

Behind Cloudflare the origin only ever sees Cloudflare's addresses, so the
config restores the visitor's IP from `CF-Connecting-IP` for the listed
Cloudflare ranges. Without that the API would rate-limit every visitor as one
client and write Cloudflare's IP into the audit log. The ranges change rarely;
they are published at <https://www.cloudflare.com/ips/>.

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

### When a front-end cannot reach the API

Almost always one of two things, and the API log now names which:

- **`Netzwerkfehler` in the browser, nothing in the API log** — the bundle is
  calling an address the visitor's device cannot reach, classically
  `localhost:4000` from a phone. Leave `NEXT_PUBLIC_API_URL` empty and let the
  proxy handle it.
- **`origin rejected` in the API log** — the browser reaches the API directly
  from an origin that is not in `CORS_ORIGINS`. The log line names the origin
  and the configured allowlist.

## Operational runbook

| Symptom                 | First check                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| Feeds empty for today   | Is the worker running? `sync:fixtures` and `publish:due` in its logs                                |
| Tips stuck as `PENDING` | Provider results: `sync:results`, then `settle:due`; check `/metrics` and Admin → Providers         |
| Statistics look stale   | `stats:recompute` runs every 30 minutes; the API also caches for 5 minutes                          |
| Purchases not unlocking | Webhook delivery, then the `WebhookEvent` table; replays are idempotent by design                   |
| 429 responses           | `RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_MAX`; both buckets are Redis-backed and shared across instances |
