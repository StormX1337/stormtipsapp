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
  // Workspace packages ship TypeScript source, so they are bundled in.
  noExternal: [/^@profit-tips\//],
  external: ['@prisma/client', '.prisma'],
  banner: {
    // Some CJS dependencies expect `require` to exist in the ESM bundle.
    js: "import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);",
  },
});
