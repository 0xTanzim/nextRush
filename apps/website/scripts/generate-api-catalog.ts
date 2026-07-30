/**
 * Build-time API Catalog generator (RFC 9727).
 *
 * Generates `public/.well-known/api-catalog` — a Linkset
 * (application/linkset+json) describing the site's APIs for automated
 * discovery.  Runs in the `prebuild` step alongside generate-openapi.ts.
 *
 * See https://www.rfc-editor.org/rfc/rfc9727
 *     https://www.rfc-editor.org/rfc/rfc9264
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/* ------------------------------------------------------------------ */
/*  Site identity                                                      */
/* ------------------------------------------------------------------ */
const SITE_URL =
  process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://nextrush.dev';

/* ------------------------------------------------------------------ */
/*  API Catalog — Linkset (RFC 9264 §4.2, RFC 9727 §4.2 / Appendix A.1)*/
/* ------------------------------------------------------------------ */
const apiCatalog = {
  linkset: [
    {
      /** Every API in this catalog shares the site root as its context. */
      anchor: SITE_URL,
      /** Machine-readable API description (OpenAPI 3.1 spec). */
      'service-desc': [
        {
          href: `${SITE_URL}/openapi.json`,
          type: 'application/json',
        },
      ],
      /** Human-readable API documentation. */
      'service-doc': [
        {
          href: `${SITE_URL}/docs`,
          type: 'text/html',
        },
      ],
      /** System health / liveness endpoint. */
      status: [
        {
          href: `${SITE_URL}/health`,
          type: 'application/json',
        },
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  Write                                                              */
/* ------------------------------------------------------------------ */
const OUT_DIR = path.resolve(here, '../public/.well-known');
const OUT = path.resolve(OUT_DIR, 'api-catalog');

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, `${JSON.stringify(apiCatalog, null, 2)}\n`);

console.log(`[api-catalog] wrote ${OUT} — 1 catalog entry, ${SITE_URL}`);
