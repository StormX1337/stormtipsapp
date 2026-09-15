import { execFileSync } from 'node:child_process';
import Redis from 'ioredis';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { decryptSecret } from '@storm-tips/auth';
import { QUEUE_NAMES, REDIS_KEYS } from '@storm-tips/config';
import { isUsableStripePriceId } from '@storm-tips/payments';

/**
 * One command that answers "why is nothing happening?".
 *
 * Every check here exists because the failure it catches was silent: a full
 * disk that made Redis refuse writes, a worker nobody had started, plans with
 * no Stripe price, an ENCRYPTION_KEY rotated out from under the stored provider
 * key. In each case the app kept serving and the symptom appeared somewhere
 * else entirely — so the value is in naming the cause and the fix, not in the
 * check being clever.
 *
 * Read-only. Nothing here changes a single row or setting.
 *
 *   pnpm health
 */

type Level = 'ok' | 'warn' | 'fail';

interface Result {
  name: string;
  level: Level;
  detail: string;
  /** The command or click that fixes it. Omitted when there is nothing to fix. */
  fix?: string;
}

const results: Result[] = [];
const ok = (name: string, detail: string) => results.push({ name, level: 'ok', detail });
const warn = (name: string, detail: string, fix?: string) =>
  results.push({ name, level: 'warn', detail, fix });
const fail = (name: string, detail: string, fix?: string) =>
  results.push({ name, level: 'fail', detail, fix });

/** Driver errors arrive as paragraphs; the report has one line per check. */
const message = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).replace(/\s+/g, ' ').trim();

// ── disk ─────────────────────────────────────────────────────────────────────

/**
 * Checked first because it is upstream of almost everything else: Redis stops
 * accepting writes when it cannot save, and Postgres stops accepting them when
 * it cannot extend a file.
 */
interface Filesystem {
  mount: string;
  availableKb: number;
  usedPercent: number;
}

/** One `df` reading, or null when the path is not on a filesystem we can read. */
function measure(path: string): Filesystem | null {
  let output: string;
  try {
    output = execFileSync('df', ['-Pk', path], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
  const columns = (output.trim().split('\n').at(-1) ?? '').split(/\s+/);
  const availableKb = Number(columns[3]);
  const usedPercent = Number((columns[4] ?? '').replace('%', ''));
  const mount = columns[5] ?? path;
  if (!Number.isFinite(availableKb) || !Number.isFinite(usedPercent)) return null;
  return { mount, availableKb, usedPercent };
}

/**
 * Checked first because it is upstream of almost everything else: Redis stops
 * accepting writes when it cannot save, and Postgres stops accepting them when
 * it cannot extend a file.
 *
 * Several filesystems are read, not just this one, because moving the heavy
 * directories onto a second volume is the usual answer to a full disk — and
 * then watching only the new volume misses the root filesystem quietly filling
 * up again, which is the failure that started all this. Each mount is reported
 * once, so the common single-disk case still prints one line.
 */
function checkDisk(): void {
  const candidates = [process.cwd(), '/', '/var/lib/postgresql', '/var/lib/redis', '/var/log'];
  const byMount = new Map<string, Filesystem>();
  for (const path of candidates) {
    const reading = measure(path);
    if (reading) byMount.set(reading.mount, reading);
  }

  if (byMount.size === 0) {
    warn('Disk', 'could not be measured');
    return;
  }

  for (const filesystem of [...byMount.values()].sort((a, b) => b.usedPercent - a.usedPercent)) {
    // The mount goes in the detail, not the name: a long volume path in the
    // name column would widen every other row in the report.
    const where = byMount.size === 1 ? '' : `${filesystem.mount} — `;
    const free = `${where}${(filesystem.availableKb / 1024 / 1024).toFixed(1)} GB free, ${filesystem.usedPercent}% used`;
    if (filesystem.usedPercent >= 95) {
      fail('Disk', free, 'Free space now — Redis and Postgres both refuse writes when full.');
    } else if (filesystem.usedPercent >= 85) {
      warn('Disk', free, 'Free space before it reaches 95%.');
    } else {
      ok('Disk', free);
    }
  }
}

// ── redis ────────────────────────────────────────────────────────────────────

/**
 * A refused write is not a connection problem, and reporting it as one sends
 * the reader to check REDIS_URL while the real cause is a full disk. ioredis
 * surfaces it from whichever command happens to hit it first — sometimes the
 * handshake, sometimes the probe below — so it is recognised in one place and
 * both call sites use the verdict.
 */
function describeRedisError(error: unknown): Result | null {
  const text = message(error);
  if (text.includes('MISCONF')) {
    return {
      name: 'Redis',
      level: 'fail',
      detail: 'refusing every write — its last snapshot to disk failed',
      fix: 'Free disk space, then check that `redis-cli BGSAVE` reports success.',
    };
  }
  if (text.includes('NOAUTH') || text.includes('WRONGPASS')) {
    return {
      name: 'Redis',
      level: 'fail',
      detail: 'rejected the credentials in REDIS_URL',
      fix: 'Check the password in REDIS_URL.',
    };
  }
  return null;
}

/**
 * Reaching Redis is not the same as being able to use it: after a failed
 * snapshot it can still answer some commands while refusing every write, which
 * is how a full disk surfaces as "the worker won't start".
 */
async function checkRedis(url: string): Promise<Redis | null> {
  const redis = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
  redis.on('error', () => {
    /* handled by the awaits below; the listener only stops an unhandled event */
  });

  try {
    await redis.connect();
    await redis.ping();
  } catch (error) {
    const known = describeRedisError(error);
    if (known) {
      results.push(known);
      // Usable enough to read the heartbeat, so the connection is kept open.
      return redis;
    }
    fail('Redis', `unreachable — ${message(error)}`, 'Check REDIS_URL and that Redis is running.');
    redis.disconnect();
    return null;
  }

  const probe = `doctor:probe:${process.pid}`;
  try {
    await redis.set(probe, '1', 'EX', 10);
    await redis.del(probe);
    ok('Redis', 'reachable, accepting writes');
  } catch (error) {
    const known = describeRedisError(error);
    if (known) results.push(known);
    else fail('Redis', `reachable but a write failed — ${message(error)}`);
  }
  return redis;
}

// ── worker ───────────────────────────────────────────────────────────────────

/**
 * The heartbeat expires unless the worker renews it, so a missing key means no
 * worker — including one that was killed rather than stopped.
 */
async function checkWorker(redis: Redis): Promise<void> {
  let beat: string | null = null;
  try {
    beat = await redis.get(REDIS_KEYS.workerHeartbeat());
  } catch {
    // Redis already reported as failing; no second complaint about the same thing.
    return;
  }

  if (!beat) {
    fail(
      'Worker',
      'not running — no fixtures, live scores, results, settlement or scheduled publishing',
      'pnpm --filter @storm-tips/worker start',
    );
    return;
  }

  let waiting = 0;
  let failed = 0;
  for (const queue of Object.values(QUEUE_NAMES)) {
    try {
      waiting += Number(await redis.llen(`bull:${queue}:wait`));
      failed += Number(await redis.zcard(`bull:${queue}:failed`));
    } catch {
      /* a queue that has never existed simply has nothing to count */
    }
  }

  const depth = `${waiting} job(s) waiting, ${failed} failed`;
  if (failed > 0) {
    warn('Worker', `running — ${depth}`, 'Check the worker log for what is failing.');
  } else {
    ok('Worker', `running — ${depth}`);
  }
}

// ── database ─────────────────────────────────────────────────────────────────

async function checkDatabase(prisma: PrismaClient): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    fail(
      'Database',
      `unreachable — ${message(error)}`,
      'Check DATABASE_URL and that Postgres is running.',
    );
    return false;
  }

  try {
    const pending = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM "_prisma_migrations"
      WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL`;
    const stuck = Number(pending[0]?.count ?? 0);
    if (stuck > 0) {
      fail('Database', `${stuck} migration(s) unfinished or rolled back`, 'pnpm db:migrate:deploy');
      return true;
    }
    const applied = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`;
    ok('Database', `reachable, ${Number(applied[0]?.count ?? 0)} migration(s) applied`);
  } catch {
    // No migrations table at all: the schema was pushed rather than migrated.
    warn('Database', 'reachable, but no migration history', 'pnpm db:migrate:deploy');
  }
  return true;
}

// ── stripe ───────────────────────────────────────────────────────────────────

async function checkStripe(prisma: PrismaClient): Promise<void> {
  const secret = process.env.STRIPE_SECRET_KEY ?? '';
  const publishable = process.env.STRIPE_PUBLISHABLE_KEY ?? '';
  const publicKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

  if (/^(sk|rk)_/.test(publishable) || /^(sk|rk)_/.test(publicKey)) {
    fail(
      'Stripe keys',
      'a SECRET key is set as the publishable key — it would be served to every browser',
      'Use the pk_ key, and roll the secret key in Stripe → Developers → API keys.',
    );
  } else if (!secret || secret.includes('replace_me')) {
    fail('Stripe keys', 'STRIPE_SECRET_KEY is unset or still the placeholder', 'Set it in .env.');
  } else if (!publicKey || publicKey.includes('replace_me')) {
    fail(
      'Stripe keys',
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is unset or still the placeholder',
      'Set it in .env, then rebuild — it is compiled into the browser bundle.',
    );
  } else {
    const mode = secret.startsWith('sk_live_') ? 'live' : 'test';
    const publicMode = publicKey.startsWith('pk_live_') ? 'live' : 'test';
    if (mode !== publicMode) {
      fail(
        'Stripe keys',
        `the secret key is ${mode} but the publishable key is ${publicMode}`,
        'Both keys must come from the same mode.',
      );
    } else {
      ok('Stripe keys', `${mode} mode`);
    }
  }

  const [plans, fixPlans] = await Promise.all([
    prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      select: { slug: true, stripePriceId: true, appleProductId: true, googleProductId: true },
    }),
    prisma.fixOddsPlan.findMany({
      where: { isActive: true },
      select: { slug: true, stripePriceId: true, appleProductId: true, googleProductId: true },
    }),
  ]);
  const all = [...plans, ...fixPlans];

  const unpriced = all.filter((plan) => !isUsableStripePriceId(plan.stripePriceId));
  if (all.length === 0) {
    warn('Plans', 'no active plan exists', 'pnpm db:seed');
  } else if (unpriced.length > 0) {
    fail(
      'Plans',
      `${unpriced.length} of ${all.length} active plan(s) have no usable Stripe price — they cannot be bought`,
      'pnpm --filter @storm-tips/database stripe-sync-prices -- --apply',
    );
  } else {
    ok('Plans', `all ${all.length} active plan(s) priced`);
  }

  const noApple = all.filter((plan) => !plan.appleProductId).length;
  const noGoogle = all.filter((plan) => !plan.googleProductId).length;
  if (all.length > 0 && (noApple > 0 || noGoogle > 0)) {
    warn(
      'Store products',
      `${noApple} plan(s) without an Apple product id, ${noGoogle} without a Google one`,
      'In-app purchase fails without them. Create each product in the store, then set the id under Admin → Plans.',
    );
  } else if (all.length > 0) {
    ok('Store products', 'every plan carries an Apple and Google product id');
  }

  // Only worth asking Stripe when there is a key that could plausibly work.
  if (/^(sk|rk)_/.test(secret) && !secret.includes('replace_me')) {
    try {
      await new Stripe(secret).balance.retrieve();
      ok('Stripe API', 'the secret key works');
    } catch (error) {
      /**
       * Only an authentication error says anything about the key. Everything
       * else — no route out, a proxy answering with HTML — says the check could
       * not be made, and calling that a rejected key sends the reader to roll a
       * key that was fine.
       */
      const type = (error as { type?: string }).type;
      if (type === 'StripeAuthenticationError' || type === 'StripePermissionError') {
        fail('Stripe API', `the secret key was rejected — ${message(error)}`);
      } else {
        warn('Stripe API', `could not be reached, so the key is unverified — ${message(error)}`);
      }
    }
  }
}

// ── provider keys ────────────────────────────────────────────────────────────

/**
 * AES-GCM authenticates the ciphertext, so a decryption failure on an untouched
 * row means ENCRYPTION_KEY is no longer the key it was stored with. The key
 * cannot be recovered; it has to be entered again.
 */
async function checkProviderKeys(prisma: PrismaClient): Promise<void> {
  const key = process.env.ENCRYPTION_KEY ?? '';
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    fail('Encryption key', 'ENCRYPTION_KEY is not 64 hex characters', 'openssl rand -hex 32');
    return;
  }

  const providers = await prisma.apiProvider.findMany({
    where: { isActive: true },
    select: { slug: true, apiKeyEncrypted: true },
  });
  const stored = providers.filter((provider) => provider.apiKeyEncrypted);
  if (stored.length === 0) {
    warn(
      'Provider keys',
      'no active provider has a stored key',
      'Enter one under Admin → API providers.',
    );
    return;
  }

  const broken = stored.filter((provider) => {
    try {
      decryptSecret(provider.apiKeyEncrypted as string, key);
      return false;
    } catch {
      return true;
    }
  });

  if (broken.length > 0) {
    fail(
      'Provider keys',
      `${broken.map((provider) => provider.slug).join(', ')}: stored key cannot be decrypted with the current ENCRYPTION_KEY`,
      'Re-enter it under Admin → API providers. It cannot be recovered.',
    );
  } else {
    ok('Provider keys', `${stored.length} stored key(s) decrypt correctly`);
  }
}

// ── placeholders ─────────────────────────────────────────────────────────────

/** Values shipped in `.env.example` that mean "nobody filled this in". */
function checkPlaceholders(): void {
  const suspicious = Object.entries(process.env)
    .filter(
      ([name, value]) =>
        /replace_me|changeme|ChangeMe!/i.test(value ?? '') && !name.startsWith('npm_'),
    )
    .map(([name]) => name);

  if (suspicious.length > 0) {
    warn(
      'Configuration',
      `still on a placeholder: ${suspicious.join(', ')}`,
      'Set real values in .env.',
    );
  } else {
    ok('Configuration', 'no placeholder values left in the environment');
  }
}

// ── report ───────────────────────────────────────────────────────────────────

function report(): number {
  const mark: Record<Level, string> = { ok: '✓', warn: '!', fail: '✗' };
  const width = Math.max(...results.map((result) => result.name.length));

  console.log('\nSTORM TIPS · system check\n');
  for (const result of results) {
    console.log(`  ${mark[result.level]} ${result.name.padEnd(width)}  ${result.detail}`);
    if (result.fix && result.level !== 'ok') {
      console.log(`  ${' '.repeat(width + 4)}→ ${result.fix}`);
    }
  }

  const failures = results.filter((result) => result.level === 'fail').length;
  const warnings = results.filter((result) => result.level === 'warn').length;
  console.log(
    failures === 0 && warnings === 0
      ? '\nEverything checks out.\n'
      : `\n${failures} problem(s), ${warnings} warning(s).\n`,
  );
  return failures > 0 ? 1 : 0;
}

async function main(): Promise<void> {
  checkDisk();

  const redis = await checkRedis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  if (redis) await checkWorker(redis);

  const prisma = new PrismaClient();
  if (await checkDatabase(prisma)) {
    await checkStripe(prisma);
    await checkProviderKeys(prisma);
  }
  checkPlaceholders();

  await prisma.$disconnect();
  redis?.disconnect();
  process.exitCode = report();
}

await main();
