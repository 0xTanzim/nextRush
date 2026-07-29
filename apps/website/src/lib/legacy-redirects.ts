/**
 * NextRush docs — legacy URL redirect map (T6 folder renames + Wave B3 reference/architecture IA
 * migration + Wave B4 resources→help/community IA migration + Wave B0 rehomed pages).
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
 * `resolveLegacyRedirect()` is a single-hop lookup (no chaining) — every entry's target must be
 * the CURRENT path, not an intermediate one. T6's original targets (`/docs/reference/core/*`,
 * `/docs/reference/middleware/*`, `/docs/reference/plugins/*`, `/docs/reference/adapters/*`,
 * `/docs/internals/*`) were themselves moved again by Wave B3 (reference flattening,
 * adapters→platforms, internals→architecture) — those T6 entries below were updated in place to
 * point straight at the final B3 path, and a second block of entries covers the pre-B3 → post-B3
 * paths directly, so a bookmark from either era resolves in one hop. Wave B4 retired
 * `resources/` into a new `help/` folder plus 2 pages moved into `community/`, and retired
 * `resources/package-catalog.mdx` entirely (duplicate of `reference/packages.mdx`) — its entry
 * points straight at the replacement page. The final block covers four rehomed pages from the
 * B0 IA design (`wave-b0-ia.md` §7 "Rehomed pages") that were retired outright during
 * implementation rather than kept as live pointers: `guides/migration.mdx` and
 * `guides/deployment.mdx` (superseded by the dedicated `migrate/` section and
 * `production/deployment/*` respectively), `concepts/plugins.mdx` (renamed to
 * `concepts/extensions.mdx`), and `guides/hello-world.mdx` (the 4th row in that table, missed
 * by every earlier wave until this pipeline's validator caught it — its content is now
 * superseded across `start/runtime/*`'s per-runtime hello-world steps and
 * `start/quick-start.mdx`'s deeper tutorial, not a 1:1 move, so it redirects to the closest
 * equivalent rather than a page that never existed at a single new path). Unlike the
 * `performance/*` pages (which stay live as short pointers per task 12.1 — see those pages' own
 * Callouts — because out-of-scope files still link to them directly), these four have zero
 * surviving inbound links from files outside this pipeline's scope, so a hard redirect is
 * correct rather than a live pointer page.
 *
 * Source of the T6 mapping: `git status --short` rename-detection output for the T6 folder
 * moves (getting-started → start, api-reference → reference, examples → guides/examples),
 * enumerated per-page, not just per-folder. Source of the B3 mapping: the frozen D9.1/D9.3
 * decisions in `openspec/changes/docs-v4-rebuild/waves/wave-b3-reference-architecture.md`.
 * Source of the B4 mapping: the frozen mapping table in
 * `openspec/changes/docs-v4-rebuild/waves/wave-b4-migrate-community-help.md`. Source of the B0
 * rehomed-pages mapping: `openspec/changes/docs-v4-rebuild/wave-b0-ia.md` §7 "Rehomed pages",
 * cross-checked against `git show docs-v3-final:<path>` (confirms the v3 source page existed)
 * and the current `apps/website/content/docs` tree (confirms no page exists at the old path today).
 */
export const legacyRedirects: ReadonlyMap<string, string> = new Map([
  // getting-started/* -> start/*
  ['/docs/getting-started', '/docs/start'],
  ['/docs/getting-started/installation', '/docs/start/installation'],
  ['/docs/getting-started/quick-start', '/docs/start/quick-start'],
  ['/docs/getting-started/create-nextrush', '/docs/start/create-nextrush'],
  ['/docs/getting-started/overview', '/docs/start/overview'],

  // api-reference/* -> reference/* (T6 targets updated in place to the post-B3 flat paths)
  ['/docs/api-reference', '/docs/reference'],
  ['/docs/api-reference/core', '/docs/reference'],
  ['/docs/api-reference/core/types', '/docs/reference/types'],
  ['/docs/api-reference/core/errors', '/docs/reference/errors'],
  ['/docs/api-reference/core/nextrush', '/docs/reference/nextrush'],
  ['/docs/api-reference/core/dev', '/docs/reference/dev'],
  ['/docs/api-reference/core/core', '/docs/reference/core'],
  ['/docs/api-reference/core/runtime', '/docs/reference/runtime'],
  ['/docs/api-reference/core/router', '/docs/reference/router'],
  ['/docs/api-reference/adapters', '/docs/reference/platforms'],
  ['/docs/api-reference/adapters/node', '/docs/reference/platforms/node'],
  ['/docs/api-reference/adapters/bun', '/docs/reference/platforms/bun'],
  ['/docs/api-reference/adapters/deno', '/docs/reference/platforms/deno'],
  ['/docs/api-reference/adapters/edge', '/docs/reference/platforms/edge'],
  ['/docs/api-reference/middleware', '/docs/reference'],
  ['/docs/api-reference/middleware/validation', '/docs/reference/validation'],
  ['/docs/api-reference/middleware/multipart', '/docs/reference/multipart'],
  ['/docs/api-reference/middleware/timer', '/docs/reference/timer'],
  ['/docs/api-reference/middleware/request-id', '/docs/reference/request-id'],
  ['/docs/api-reference/middleware/rate-limit', '/docs/reference/rate-limit'],
  ['/docs/api-reference/middleware/helmet', '/docs/reference/helmet'],
  ['/docs/api-reference/middleware/csrf', '/docs/reference/csrf'],
  ['/docs/api-reference/middleware/cors', '/docs/reference/cors'],
  ['/docs/api-reference/middleware/cookies', '/docs/reference/cookies'],
  ['/docs/api-reference/middleware/compression', '/docs/reference/compression'],
  ['/docs/api-reference/middleware/body-parser', '/docs/reference/body-parser'],
  ['/docs/api-reference/plugins', '/docs/reference'],
  ['/docs/api-reference/plugins/openapi', '/docs/reference/openapi'],
  ['/docs/api-reference/plugins/stream', '/docs/reference/stream'],
  ['/docs/api-reference/plugins/websocket', '/docs/reference/websocket'],
  ['/docs/api-reference/plugins/controllers', '/docs/reference/class/controllers'],
  ['/docs/api-reference/plugins/template', '/docs/reference/template'],
  ['/docs/api-reference/plugins/static', '/docs/reference/static'],
  ['/docs/api-reference/plugins/logger', '/docs/reference/logger'],
  ['/docs/api-reference/plugins/events', '/docs/reference/events'],
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

  // Wave B3 — reference/core/* -> reference/* (flatten, 8 pages).
  // NOTE: `/docs/reference/core` itself is intentionally NOT redirected — it is a real
  // current page (the @nextrush/core reference, now under the (core-routing) route group).
  // Redirecting it here shadowed that page (307 -> /docs/reference); removed so it resolves.
  ['/docs/reference/core/nextrush', '/docs/reference/nextrush'],
  ['/docs/reference/core/core', '/docs/reference/core'],
  ['/docs/reference/core/router', '/docs/reference/router'],
  ['/docs/reference/core/types', '/docs/reference/types'],
  ['/docs/reference/core/errors', '/docs/reference/errors'],
  ['/docs/reference/core/runtime', '/docs/reference/runtime'],
  ['/docs/reference/core/dev', '/docs/reference/dev'],
  ['/docs/reference/core/testing', '/docs/reference/testing'],

  // Wave B3 — reference/middleware/* -> reference/* (flatten, 12 pages)
  ['/docs/reference/middleware', '/docs/reference'],
  ['/docs/reference/middleware/cors', '/docs/reference/cors'],
  ['/docs/reference/middleware/helmet', '/docs/reference/helmet'],
  ['/docs/reference/middleware/csrf', '/docs/reference/csrf'],
  ['/docs/reference/middleware/body-parser', '/docs/reference/body-parser'],
  ['/docs/reference/middleware/multipart', '/docs/reference/multipart'],
  ['/docs/reference/middleware/rate-limit', '/docs/reference/rate-limit'],
  ['/docs/reference/middleware/compression', '/docs/reference/compression'],
  ['/docs/reference/middleware/cookies', '/docs/reference/cookies'],
  ['/docs/reference/middleware/health', '/docs/reference/health'],
  ['/docs/reference/middleware/request-id', '/docs/reference/request-id'],
  ['/docs/reference/middleware/timer', '/docs/reference/timer'],
  ['/docs/reference/middleware/validation', '/docs/reference/validation'],

  // Wave B3 — reference/plugins/* -> reference/* (flatten, 7 pages)
  ['/docs/reference/plugins', '/docs/reference'],
  ['/docs/reference/plugins/logger', '/docs/reference/logger'],
  ['/docs/reference/plugins/static', '/docs/reference/static'],
  ['/docs/reference/plugins/websocket', '/docs/reference/websocket'],
  ['/docs/reference/plugins/events', '/docs/reference/events'],
  ['/docs/reference/plugins/template', '/docs/reference/template'],
  ['/docs/reference/plugins/stream', '/docs/reference/stream'],
  ['/docs/reference/plugins/openapi', '/docs/reference/openapi'],

  // Wave B3 — reference/adapters/* -> reference/platforms/* (folder rename, 5 pages)
  ['/docs/reference/adapters', '/docs/reference/platforms'],
  ['/docs/reference/adapters/node', '/docs/reference/platforms/node'],
  ['/docs/reference/adapters/bun', '/docs/reference/platforms/bun'],
  ['/docs/reference/adapters/deno', '/docs/reference/platforms/deno'],
  ['/docs/reference/adapters/edge', '/docs/reference/platforms/edge'],
  ['/docs/reference/adapters/serverless', '/docs/reference/platforms/serverless'],

  // Wave B3 — internals/* -> architecture/* (rename, 8 pages) + contributing.mdx merged into community/
  ['/docs/internals', '/docs/architecture'],
  ['/docs/internals/design-principles', '/docs/architecture/design-principles'],
  ['/docs/internals/package-hierarchy', '/docs/architecture/package-hierarchy'],
  ['/docs/internals/middleware-internals', '/docs/architecture/middleware-internals'],
  ['/docs/internals/router-internals', '/docs/architecture/router-internals'],
  ['/docs/internals/di-internals', '/docs/architecture/di-internals'],
  ['/docs/internals/adapters', '/docs/architecture/adapters'],
  ['/docs/internals/rfcs', '/docs/architecture/rfcs'],
  ['/docs/internals/versioning', '/docs/architecture/versioning'],
  ['/docs/internals/contributing', '/docs/community/contributing'],
  ['/docs/internals/release-handbook', '/docs/architecture/release-handbook'],
  ['/docs/internals/beta-release-handbook', '/docs/architecture/release-handbook'],
  ['/docs/internals/changesets-and-release-strategy', '/docs/architecture/release-handbook'],

  // Wave B4 — resources/* -> help/* or community/* (folder retirement/split, 9 pages)
  ['/docs/resources', '/docs/help'],
  ['/docs/resources/faq', '/docs/help/faq'],
  ['/docs/resources/troubleshooting', '/docs/help/troubleshooting'],
  ['/docs/resources/glossary', '/docs/help/glossary'],
  ['/docs/resources/compatibility-matrix', '/docs/help/compatibility-matrix'],
  ['/docs/resources/roadmap', '/docs/community/roadmap'],
  ['/docs/resources/changelog', '/docs/community/changelog'],
  ['/docs/resources/package-catalog', '/docs/reference/packages'],

  // Wave B0 — rehomed pages (guides/concepts moved into other sections, 3 pages)
  // guides/migration.mdx was retired; its content is superseded by the dedicated migrate/ section.
  ['/docs/guides/migration', '/docs/migrate'],
  // guides/deployment.mdx was retired; its content is superseded by production/deployment/*.
  ['/docs/guides/deployment', '/docs/production/deployment'],
  // concepts/plugins.mdx was renamed to concepts/extensions.mdx (extension taxonomy terminology).
  ['/docs/concepts/plugins', '/docs/concepts/extensions'],
  // guides/hello-world.mdx was retired outright (the 4th B0 "Rehomed pages" row, missed by
  // every earlier wave): its content is now superseded, not moved — every start/runtime/* page
  // bakes its own in-context "run a hello-world server" step directly into that runtime's
  // tutorial, and start/quick-start.mdx is the deeper, complete "first app" tutorial the guides/
  // page's plain snippet was a thinner stand-in for. No single page is a 1:1 replacement, so this
  // points at quick-start.mdx as the closest equivalent "get a real server running" destination.
  ['/docs/guides/hello-world', '/docs/start/quick-start'],
]);

/** Old `/docs/...` path -> new `/docs/...` path, or `undefined` if not a known legacy path. */
export function resolveLegacyRedirect(slug: readonly string[]): string | undefined {
  const path = `/docs/${slug.join('/')}`;
  return legacyRedirects.get(path);
}
