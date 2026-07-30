import { DOCS_GETTING_STARTED } from '@/lib/docs-links';

/**
 * Guide/reference link targets for the /packages catalog, keyed by npm
 * package name from package-registry.ts.
 *
 * Every path here was verified to exist under apps/website/content/docs/**
 * at the time of writing. A package with no guide, or no reference, simply
 * omits that key — the catalog card renders only the links that resolve,
 * never a placeholder pointing at a 404. Do not add a path here without
 * confirming the corresponding .mdx file exists.
 */

export interface PackageLinks {
  readonly guide?: string;
  readonly reference?: string;
}

export const packageLinks: Readonly<Record<string, PackageLinks>> = {
  // ---- Core -------------------------------------------------------------
  nextrush: { reference: '/docs/reference/nextrush', guide: DOCS_GETTING_STARTED },
  '@nextrush/core': { reference: '/docs/reference/core', guide: '/docs/concepts/application' },
  '@nextrush/router': { reference: '/docs/reference/router', guide: '/docs/concepts/routing' },
  '@nextrush/types': { reference: '/docs/reference/types' },
  '@nextrush/errors': { reference: '/docs/reference/errors', guide: '/docs/guides/error-handling' },
  '@nextrush/runtime': {
    reference: '/docs/reference/runtime',
    guide: '/docs/concepts/runtime-compatibility',
  },
  '@nextrush/stream': { reference: '/docs/reference/stream' },

  // ---- Class Runtime ------------------------------------------------------
  '@nextrush/class': { reference: '/docs/reference/class', guide: '/docs/concepts/dependency-injection' },
  '@nextrush/di': { reference: '/docs/reference/class/di', guide: '/docs/concepts/dependency-injection' },
  '@nextrush/testing': { guide: '/docs/guides/testing' },

  // ---- Security -----------------------------------------------------------
  '@nextrush/helmet': { reference: '/docs/reference/helmet', guide: '/docs/guides/security' },
  '@nextrush/cors': { reference: '/docs/reference/cors', guide: '/docs/guides/security' },
  '@nextrush/csrf': { reference: '/docs/reference/csrf', guide: '/docs/guides/security' },
  '@nextrush/rate-limit': {
    reference: '/docs/reference/rate-limit',
    guide: '/docs/guides/security',
  },

  // ---- Request Data --------------------------------------------------------
  '@nextrush/body-parser': { reference: '/docs/reference/body-parser' },
  '@nextrush/form-data': {
    reference: '/docs/reference/form-data',
    guide: '/docs/guides/file-upload',
  },
  '@nextrush/cookies': { reference: '/docs/reference/cookies' },
  '@nextrush/validation': {
    reference: '/docs/reference/validation',
    guide: '/docs/guides/validation',
  },

  // ---- Responses ------------------------------------------------------------
  '@nextrush/compression': { reference: '/docs/reference/compression' },
  '@nextrush/static': { reference: '/docs/reference/static' },
  '@nextrush/template': { reference: '/docs/reference/template' },
  '@nextrush/openapi': { reference: '/docs/reference/openapi' },

  // ---- Observability ------------------------------------------------------
  '@nextrush/logger': { reference: '/docs/reference/logger' },
  '@nextrush/request-id': { reference: '/docs/reference/request-id' },
  '@nextrush/timer': { reference: '/docs/reference/timer' },
  '@nextrush/health': { reference: '/docs/reference/health' },

  // ---- Real-time & Events --------------------------------------------------
  '@nextrush/events': { reference: '/docs/reference/events' },
  '@nextrush/websocket': {
    reference: '/docs/reference/websocket',
    guide: '/docs/guides/websocket',
  },

  // ---- Platforms -------------------------------------------------------------
  '@nextrush/adapter-node': { reference: '/docs/reference/platforms/node' },
  '@nextrush/adapter-bun': { reference: '/docs/reference/platforms/bun' },
  '@nextrush/adapter-deno': { reference: '/docs/reference/platforms/deno' },
  '@nextrush/adapter-edge': { reference: '/docs/reference/platforms/edge' },
  '@nextrush/adapter-serverless': { reference: '/docs/reference/platforms/serverless' },

  // ---- Tooling ----------------------------------------------------------------
  '@nextrush/dev': { reference: '/docs/reference/dev', guide: '/docs/guides/dev-tools' },
  'create-nextrush': { guide: DOCS_GETTING_STARTED },
} as const;

export function getPackageLinks(name: string): PackageLinks {
  return packageLinks[name] ?? {};
}
