# RFC-036: `@nextrush/logger` — public surface policy & `@nextrush/log` v0.3 migration

| Field | Value |
| --- | --- |
| **Status** | Approved — breaking change |
| **RFC number** | `036` |
| **Date** | 2026-08-28 |
| **Author(s)** | NextRush maintainers |
| **Group** | `request-data` (logging data path) |
| **Packages touched** | `@nextrush/logger` (middleware barrel + options). Does **not** change `@nextrush/log` (v0.3.0 is already shipped and correct). |
| **Framework impact** | **BREAKING** (public-API) for `@nextrush/logger` |
| **Implements** | change `migrate-logger-to-log-v03` |

---

## 1. Problem & The Reframe

`@nextrush/logger` was written against `@nextrush/log` v0.2.x, which shipped a
breaking v0.3.0 that minimized its public barrel from ~76 exports to ~20
(audit-driven: "internal plumbing that was never meant to be imported directly").

Discovered when the repo-wide `pnpm lint`/`pnpm build` gates began failing the
DTS pass: `@nextrush/logger` still re-exported ~40 removed symbols and called
the deleted `isProductionBuild()` at runtime. The middleware's own surface-lock
test had been faithfully locking in the *stale* contract.

Reframe: the failure is a **representation-boundary bug**, not merely an
upstream version bump. A middleware that re-exports a dependency's API must
re-export the dependency's **actual** surface — and its own tests must fail at
*test time*, not as a cold-build surprise, when that surface changes.

## 2. Durable decisions

1. **A middleware's re-export surface is the intersection of its dependency's
   stable public surface and the package's own value-add.** A middleware never
   mirrors a dependency's removed/internally-audited plumbing, and never
   "preserves" removed helpers for convenience.
2. **Environment / production detection in middleware is explicit and
   edge-portable.** No removed private helper, and no `process` in the request
   path. `@nextrush/logger` derives its `logRequestStart` default from an
   explicit `environment: 'development' | 'production'` option (default
   `'development'`); an explicit `logRequestStart` wins.
3. **Re-export surfaces lock against the dependency's real exports.** When a
   package re-exports from a dependency, its surface-lock test includes a live
   link check (`import * as pkg` + `symbol in pkg`) so a dependency breaking
   change fails the package's own test suite — see the `public-surface-lock`
   capability.
4. **The removed-value default flip is honest and documented.** Replacing
   auto-production-detection with a dev-defaulted `environment` option is a
   deliberate, documented behavior change with a migration note.

## 3. Migration

- Removed `@nextrush/logger` re-exports (`serializeError`, `shouldLog`,
  `compareLevels`, `formatJSON`, `detectRuntime`, `isProductionBuild`,
  `scopedLogger`, `createConsoleTransport`, …) → consumers use the surviving
  `@nextrush/log` v0.3 API (`log`, `createLogger`, `configure`, transports,
  async-context helpers) or `@nextrush/log` directly.
- `isProductionBuild()` → `environment` option (see §2.2), with explicit
  guidance in the README migration notes.

## 4. Implementation plan

1. Prune the barrel to the v0.3 survivors (values + types).
2. Add `environment` option; remove the `isProductionBuild()` call.
3. Rewrite the surface-lock test with the corrected list + live link guard.
4. Update tests asserting removed symbols; replace `Logger.prototype` spies
   with v0.3-native transport capture.
5. Update README/ARCHITECTURE/changelog; run package then repo-wide gates.

Verified TDD-first: the tests fail against the stale barrel (RED), then pass
after the migration (GREEN), and the repo-wide gates go green.
