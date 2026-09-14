/**
 * Creates the Stripe product and price for every plan that has none, and
 * writes the price id back onto the plan.
 *
 *   pnpm --filter @storm-tips/database stripe-sync-prices            # dry run
 *   pnpm --filter @storm-tips/database stripe-sync-prices -- --apply
 *   pnpm --filter @storm-tips/database stripe-sync-prices -- --reset  # forget the ids
 *
 * Runs against whatever STRIPE_SECRET_KEY is in `.env`, so a test key creates
 * test prices and a live key creates live ones.
 *
 * Price ids are per-mode: a test id means nothing to a live key and the
 * checkout fails with "No such price". So switching modes is two steps —
 * `--reset` to clear the stored ids, then `--apply` to create them in the mode
 * the current key belongs to. `--reset` touches nothing in Stripe; the prices
 * it forgets stay there and are found again by slug if you switch back.
 *
 * Idempotent in both directions. A plan that already carries a real price id
 * is left alone, and a product this script created before is reused rather
 * than duplicated — it is looked up by the plan's slug, which is stored in the
 * product's metadata. A leftover `price_dev_…` placeholder from an older seed
 * counts as unset and is replaced.
 *
 * Stripe prices are immutable: changing a plan's amount or interval means a
 * new price. Clear the plan's Stripe Price ID in the admin and run this again.
 */
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { isUsableStripePriceId } from '@storm-tips/payments';

const prisma = new PrismaClient();

const INTERVAL: Record<string, Stripe.PriceCreateParams.Recurring.Interval | null> = {
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
  YEAR: 'year',
  ONE_TIME: null,
};

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const reset = process.argv.includes('--reset');

  if (reset) {
    const plans = await prisma.subscriptionPlan.updateMany({ data: { stripePriceId: null } });
    const fix = await prisma.fixOddsPlan.updateMany({ data: { stripePriceId: null } });
    console.log(
      `Cleared the stored price id on ${plans.count} plan(s) and ${fix.count} fix odds plan(s).\n` +
        'Nothing was changed in Stripe. Run with --apply to create them for the current key.',
    );
    return;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey || secretKey.includes('replace_me')) {
    console.error('STRIPE_SECRET_KEY is not set in .env — nothing to talk to.');
    process.exitCode = 1;
    return;
  }

  const stripe = new Stripe(secretKey);
  const mode = secretKey.startsWith('sk_live_') ? 'LIVE' : 'test';
  console.log(`Stripe mode: ${mode}\n`);

  const plans = await prisma.subscriptionPlan.findMany({ orderBy: { sortOrder: 'asc' } });
  const fixOdds = await prisma.fixOddsPlan.findMany({ orderBy: { sortOrder: 'asc' } });

  let created = 0;
  let skipped = 0;

  const handle = async (
    kind: 'plan' | 'fix-odds',
    row: {
      id: string;
      slug: string;
      name: string;
      priceCents: number;
      currency: string;
      stripePriceId: string | null;
      interval?: string;
      intervalCount?: number;
    },
  ): Promise<void> => {
    if (isUsableStripePriceId(row.stripePriceId)) {
      console.log(`skip   ${row.slug} — already has ${row.stripePriceId}`);
      skipped += 1;
      return;
    }
    // A leftover `price_dev_…` placeholder is not a price Stripe can charge,
    // so it is replaced rather than treated as configured.
    if (row.stripePriceId) {
      console.log(`       ${row.slug} — replacing placeholder ${row.stripePriceId}`);
    }

    const recurring = row.interval ? INTERVAL[row.interval] : null;
    const shape = recurring
      ? `${(row.priceCents / 100).toFixed(2)} ${row.currency} every ${row.intervalCount ?? 1} ${recurring}(s)`
      : `${(row.priceCents / 100).toFixed(2)} ${row.currency} one-off`;
    console.log(`create ${row.slug} — ${row.name}: ${shape}`);
    if (!apply) return;

    // Reuse a product from an earlier run rather than making a second one.
    const existing = await stripe.products.search({
      query: `metadata['stormTipsSlug']:'${row.slug}'`,
      limit: 1,
    });
    const product =
      existing.data[0] ??
      (await stripe.products.create({
        name: row.name,
        metadata: { stormTipsSlug: row.slug, stormTipsKind: kind },
      }));

    const price = await stripe.prices.create({
      product: product.id,
      currency: row.currency.toLowerCase(),
      unit_amount: row.priceCents,
      ...(recurring
        ? { recurring: { interval: recurring, interval_count: row.intervalCount ?? 1 } }
        : {}),
      metadata: { stormTipsSlug: row.slug },
    });

    if (kind === 'plan') {
      await prisma.subscriptionPlan.update({
        where: { id: row.id },
        data: { stripePriceId: price.id },
      });
    } else {
      await prisma.fixOddsPlan.update({ where: { id: row.id }, data: { stripePriceId: price.id } });
    }
    console.log(`       → ${price.id}`);
    created += 1;
  };

  for (const plan of plans) await handle('plan', plan);
  for (const plan of fixOdds) await handle('fix-odds', plan);

  console.log(
    `\n${created} price(s) created, ${skipped} left alone` +
      (apply ? '.' : ' — nothing written, run with --apply.'),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
