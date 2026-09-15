import { cp, access } from 'node:fs/promises';
import path from 'node:path';

/**
 * Completes a `output: 'standalone'` build.
 *
 * Next traces the server's dependencies into `.next/standalone` but copies
 * neither `.next/static` nor `public` — it says so in its docs and nowhere in
 * its output. Run the server without them and it starts, serves HTML, and
 * 404s every stylesheet and script: a site that looks broken rather than down,
 * which is the worst kind of deployment failure to diagnose.
 *
 *   node scripts/copy-standalone-assets.mjs        # from an app directory
 */
const app = process.cwd();
const root = path.join(app, '.next/standalone', path.relative(path.join(app, '../..'), app));

const copies = [
  { from: path.join(app, '.next/static'), to: path.join(root, '.next/static') },
  { from: path.join(app, 'public'), to: path.join(root, 'public') },
];

for (const { from, to } of copies) {
  try {
    await access(from);
  } catch {
    // An app without a `public` directory is fine; a missing `static` is not,
    // but that means the build itself did not run, which is louder elsewhere.
    continue;
  }
  await cp(from, to, { recursive: true });
  console.log(`copied ${path.relative(app, from)} → ${path.relative(app, to)}`);
}
