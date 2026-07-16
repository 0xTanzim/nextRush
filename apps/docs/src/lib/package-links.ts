/**
 * Guide/reference link targets for the /packages catalog, keyed by npm
 * package name from package-registry.ts.
 *
 * Every path here was verified to exist under apps/docs/content/docs/**
 * at the time of writing (see docs/documentation-rebuild/PLAN.md T13).
 * A package with no guide, or no reference, simply omits that key — the
 * catalog card renders only the links that resolve, never a placeholder
 * pointing at a 404. Do not add a path here without confirming the
 * corresponding .mdx file exists.
 */

export interface PackageLinks {
  readonly guide?: string;
  readonly reference?: string;
}

export const packageLinks: Readonly<Record<string, PackageLinks>> = {
  // ---- Core -------------------------------------------------------------
  nextrush: { reference: '/docs/reference/core/nextrush', guide: '/docs/start' },
  '@nextrush/core': { reference: '/docs/reference/core/core', guide: '/docs/concepts/application' },
  '@nextrush/router': { reference: '/docs/reference/core/router', guide: '/docs/concepts/routing' },
  '@nextrush/types': { reference: '/docs/reference/core/types' },
  '@nextrush/errors': { reference: '/docs/reference/core/errors', guide: '/docs/guides/error-handling' },
  '@nextrush/runtime': {
    reference: '/docs/reference/core/runtime',
    guide: '/docs/concepts/runtime-compatibility',
  },
  '@nextrush/stream': { reference: '/docs/reference/plugins/stream' },

  // ---- Class Runtime ------------------------------------------------------
  '@nextrush/class': { reference: '/docs/reference/class', guide: '/docs/concepts/dependency-injection' },
  '@nextrush/di': { reference: '/docs/reference/class/di', guide: '/docs/concepts/dependency-injection' },
  '@nextrush/testing': { guide: '/docs/guides/testing' },

  // ---- Security -----------------------------------------------------------
  '@nextrush/helmet': { reference: '/docs/reference/middleware/helmet', guide: '/docs/guides/security' },
  '@nextrush/cors': { reference: '/docs/reference/middleware/cors', guide: '/docs/guides/security' },
  '@nextrush/csrf': { reference: '/docs/reference/middleware/csrf', guide: '/docs/guides/security' },
  '@nextrush/rate-limit': {
    reference: '/docs/reference/middleware/rate-limit',
    guide: '/docs/guides/security',
  },

  // ---- Request Data --------------------------------------------------------
  '@nextrush/body-parser': { reference: '/docs/reference/middleware/body-parser' },
  '@nextrush/multipart': {
    reference: '/docs/reference/middleware/multipart',
    guide: '/docs/guides/file-upload',
  },
  '@nextrush/cookies': { reference: '/docs/reference/middleware/cookies' },
  '@nextrush/validation': {
    reference: '/docs/reference/middleware/validation',
    guide: '/docs/guides/validation',
  },

  // ---- Responses ------------------------------------------------------------
  '@nextrush/compression': { reference: '/docs/reference/middleware/compression' },
  '@nextrush/static': { reference: '/docs/reference/plugins/static' },
  '@nextrush/template': { reference: '/docs/reference/plugins/template' },
  '@nextrush/openapi': { reference: '/docs/reference/plugins/openapi' },

  // ---- Observability ------------------------------------------------------
  '@nextrush/logger': { reference: '/docs/reference/plugins/logger' },
  '@nextrush/request-id': { reference: '/docs/reference/middleware/request-id' },
  '@nextrush/timer': { reference: '/docs/reference/middleware/timer' },

  // ---- Real-time & Events --------------------------------------------------
  '@nextrush/events': { reference: '/docs/reference/plugins/events' },
  '@nextrush/websocket': {
    reference: '/docs/reference/plugins/websocket',
    guide: '/docs/guides/websocket',
  },

  // ---- Adapters -------------------------------------------------------------
  '@nextrush/adapter-node': { reference: '/docs/reference/adapters/node' },
  '@nextrush/adapter-bun': { reference: '/docs/reference/adapters/bun' },
  '@nextrush/adapter-deno': { reference: '/docs/reference/adapters/deno' },
  '@nextrush/adapter-edge': { reference: '/docs/reference/adapters/edge' },

  // ---- Tooling ----------------------------------------------------------------
  '@nextrush/dev': { reference: '/docs/reference/core/dev', guide: '/docs/guides/dev-tools' },
  'create-nextrush': { guide: '/docs/start' },
} as const;

export function getPackageLinks(name: string): PackageLinks {
  return packageLinks[name] ?? {};
}
