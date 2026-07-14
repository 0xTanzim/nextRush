/**
 * Edge bundle-size budget gate (task group 4, spec runtime-proof-harness).
 *
 * Bundles the minimal functional edge entry (core + edge adapter, no DI/middleware)
 * and asserts it stays under budget and free of `node:` / `reflect-metadata`.
 *
 * Baseline (measured 2026-07-15, esbuild minify): 13.11 KB gzipped / 42.11 KB raw.
 * Budgets are set with headroom so ordinary growth passes but a `node:` import or
 * a non-tree-shakeable dependency trips the gate. Hard ceiling stays far below the
 * tightest platform limit (Cloudflare Workers 1 MB).
 *
 * Run: node --test bundle-budget.test.mjs
 */

import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import test from 'node:test';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));

/** Internal gzipped budget (KB). Baseline 13.11 KB → ~2.3x headroom. */
const GZIP_BUDGET_BYTES = 30 * 1024;
/** Hard raw ceiling (KB), still far under the CF Workers 1 MB limit. */
const RAW_CEILING_BYTES = 120 * 1024;

async function bundleMinimalEdge() {
  const result = await build({
    entryPoints: [join(here, 'minimal-entry.mjs')],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    conditions: ['workerd', 'worker', 'import'],
    minify: true,
    legalComments: 'none',
    write: false,
  });
  return result.outputFiles[0].text;
}

test('minimal edge bundle stays under the gzipped budget', async () => {
  const code = await bundleMinimalEdge();
  const gz = gzipSync(code).length;
  assert.ok(
    gz <= GZIP_BUDGET_BYTES,
    `minimal edge bundle ${(gz / 1024).toFixed(2)} KB gzipped exceeds budget ${(GZIP_BUDGET_BYTES / 1024).toFixed(0)} KB — investigate a new dependency or lost tree-shaking`,
  );
});

test('minimal edge bundle stays under the raw ceiling (< CF 1 MB with headroom)', async () => {
  const code = await bundleMinimalEdge();
  const raw = Buffer.byteLength(code);
  assert.ok(raw <= RAW_CEILING_BYTES, `raw ${(raw / 1024).toFixed(2)} KB exceeds ceiling ${RAW_CEILING_BYTES / 1024} KB`);
});

test('minimal edge bundle is reflect-metadata-free and node:-free', async () => {
  const code = await bundleMinimalEdge();
  assert.ok(!/(from|import)\s*["']node:/.test(code), 'minimal edge bundle must not import node: builtins');
  assert.ok(!code.includes('require("node:'), 'minimal edge bundle must not require node: builtins');
  assert.ok(
    !code.includes('reflect-metadata') && !code.includes('Reflect.getMetadata'),
    'minimal edge bundle must not pull in reflect-metadata (functional path is reflection-free)',
  );
});
