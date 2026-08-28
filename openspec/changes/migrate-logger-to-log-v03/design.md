# Design: Migrate @nextrush/logger to the @nextrush/log v0.3 API surface

## Context

`@nextrush/logger` (`packages/middleware/logger/src/index.ts`) is written against
`@nextrush/log` v0.2.x. The upstream v0.3.0 release (source repo
`/home/tanzim/project/npm/logger`, commit `1c21595`, 2026-07-06) minimized the
barrel from 76 to ~20 exports. `@nextrush/logger` still:

- re-exports ~40 removed symbols in its `export { … } from '@nextrush/log'`
  block (lines 38–77) — `serializeError`, `shouldLog`, `compareLevels`,
  `scopedLogger`, `formatJSON`, `detectRuntime`, `isProductionBuild`, …;
- imports the removed `isProductionBuild()` at line 83 and calls it at line 280
  to default `logRequestStart`;
- has a surface-lock test (`__tests__/public-surface.test.ts`) that faithfully
  locks the STALE surface, and a `logger.test.ts` describe block asserting
  removed symbols exist.

The installed `@nextrush/log@0.3.0` exports only: `addGlobalTransport`,
`configure`, `createLogger`, `disableLogging`, `log`, `createBatchTransport`,
`createFilteredTransport`, `createRateLimitedTransport`,
`createContextMiddleware`, `getAsyncContext`, `runWithContext` (values) plus
their types (`ILogger`, `LoggerOptions`, `LogLevel`, `Logger`,
`GlobalLoggerConfig`, `AsyncLogContext`, `RateLimitStats`, …). Its exports map
exposes only `.` and `./browser` — the internal `/core`, `/serializer` barrels
are unreachable, by design.

Constraints:

- `portable-middleware` capability: no `node:*` / `process` in the middleware
  request path; the framework's `Application.isProduction` derives from an
  explicit `options.env`, not a global probe.
- The Context has no `app` back-reference, so the middleware cannot read the
  application's env at request time without an API change.
- `public-surface-lock` capability: every publishable package locks its barrel
  exports; the lock must reflect reality.

## Goals / Non-Goals

**Goals:**

- The middleware compiles and the repo-wide `pnpm lint`/`pnpm build` gates pass.
- `@nextrush/logger` exposes only the v0.3-aligned surface plus its own API.
- Production-mode behavior is explicit, deterministic, and edge-portable.
- A future `@nextrush/log` breaking change fails the middleware's own tests.

**Non-Goals:**

- Changing `@nextrush/log` itself (v0.3.0 is correct; do not resurrect the fat
  barrel upstream).
- Adding subpath exports upstream (`@nextrush/log/core`) — possible future
  upstream ask, out of scope here.
- Renaming the middleware's own API (`logger()`, `attachLogger()`, `getLogger()`).

## Decisions

### D1: The middleware's re-exported surface is the v0.3 stable surface it adds value to

Prune the `export { … } from '@nextrush/log'` block to the v0.3 survivors that
the middleware legitimately re-exports for consumers:

- **Values:** `log`, `createLogger`, `configure`, `addGlobalTransport`,
  `disableLogging`, `createBatchTransport`, `createFilteredTransport`,
  `createRateLimitedTransport`, `createContextMiddleware`, `getAsyncContext`,
  `runWithContext`
- **Types:** `ILogger`, `LoggerOptions`, `LogLevel`, `Logger`,
  `AsyncLogContext`, `GlobalLoggerConfig`, plus the type-only exports that still
  exist in v0.3 (`RateLimitOptions`, `RateLimitStats`, `NamespaceRateLimits`,
  …) — finalized against the installed `.d.ts` while implementing.

**Rationale:** the middleware's job is request logging + a convenience barrel
for the logging primitives its users configure alongside it. Every removed
v0.2.x helper (`serializeError`, `shouldLog`, `formatJSON`, …) was explicitly
audited out of v0.3 because it was internal plumbing — re-exposing it from the
middleware would re-create the leak the audit removed.

### D2: `isProductionBuild()` → explicit `environment` option

Add `environment?: 'development' | 'production'` to
`LoggerMiddlewareOptions` (default `'development'`). `logRequestStart` defaults
to `environment !== 'production'`; an explicitly-passed `logRequestStart`
wins over the default.

```ts
const {
  environment = 'development',
  logRequestStart = environment !== 'production',
  …
} = options;
```

**Why this over alternatives:**

- **Per-request capability probe / `ctx.app` env: rejected** — Context has no
  app back-reference; adding one broadens core's public surface for one
  default (a framework-complexity-for-user-complexity trade violation, §4).
- **Reading `process.env.NODE_ENV` at construction: rejected** — breaks edge
  parity (§7) and the `portable-middleware` contract; not all runtimes expose
  `process`, and the value can drift from the app's negotiated env.
- **Keeping the v0.2 `isProductionBuild` call: rejected** — the symbol does
  not exist in v0.3.0; the build fails.
- **Explicit option (selected): transparent, deterministic, testable**, and
  the app already passes `env` to `createApp` — mirroring that value here is
  trivial and documented.

### D3: Surface-lock test corrected + dependency-link guard

Rewrite `__tests__/public-surface.test.ts` so its expected list is the
v0.3-aligned set, and add a live link check:

```ts
import * as logApi from '@nextrush/log';
// for each symbol the barrel re-exports, assert it exists in logApi
```

### D4: Tests assert the v0.3 surface, not a mirror of removed symbols

The `logger.test.ts` block that asserts `serializeError`/`shouldLog`/
`compareLevels`/`isProductionBuild` are defined must be replaced with
assertions against the surviving v0.3 surface (`log`, `createLogger`,
`configure`, transports, async-context helpers) and the middleware's own
exports. Runtime behavior tests (message formats, levels, correlation IDs,
skip, CRLF safety) are unaffected and stay.

### D5: Migration + governance

- **RFC**: capture the durable decision — middleware re-export surfaces are the
  intersection of the dependency's stable surface and the package's own value-add;
  a middleware never mirrors a dependency's removed internals — as a short
  RFC/ADR under `docs/RFC/` before this change is archived (breaking public-API
  change).
- **Changelog**: `@nextrush/logger` changeset with **BREAKING** notes and the
  migration path (removed helpers → `@nextrush/log` or surviving API).
- **README**: update the API table and add a migration section.

## Risks / Trade-offs

- **[Breaking] ~40 re-exports removed from `@nextrush/logger`** → Migration path
  documented in the changeset/README; RFC-gated. Repo search found no package/app
  importing those helpers from the middleware barrel.
- **[Behavior] `logRequestStart` default flips from auto-prod-detection to
  dev-default** → Explicit `environment` option with documented semantics;
  users who passed `logRequestStart` explicitly are unaffected. Tests pin the
  new default.
- **[Divergence] `@nextrush/log` could change again** → The D3 link guard makes
  the middleware's surface test the first failure point, not the build.
- **[Upstream subpath need] A user genuinely needs `serializeError` etc.** → They
  import it from `@nextrush/log` directly today only if exposed; otherwise a
  future upstream subpath export is the right home, not the middleware barrel.

## Migration Plan

1. Prune the re-export block to the v0.3 survivors (D1).
2. Add `environment` option; replace the `isProductionBuild()` call (D2).
3. Rewrite the surface-lock test with the corrected list + link guard (D3).
4. Fix `logger.test.ts` surface assertions (D4).
5. Ship RFC + changeset + README migration notes (D5).
6. Run the middleware gates, then the repo-wide `pnpm lint` / `pnpm build`.

Rollback: revert the single commit; `@nextrush/logger` returns to the stale-but-
locked surface and the repo gate fails again only for DTS — a contained regression.

## Open Questions

- Whether the middleware should additionally re-export the `@nextrush/log`
  browser subpath — deferred; the middleware is server-side request logging.
- Whether `@nextrush/log` should eventually expose `./serializer` / `./config`
  subpaths upstream — an upstream decision, tracked separately.
so an upstream breaking change fails the middleware's test at test time (the
`public-surface-lock` ADDED requirement).