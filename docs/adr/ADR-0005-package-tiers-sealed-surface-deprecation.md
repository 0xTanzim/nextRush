# ADR-0005 — Package Tiers, Sealed Public Surface & Shim Deprecation

- **Status:** Accepted
- **Date:** 2026-07
- **Addresses:** production-readiness review B2, H2, H3, #19

## Context

Two adoption/maintainability risks surfaced in the production-readiness gate review:
(1) the `@nextrush/class` barrel re-exported implementation internals, widening the semver
contract accidentally; (2) with ~40 packages and two deprecated shims, contributors and users
had no signal of what is supported vs. plumbing, or when the shims disappear.

## Decision

### Sealed public surface
`@nextrush/class` re-exports only its intended contract. Genuine internals
(`deepFreeze`, `bootstrapPipeline`, `BootstrapContext`, `ResolvedBootstrapOptions`, `ClassRef`)
live in `src/internal.ts` and are **not** re-exported from the package root. A
`__tests__/public-surface.test.ts` snapshot locks the exact public export-name set — the
surface can never silently widen again. (Symbols still public only because the deprecated shims
re-export them are removed together with the shims — see below.)

### Package tiers
Each package is classified so the supported surface is explicit:

| Tier | Packages | Support |
|------|----------|---------|
| **Public — core** | types, errors, core, router, di, class, adapter-node, nextrush | Stable, semver-guarded |
| **Public — middleware/registrar** | body-parser, cors, helmet, csrf, rate-limit, compression, cookies, multipart, validation, request-id, timer, static, template, logger, openapi, stream | Stable |
| **Public — extensions** | events, websocket | Stable |
| **Public — tooling** | dev, create-nextrush, testing | Stable |
| **Deprecated (shims)** | decorators, controllers | Removed next major (below) |
| **Internal** | runtime, non-`-node` adapters until GA | May change without a major |

### Shim deprecation window
`@nextrush/decorators` and `@nextrush/controllers` are `@deprecated` compatibility shims
re-exporting from `@nextrush/class`. They are supported through the 1.x line and **removed in
the next major after 1.0**. Migration: `nextrush codemod consolidate-imports "src/**/*.ts"`.

## Consequences

- **Positive:** the semver contract matches intent; contributors know the supported surface;
  the shim lifetime is explicit, not open-ended.
- **Negative / cost:** the snapshot test must be updated deliberately when the public API
  legitimately changes — which is the point.
