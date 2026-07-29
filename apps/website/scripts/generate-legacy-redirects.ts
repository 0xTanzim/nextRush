#!/usr/bin/env node
/**
 * Static-export legacy-redirect page generator — `apps/website` build step (Phase 1 / T6).
 *
 * `next.config.mjs` sets `output: 'export'`, under which Next.js's `redirects()` config
 * option and a Route Handler's runtime `Response` status are both no-ops: static export
 * writes every route to a literal file served by a plain static file server (or GitHub
 * Pages), which always returns 200 for a file that exists — see
 * https://nextjs.org/docs/app/building-your-application/deploying/static-exports#unsupported-features
 *
 * `src/app/docs/[[...slug]]/page.tsx` already calls `redirect()` for every legacy path in
 * `legacy-redirects.ts`, which makes JS-executing clients (real browsers) navigate
 * immediately. This script is the fallback for clients that don't run that JS bundle — curl,
 * other plain HTTP clients, and crawlers: it overwrites each already-built legacy `.html`
 * file with a minimal static document containing a real `<meta http-equiv="refresh">` tag
 * (honored by `curl -L` and every browser, JS or not) plus a `location.replace` for an
 * instant redirect where JS is available.
 *
 * Runs after `next build`'s static export and the existing `postbuild.ts` (base-path asset
 * rewrite), so it operates on final file paths.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { legacyRedirects } from '../src/lib/legacy-redirects.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../out');
const BASE_PATH = (() => {
  const raw = process.env.NEXTRUSH_DOCS_BASE_PATH ?? '';
  if (!raw || raw === '/') return '';
  return raw.startsWith('/') ? raw : `/${raw}`;
})();

function redirectHtml(targetUrl: string, targetPathForDisplay: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta http-equiv="refresh" content="0; url=${targetUrl}" />
<title>Redirecting…</title>
<link rel="canonical" href="${targetUrl}" />
<script>location.replace(${JSON.stringify(targetUrl)});</script>
</head>
<body>
<p>This page has moved. Redirecting to <a href="${targetUrl}">${targetPathForDisplay}</a>&hellip;</p>
</body>
</html>
`;
}

let written = 0;

for (const [oldPath, newPath] of legacyRedirects) {
  const targetUrl = `${BASE_PATH}${newPath}`;
  const html = redirectHtml(targetUrl, newPath);

  // "/docs/getting-started/installation" -> out/docs/getting-started/installation.html
  const relative = oldPath.replace(/^\//, '');
  const htmlPath = join(OUT_DIR, `${relative}.html`);

  mkdirSync(dirname(htmlPath), { recursive: true });
  writeFileSync(htmlPath, html, 'utf-8');
  written++;

  if (!existsSync(htmlPath)) {
    throw new Error(`Failed to write legacy redirect page: ${htmlPath}`);
  }
}

process.stdout.write(
  `generate-legacy-redirects: wrote ${written}/${legacyRedirects.size} static redirect page(s).\n`
);
