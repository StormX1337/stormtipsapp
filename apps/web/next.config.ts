import path from 'node:path';
import type { NextConfig } from 'next';

/** Where the Next server reaches the API. Never sent to the browser. */
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Emits a self-contained server bundle for the container image.
  output: 'standalone',
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  // Workspace packages ship TypeScript source and must be compiled by Next.
  transpilePackages: ['@storm-tips/ui', '@storm-tips/types'],
  eslint: {
    // Linting runs once for the whole monorepo via `pnpm lint`; running it again
    // here would need a second, duplicated ESLint config.
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  /**
   * Workspace packages are ESM TypeScript and import siblings with an explicit
   * `.js` extension (required by Node ESM). Webpack needs to be told that a
   * `.js` specifier may resolve to a `.ts` source.
   */
  webpack(webpackConfig) {
    webpackConfig.resolve.extensionAlias = {
      ...webpackConfig.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return webpackConfig;
  },
  turbopack: {
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
  },
  /**
   * Same-origin API.
   *
   * The browser calls `/api/v1/...` on this origin and Next.js forwards it to
   * the API over the private network. That removes the two things this
   * deployment kept tripping over: an absolute API URL compiled into the client
   * bundle (which points at the *visitor's* machine when it says localhost),
   * and a CORS allowlist that has to know every front-end origin.
   *
   * Filesystem routes still win, so this never shadows a real route handler.
   * It does not cover the WebSocket upgrade — rewrites cannot — so realtime
   * needs `NEXT_PUBLIC_WS_URL` or a reverse proxy.
   */
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_INTERNAL_URL}/api/:path*`,
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default config;
