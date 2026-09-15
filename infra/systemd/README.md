# Running the worker as a service

The worker is not optional — fixtures, live scores, odds, results, settlement,
scheduled publishing and every notification happen there. Started from a
terminal it dies with the session and does not come back after a reboot, and
nothing in the app says so except the banner in the admin console.

```bash
# Adjust WorkingDirectory, EnvironmentFile and RequiresMountsFor to this host
# before installing — the file carries the paths this deployment uses.
cp infra/systemd/storm-tips-worker.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now storm-tips-worker
```

Check it:

```bash
systemctl status storm-tips-worker
journalctl -u storm-tips-worker -f
pnpm health                      # Worker must read "running"
```

`RequiresMountsFor` is what stops the failure this deployment already hit once:
with the data volume missing at boot, Docker comes up on an empty root and the
worker would otherwise run happily against a database that is not there.

After deploying new code the service needs the new build, not just a restart:

```bash
git pull && pnpm install && pnpm build
systemctl restart storm-tips-worker
```
