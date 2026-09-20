import { rm, readdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * Clears the previous build's output, keeping the compiler cache.
 *
 * `next build` writes over `.next` in place rather than replacing it, so a
 * build that ends part-written — the disk fills, the machine is rebooted, a
 * worker is killed — leaves a manifest listing routes whose server modules are
 * not there. The next build compiles fine and then dies collecting page data
 * with `PageNotFoundError: Cannot find module for page: /…`, naming a page
 * whose source is present and correct. The error points at the source; the
 * fault is in the leftovers.
 *
 * `.next/cache` is deliberately kept: it is what makes a rebuild fast, it is
 * content-addressed, and it has never been the thing that goes stale here.
 *
 *   node scripts/clean-next-output.mjs        # from an app directory
 */
const next = path.join(process.cwd(), '.next');

let entries;
try {
  entries = await readdir(next);
} catch {
  // Nothing built yet, which is the state this script is trying to reach.
  process.exit(0);
}

await Promise.all(
  entries
    .filter((entry) => entry !== 'cache')
    .map((entry) => rm(path.join(next, entry), { recursive: true, force: true })),
);
