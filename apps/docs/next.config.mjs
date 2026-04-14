import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  output: 'export',
  reactStrictMode: true,
  /** Playwright / MCP hit dev server via 127.0.0.1 — avoid cross-origin dev warnings */
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
};

export default withMDX(config);
