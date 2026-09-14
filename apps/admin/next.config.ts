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
  transpilePackages: ['@storm-tips/ui', '@storm-tips/types'],
  eslint: { ignoreDuringBuilds: true },
  webpack(webpackConfig) {
    webpackConfig.resolve.extensionAlias = {
      ...webpackConfig.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return webpackConfig;
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
          { key: 'Referrer-Policy', value: 'no-referrer' },
          // The admin console must never be indexed.
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        ],
      },
    ];
  },
};

export default config;
