import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

const basePath = process.env.NEXTRUSH_DOCS_BASE_PATH ?? '';
const normalizedBasePath =
  basePath && basePath !== '/' ? (basePath.startsWith('/') ? basePath : `/${basePath}`) : '';

/**
 * Static HTML export → `out/` (no Node server). Deploy to any static host, or Vercel with
 * “Output Directory” = `out` and framework preset “Other” / static. For SSR or `next start`,
 * remove `output: 'export'` and adjust Fumadocs/Next accordingly.
 *
 * @type {import('next').NextConfig}
 */
const config = {
  output: 'export',
  reactStrictMode: true,
  /** Playwright / MCP hit dev server via 127.0.0.1 — avoid cross-origin dev warnings */
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  // Cap Next.js/webpack build worker parallelism so a docs build doesn't compete with
  // the rest of the monorepo (turbo tasks, MCP servers, editor) for all CPU cores/RAM
  // on a resource-constrained dev machine.
  // NOTE (verified in next@16.3.5 source): this app builds with Turbopack, which is
  // parallel by design — the webpack build worker and its `parallelServer*`
  // companions are webpack-only and error out under Turbopack, so they stay off.
  // Barrel-import trimming lives under `experimental` in v16.
  experimental: {
    // webpackBuildWorker: true,
    optimizePackageImports: ['lucide-react'],
  },
  ...(normalizedBasePath
    ? {
        basePath: normalizedBasePath,
        assetPrefix: `${normalizedBasePath}/`,
      }
    : null),
};

export default withMDX(config);
