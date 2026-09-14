/**
 * Merges duplicate leagues created before the sync resolved provider keys.
 *
 *   pnpm --filter @storm-tips/database merge-leagues [--apply]
 *
 * Earlier syncs stored a provider's own shorthand as both the key and the name
 * of a new league, so `IT_SERIE_A` ended up beside `Serie A` carrying the same
 * fixtures. This moves teams, events and tips onto the catalogue league and
 * deletes the leftover, and renames any league still named after its raw key.
 *
 * Prints what it would do and changes nothing unless `--apply` is passed.
 */
import { PrismaClient } from '@prisma/client';
import { humaniseLeagueKey, resolveCatalogueLeague } from '@storm-tips/sports';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const leagues = await prisma.league.findMany({
    include: { sport: true, _count: { select: { events: true, teams: true, tips: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const byKey = new Map(leagues.map((league) => [`${league.sportId}:${league.key}`, league]));

  let merged = 0;
  let renamed = 0;

  for (const league of leagues) {
    const known = resolveCatalogueLeague(league.key, league.sport.key);

    // A league whose key resolves to a *different* league that already exists.
    const target =
      known && known.key !== league.key ? byKey.get(`${league.sportId}:${known.key}`) : undefined;

    if (target) {
      console.log(
        `merge  ${league.key} → ${target.key}  ` +
          `(${league._count.events} events, ${league._count.teams} teams, ${league._count.tips} tips)`,
      );
      if (apply) {
        await prisma.$transaction([
          prisma.team.updateMany({ where: { leagueId: league.id }, data: { leagueId: target.id } }),
          prisma.event.updateMany({
            where: { leagueId: league.id },
            data: { leagueId: target.id },
          }),
          prisma.tip.updateMany({ where: { leagueId: league.id }, data: { leagueId: target.id } }),
          prisma.league.delete({ where: { id: league.id } }),
        ]);
      }
      merged += 1;
      continue;
    }

    // A league nobody merged, still named after the raw provider key.
    const name = known?.name ?? humaniseLeagueKey(league.key);
    if (league.name !== name && league.name === league.key) {
      console.log(`rename ${league.key}: "${league.name}" → "${name}"`);
      if (apply) await prisma.league.update({ where: { id: league.id }, data: { name } });
      renamed += 1;
    }
  }

  console.log(
    `\n${merged} merge(s), ${renamed} rename(s)` + (apply ? ' applied.' : ' — run with --apply.'),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
