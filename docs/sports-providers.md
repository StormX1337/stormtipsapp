# Sports data providers

All fixture, odds and result data enters the system through one interface, so a
vendor can be swapped without touching the API, the worker or any screen.

```ts
interface SportsDataProvider {
  getSports(): Promise<ProviderSport[]>;
  getLeagues(sportKey?: string): Promise<ProviderLeague[]>;
  getTeams(leagueKey: string): Promise<ProviderTeam[]>;
  getEvents(query?: EventQuery): Promise<ProviderEvent[]>;
  getLiveEvents(): Promise<ProviderEvent[]>;
  getOdds(query: OddsQuery): Promise<ProviderOdds[]>;
  getResults(query: ResultQuery): Promise<ProviderResult[]>;
  healthCheck(): Promise<ProviderHealth>;
}
```

`createProvider()` in `packages/sports/src/registry.ts` is the only place that
knows which implementations exist.

## Available implementations

| Slug             | Name                    | API key | Documentation                               |
| ---------------- | ----------------------- | ------- | ------------------------------------------- |
| `mock`           | Mock provider (offline) | no      | —                                           |
| `sportsgameodds` | SportsGameOdds          | yes     | https://sportsgameodds.com/docs             |
| `theoddsapi`     | The Odds API            | yes     | https://the-odds-api.com/liveapi/guides/v4/ |

Selecting a provider that needs a key without supplying one fails fast with a
`PROVIDER_ERROR` naming exactly where to add it — it never falls back to fake
data.

## Choosing a provider

```bash
SPORTS_PROVIDER=theoddsapi
SPORTS_API_KEY=…            # or THEODDSAPI_KEY for The Odds API
SPORTS_API_BASE_URL=        # optional override
SPORTS_POLL_INTERVAL_SECONDS=120
```

Alternatively configure providers in **Admin → API Providers**, where the key is
stored encrypted (AES-256-GCM, `ENCRYPTION_KEY`) rather than in the environment.
A database record wins over the environment variable, so a key can be rotated
without a redeploy. Keys are never returned to the browser — the admin UI shows
only the last four characters.

## The mock provider

`MockProvider` generates a deterministic league calendar, odds and results from a
seed (`MOCK_PROVIDER_SEED`, default `storm-tips`). It exists for local
development, for tests, and so a fresh checkout has a working product without a
vendor account.

It is **not** production data. `DEFAULT_MOCK_SEED` is exported from one place and
used by both the database seed and the running provider: if those two disagreed,
the worker's fixture sync would rewrite teams on events the seed had already
stored — a regression test asserts both construction paths agree.

## What the worker does with it

| Job                | Schedule     | Work                                                  |
| ------------------ | ------------ | ----------------------------------------------------- |
| `sync:fixtures`    | every 15 min | Upserts events for the coming days                    |
| `sync:live`        | every minute | Scores, minute, period for in-play events             |
| `sync:odds`        | every 5 min  | Current prices per bookmaker and market               |
| `refresh:tip-odds` | every 10 min | Updates `currentOdds` on open tips and flags movement |
| `sync:results`     | every 5 min  | Final scores for finished events                      |
| `settle:due`       | every 10 min | Settles tips whose event has a verified result        |

Odds movement is recorded in `OddsHistory`; a relative change above
`ODDS_MOVEMENT_THRESHOLD` (default 5 %) marks a tip as moved, which is what the
"odds changed" hint in the apps reflects.

## Fixtures the provider does not carry

No feed covers every competition. **Catalogue → Events → Add fixture** in the
admin console enters one by hand: pick the league, name both teams, set the
kick-off. A team name that already exists in the league's sport resolves to that
team, so typing "Arsenal" reaches the Arsenal already in the catalogue instead
of adding a second one; a name that does not exist creates the team. The same
route is `POST /admin/catalogue/events`, which also accepts `homeTeamId` /
`awayTeamId` for a caller that already knows them.

Such a fixture is stored with no `providerEventId`. Every sync selects on
`providerEventId: { not: null }`, so:

- no fixture, odds or result sync can overwrite or remove it, and
- **nothing will settle it.** There are no odds to refresh and no result to
  fetch, so the operator enters the score through the pencil on the events page
  once the match is played. `settle:due` then settles the tips on it exactly as
  it would a provider result — that job selects on the event's status, not on
  where the score came from — so they are settled within the job's ten-minute
  interval rather than instantly.

A second fixture for the same pairing in the same league on the same day is
refused with `409`: it is a double submit far more often than a double-header,
and a duplicate splits the tips across two rows that then settle separately.
Rows entered this way are marked "entered by hand" in the events table.

## Adding a provider

1. Implement `SportsDataProvider` (extend `BaseProvider` for the shared HTTP
   client, retry and quota handling) in `packages/sports/src/providers/`.
2. Map the vendor's payloads onto the `Provider*` shapes — normalising market
   and selection keys here is what keeps the settlement engine vendor-agnostic.
3. Register the factory in `registry.ts` and add a row to `AVAILABLE_PROVIDERS`.
4. Add tests with recorded fixtures; `packages/sports/tests/sports.test.ts`
   shows the pattern.

No other file needs to change.

## Rate limits and quotas

`packages/sports/src/http.ts` applies a timeout, bounded retries with
exponential backoff on 5xx and 429, and records remaining quota per provider in
Redis (`provider:quota:<slug>`), which the admin console displays. A provider
that starts failing is reported through `healthCheck()` rather than silently
returning empty data.
