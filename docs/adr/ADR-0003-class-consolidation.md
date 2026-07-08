# ADR-0003 — Class Runtime Consolidation (`@nextrush/class`)

- **Status:** Accepted · Shipped
- **Date:** 2026-07
- **RFC:** `docs/RFC/RFC-NEXTRUSH-CLASS-CONSOLIDATION.md` (shipped)

## Context

The class-based runtime was split across `@nextrush/decorators` (decorators + metadata) and
`@nextrush/controllers` (discovery, registration, handler building). The boundary was an
accident of build order, not a real seam: the two packages were always used together, shared
metadata keys, and forced users to reason about which symbol lived where. Dependency injection
(`@nextrush/di`), by contrast, is genuinely independent — usable in a functional app with no
class runtime.

## Decision

- Merge `@nextrush/decorators` + `@nextrush/controllers` into a single **`@nextrush/class`**
  package (decorators, controllers, guards, filters, interceptors, lifecycle, request scope,
  modules, bootstrap, discovery, diagnostics).
- Keep **`@nextrush/di` independent** — it is not folded in.
- Canonical import is **`nextrush/class`** (the meta subpath); `@nextrush/class` is the
  standalone/lean option.
- `@nextrush/decorators` and `@nextrush/controllers` remain as `@deprecated` compatibility
  shims that re-export from `@nextrush/class` (removal window in ADR-0005).
- Reflection is confined to a single boundary file (see ADR-0004).

## Consequences

- **Positive:** one mental model and one import surface for class-based development; no more
  "which package" ambiguity; DI stays cleanly separable.
- **Negative / cost:** additive/non-breaking for now (shims preserve compatibility); the
  breaking part (shim removal) is deferred to a future major.
- **Migration:** `nextrush codemod consolidate-imports "src/**/*.ts"` rewrites old imports;
  `docs/migrations/class-consolidation.md` documents before/after.
