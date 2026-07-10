/**
 * NextRush docs — Phase 1 (T6) legacy URL redirect map.
 *
 * This site is a full static export (`output: 'export'` in next.config.mjs), so Next.js's
 * `redirects()` config option is a no-op — it is only honored by the Node/Vercel server
 * runtime, never by `next build` + static export
 * (https://nextjs.org/docs/app/building-your-application/deploying/static-exports#unsupported-features).
 *
 * Instead, every old path below is rendered as a real static HTML page (see
 * `src/app/docs/[[...slug]]/legacy-redirect.tsx` and the catch-all handling in
 * `src/app/docs/[[...slug]]/page.tsx`) containing a `<meta http-equiv="refresh">` and a
 * client-side `redirect()` call, so browsers, crawlers, and `curl -L` all land on the new
 * page without a manual click.
 *
 * Source of the mapping: `git status --short` rename-detection output for the T6 folder
 * moves (getting-started → start, api-reference → reference, examples → guides/examples),
 * enumerated per-page, not just per-folder.
 */
export const legacyRedirects: ReadonlyMap<string, string> = new Map([
  // getting-started/* -> start/*
  ['/docs/getting-started', '/docs/start'],
  ['/docs/getting-started/installation', '/docs/start/installation'],
  ['/docs/getting-started/quick-start', '/docs/start/quick-start'],
  ['/docs/getting-started/create-nextrush', '/docs/start/create-nextrush'],
  ['/docs/getting-started/overview', '/docs/start/overview'],

  // api-reference/* -> reference/* (subfolders kept as-is, folder renamed only)
  ['/docs/api-reference', '/docs/reference'],
  ['/docs/api-reference/core', '/docs/reference/core'],
  ['/docs/api-reference/core/types', '/docs/reference/core/types'],
  ['/docs/api-reference/core/errors', '/docs/reference/core/errors'],
  ['/docs/api-reference/core/nextrush', '/docs/reference/core/nextrush'],
  ['/docs/api-reference/core/dev', '/docs/reference/core/dev'],
  ['/docs/api-reference/core/core', '/docs/reference/core/core'],
  ['/docs/api-reference/core/runtime', '/docs/reference/core/runtime'],
  ['/docs/api-reference/core/router', '/docs/reference/core/router'],
  ['/docs/api-reference/adapters', '/docs/reference/adapters'],
  ['/docs/api-reference/adapters/node', '/docs/reference/adapters/node'],
  ['/docs/api-reference/adapters/bun', '/docs/reference/adapters/bun'],
  ['/docs/api-reference/adapters/deno', '/docs/reference/adapters/deno'],
  ['/docs/api-reference/adapters/edge', '/docs/reference/adapters/edge'],
  ['/docs/api-reference/middleware', '/docs/reference/middleware'],
  ['/docs/api-reference/middleware/validation', '/docs/reference/middleware/validation'],
  ['/docs/api-reference/middleware/multipart', '/docs/reference/middleware/multipart'],
  ['/docs/api-reference/middleware/timer', '/docs/reference/middleware/timer'],
  ['/docs/api-reference/middleware/request-id', '/docs/reference/middleware/request-id'],
  ['/docs/api-reference/middleware/rate-limit', '/docs/reference/middleware/rate-limit'],
  ['/docs/api-reference/middleware/helmet', '/docs/reference/middleware/helmet'],
  ['/docs/api-reference/middleware/csrf', '/docs/reference/middleware/csrf'],
  ['/docs/api-reference/middleware/cors', '/docs/reference/middleware/cors'],
  ['/docs/api-reference/middleware/cookies', '/docs/reference/middleware/cookies'],
  ['/docs/api-reference/middleware/compression', '/docs/reference/middleware/compression'],
  ['/docs/api-reference/middleware/body-parser', '/docs/reference/middleware/body-parser'],
  ['/docs/api-reference/plugins', '/docs/reference/plugins'],
  ['/docs/api-reference/plugins/openapi', '/docs/reference/plugins/openapi'],
  ['/docs/api-reference/plugins/stream', '/docs/reference/plugins/stream'],
  ['/docs/api-reference/plugins/websocket', '/docs/reference/plugins/websocket'],
  ['/docs/api-reference/plugins/controllers', '/docs/reference/class/controllers'],
  ['/docs/api-reference/plugins/template', '/docs/reference/plugins/template'],
  ['/docs/api-reference/plugins/static', '/docs/reference/plugins/static'],
  ['/docs/api-reference/plugins/logger', '/docs/reference/plugins/logger'],
  ['/docs/api-reference/plugins/events', '/docs/reference/plugins/events'],
  ['/docs/api-reference/di', '/docs/reference/class'],
  ['/docs/api-reference/di/di', '/docs/reference/class/di'],
  ['/docs/api-reference/di/decorators', '/docs/reference/class/decorators'],

  // examples/* -> guides/* (guides/examples/ was a transitional holding folder, folded into guides/ directly)
  ['/docs/examples', '/docs/guides'],
  ['/docs/examples/hello-world', '/docs/guides/hello-world'],
  ['/docs/examples/rest-api', '/docs/guides/rest-api'],
  ['/docs/examples/class-based-api', '/docs/guides/class-based'],
  ['/docs/examples/authentication', '/docs/guides/authentication'],
  ['/docs/examples/database', '/docs/guides/database'],
  ['/docs/examples/websocket', '/docs/guides/websocket'],
  ['/docs/examples/file-upload', '/docs/guides/file-upload'],
  ['/docs/guides/examples', '/docs/guides'],
  ['/docs/guides/examples/hello-world', '/docs/guides/hello-world'],
  ['/docs/guides/examples/rest-api', '/docs/guides/rest-api'],
  ['/docs/guides/examples/class-based-api', '/docs/guides/class-based'],
  ['/docs/guides/examples/authentication', '/docs/guides/authentication'],
  ['/docs/guides/examples/database', '/docs/guides/database'],
  ['/docs/guides/examples/websocket', '/docs/guides/websocket'],
  ['/docs/guides/examples/file-upload', '/docs/guides/file-upload'],
]);

/** Old `/docs/...` path -> new `/docs/...` path, or `undefined` if not a known legacy path. */
export function resolveLegacyRedirect(slug: readonly string[]): string | undefined {
  const path = `/docs/${slug.join('/')}`;
  return legacyRedirects.get(path);
}
