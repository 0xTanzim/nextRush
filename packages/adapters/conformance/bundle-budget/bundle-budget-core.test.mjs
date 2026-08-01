/**
 * Core bundle-size budget gate (T012 residual scope, spec core-bundle-size-budget).
 *
 * Bundles the minimal functional core entry (core + router + the Node adapter,
 * no DI/middleware) and asserts it stays under budget. Distinct from
 * bundle-budget.test.mjs (the edge-scoped bundle: core + adapter-edge only) —
 * this measures the general functional path (`createApp`/`createRouter`/`listen`
 * from `nextrush`'s default entry), which has no edge-specific size constraint
 * but still needs a measured, gated budget so dependency creep is caught.
 *
 * Baseline (measured 2026-07-16, esbuild minify, platform: node):
 * 17.65 KB gzipped / 59.48 KB raw. Larger than the edge bundle (13.11 KB) because
 * the Node adapter path pulls in @nextrush/runtime + @nextrush/stream, which the
 * edge bundle doesn't need at this scope.
 *
 * Headroom follows the same ratio the edge budget used (measured baseline * ~2.3
 * for the gzip budget, matching gap-checklist's own "measured baseline + target
 * with headroom" pattern rather than an invented number):
 *   - gzip:  17.65 KB -> 40 KB budget (~2.3x headroom)
 *   - raw:   59.48 KB -> 175 KB ceiling (~2.9x headroom)
 *
 * Run: node --test bundle-budget-core.test.mjs
 */

import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import test from 'node:test';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));

/** Internal gzipped budget (KB). Baseline 17.65 KB -> ~2.3x headroom. */
const GZIP_BUDGET_BYTES = 40 * 1024;
/** Raw ceiling (KB). Baseline 59.48 KB -> ~2.9x headroom. */
const RAW_CEILING_BYTES = 175 * 1024;

async function bundleMinimalCore() {
  const result = await build({
    entryPoints: [join(here, 'minimal-core-entry.mjs')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    minify: true,
    legalComments: 'none',
    write: false,
  });
  return result.outputFiles[0].text;
}

test('minimal core bundle stays under the gzipped budget', async () => {
  const code = await bundleMinimalCore();
  const gz = gzipSync(code).length;
  assert.ok(
    gz <= GZIP_BUDGET_BYTES,
    `minimal core bundle ${(gz / 1024).toFixed(2)} KB gzipped exceeds budget ${(GZIP_BUDGET_BYTES / 1024).toFixed(0)} KB — investigate a new dependency or lost tree-shaking`,
  );
});

test('minimal core bundle stays under the raw ceiling', async () => {
  const code = await bundleMinimalCore();
  const raw = Buffer.byteLength(code);
  assert.ok(raw <= RAW_CEILING_BYTES, `raw ${(raw / 1024).toFixed(2)} KB exceeds ceiling ${RAW_CEILING_BYTES / 1024} KB`);
});
