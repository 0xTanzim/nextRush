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
  ...(normalizedBasePath
    ? {
        basePath: normalizedBasePath,
        assetPrefix: `${normalizedBasePath}/`,
      }
    : null),
};

export default withMDX(config);
