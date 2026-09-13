import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Workspace packages ship TypeScript source and must be compiled by Next.
  transpilePackages: ['@profit-tips/ui', '@profit-tips/types'],
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
