# Running the stack as services

Four processes serve this product and none of them is optional:

| Unit                | What stops without it                                           |
| ------------------- | --------------------------------------------------------------- |
| `storm-tips-api`    | everything — the site and the apps have nothing to talk to      |
| `storm-tips-web`    | the public site (nginx answers `502`)                           |
| `storm-tips-admin`  | the admin console                                               |
| `storm-tips-worker` | fixtures, live scores, odds, results, settlement, notifications |

Started from a terminal they die with the session and never come back after a
reboot, and nothing says so except a `502` or the banner in the admin console.

## Installing

The units carry the paths this deployment uses — check `WorkingDirectory`,
`EnvironmentFile` and `RequiresMountsFor` against the host before installing.

```bash
cp infra/systemd/storm-tips-*.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now storm-tips-api storm-tips-web storm-tips-admin storm-tips-worker
systemctl status 'storm-tips-*'
```

Check what is actually listening, which is what nginx proxies to:

```bash
ss -lntp | grep -E ':(3000|3001|4000)'
pnpm health
```

## Deploying a change

The services run compiled output, so a restart alone ships nothing:

```bash
cd /root/stormtipsapp
git pull && pnpm install && pnpm build
systemctl restart storm-tips-api storm-tips-web storm-tips-admin storm-tips-worker
```

## Why the units look the way they do

- **`RequiresMountsFor`** stops the failure this deployment already hit: with the
  data volume missing at boot, Docker comes up on an empty root and the services
  would run happily against a database that is not there.
- **The web and admin units run `.next/standalone/.../server.js`**, not
  `next start` — Next refuses to run `next start` against an
  `output: 'standalone'` build. The build copies `.next/static` and `public`
  into that bundle, which Next itself does not do; without them the server
  starts, serves HTML, and 404s every stylesheet.
- **`HOSTNAME=127.0.0.1`** keeps the Next servers on loopback. nginx is the only
  thing in front of them, so there is no reason to listen on every interface.
- **The restart limit sits in `[Unit]`**, where systemd reads it, so a crash loop
  shows as a failed unit instead of hiding behind endless restarts.
