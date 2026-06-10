#!/usr/bin/env node
/**
 * Post-build script for NextRush docs static export.
 *
 * Rewrites root-relative asset paths in the exported HTML to include the
 * basePath prefix (e.g. `/_next/static/...` → `/nextRush/_next/static/...`).
 *
 * Needed because Turbopack does not apply `assetPrefix` in static export
 * output, causing 404s when served under a subpath (GitHub Pages project site).
 *
 * Env:
 *   NEXTRUSH_DOCS_BASE_PATH — base path (e.g. `/nextRush`). No-op when empty.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = join(__dirname, '../../apps/docs/out');
const BASE_PATH = process.env.NEXTRUSH_DOCS_BASE_PATH ?? '';

if (!BASE_PATH) {
  process.stdout.write('postbuild: NEXTRUSH_DOCS_BASE_PATH not set — skipping.\n');
  process.exit(0);
}

const prefix = BASE_PATH.startsWith('/') ? BASE_PATH : `/${BASE_PATH}`;

/** Recursively collect all files with a given extension. */
function collect(dir: string, ext: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collect(full, ext, files);
    else if (extname(full) === ext) files.push(full);
  }
  return files;
}

const targets = [...collect(OUT_DIR, '.html'), ...collect(OUT_DIR, '.txt')];
let count = 0;

// Prefix root-absolute /_next/static/ and /favicon/ paths inside HTML attributes.
// Only matches unprefixed paths — already-prefixed ones like "/nextRush/_next/static/..."
// won't match because the regex looks for `/_next/` right after a quote character.
// Example:   href="/_next/static/..."  →  href="/nextRush/_next/static/..."
//            href="/favicon/..."       →  href="/nextRush/favicon/..."
//            href="/nextRush/_next/..." → skipped (already prefixed)
const ASSET_RE = /(["'])\/(?:_next\/static|favicon)\//g;

for (const file of targets) {
  const original = readFileSync(file, 'utf-8');
  const updated = original.replace(ASSET_RE, `$1${prefix}/`);
  if (updated !== original) {
    writeFileSync(file, updated, 'utf-8');
    count++;
  }
}

process.stdout.write(
  `postbuild: rewrote asset paths in ${count}/${targets.length} files (prefix: ${prefix})\n`
);
