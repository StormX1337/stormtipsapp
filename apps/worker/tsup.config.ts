import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  sourcemap: true,
  clean: true,
  splitting: false,
  noExternal: [/^@profit-tips\//],
  // Native addons (and Prisma's generated client) must stay external: esbuild
  // cannot inline a platform-specific .node binary.
  external: ['@prisma/client', '.prisma', '@node-rs/argon2'],
  banner: {
    js: "import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);",
  },
});
