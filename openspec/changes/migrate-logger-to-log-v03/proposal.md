# Proposal: Migrate @nextrush/logger to the @nextrush/log v0.3 API surface

## Why

`@nextrush/logger` (the request-logging middleware) was written against
`@nextrush/log` v0.2.x, which shipped a breaking v0.3.0 that minimized the
public surface from ~76 exports to ~20 (audit-driven; see the upstream
CHANGELOG in `/home/tanzim/project/npm/logger`). The middleware still
re-exports ~40 removed symbols (`serializeError`, `shouldLog`, `compareLevels`,
`scopedLogger`, `formatJSON`, …) and calls the removed `isProductionBuild()`
at runtime. The DTS build fails typing against the installed v0.3.0, which
breaks the repo-wide `pnpm lint`/`pnpm build` gates and stalls all other work
(including the `preserve-route-metadata-on-mount` repo-gate task 4.5).

## What Changes

- **Trim the `@nextrush/logger` re-export block** to the v0.3.0 surviving
  exports it genuinely exposes, dropping the ~40 removed v0.2.x re-exports.
  **BREAKING** for consumers who imported those helpers from the middleware
  barrel; migration: import removed helpers directly from `@nextrush/log`
  where v0.3 still exposes a path, or use the surviving API surface
  (`log`, `createLogger`, `configure`, transports, async-context helpers, types).
- **Replace `isProductionBuild()`** defaulting for `logRequestStart` with an
  explicit, deterministic, edge-portable mechanism (a middleware option rather
  than a removed runtime probe) — preserving runtime-independence (no
  `process` in the middleware request path).
- **Update the surface-lock test** so it locks the CORRECT, v0.3-aligned
  surface instead of faithfully locking the stale contract, and add a
  link-against-reality guard: the middleware's re-exports MUST compile against
  the installed `@nextrush/log` exports (regression: a future upstream
  breaking change fails the middleware's tests, not the repo build).
- **Update docs + tests** referencing removed symbols; re-run the repo-wide
  build gate so `pnpm lint` / `pnpm build` pass end to end again.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `public-surface-lock`: ADD a requirement that a middleware which re-exports
  from a dependency locks its surface against that dependency's REAL runtime
  exports (a live link check), so a dependency breaking change is caught by the
  package's own surface test — not discovered as a cold-build failure.
- `portable-middleware`: ADD a requirement that environment/production
  detection in middleware SHALL be explicit and edge-portable — never a
  private/removed dependency helper, and never `process` in the request path —
  so production-mode behavior is deterministic across Node, Bun, Deno, and
  edge runtimes.

## Impact

- **Code**: `packages/middleware/logger/src/index.ts` (re-export block; add
  `environment` option to `LoggerMiddlewareOptions`; replace the
  `isProductionBuild()` call site), `src/__tests__/public-surface.test.ts`
  (correct lock + link guard), `src/__tests__/logger.test.ts` (drop/fix
  assertions on removed symbols), `README.md` (migration note + updated API
  table).
- **Public API**: `@nextrush/logger` loses ~40 stale re-exports (BREAKING);
  gains an `environment` option (additive). No changes to `@nextrush/log`
  itself (it already ships v0.3.0 and is correct).
- **Consumers**: only the middleware imports `@nextrush/log`'s removed surface;
  repo search found no other `@nextrush/logger` importers in packages/apps.
- **Governance**: the durable decision — "`@nextrush/logger`'s re-exported
  surface must be the intersection of v0.3's stable surface and what the
  middleware adds; a middleware never mirrors a dependency's internal/removed
  plumbing" — MUST land in `docs/RFC/` (a short RFC/ADR capturing the public
  surface policy + the `environment` defaulting decision) before this change
  is archived. This is a breaking public-API change per the constitution.