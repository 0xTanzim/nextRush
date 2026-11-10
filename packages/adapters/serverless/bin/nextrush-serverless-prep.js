#!/usr/bin/env node

/**
 * NextRush Standalone Serverless Packaging CLI
 *
 * Prepares a build directory (e.g. dist/) for AWS Lambda, Google Cloud Functions,
 * Azure Functions, and Vercel by emitting a companion package.json with
 * {"type": "module"} and a dual-entry .mjs bridge.
 *
 * Usage:
 *   npx nextrush-serverless-prep [outDir] [entryName]
 *   node bin/nextrush-serverless-prep.js dist index
 */

import { prepareServerlessPackage } from '../dist/index.js';

const outDir = process.argv[2] || 'dist';
const entryName = process.argv[3] || 'index';

try {
  const result = await prepareServerlessPackage({ outDir, entryName, verbose: true });
  console.log(`[nextrush/serverless] Packaging prepared successfully:`);
  console.log(`  ✔ ${result.packageJsonPath} ("type": "module")`);
  console.log(`  ✔ ${result.bridgePath} (dual-entry bridge)`);
} catch (err) {
  console.error(`[nextrush/serverless] Packaging failed:`, err);
  process.exit(1);
}
