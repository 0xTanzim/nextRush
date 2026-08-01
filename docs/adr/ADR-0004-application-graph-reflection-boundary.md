# ADR-0004 — Immutable Application Graph & Single Reflection Boundary

- **Status:** Accepted · Shipped
- **Date:** 2026-07
- **RFC:** `docs/RFC/class-runtime/007-class-consolidation.md` (§ IR/runtime redesign)

## Context

Class bootstrap read decorator metadata via `reflect-metadata` at scattered points, and the
runtime re-derived structure per request. Two problems: (1) `Reflect.*` calls sprinkled across
the package made the reflection dependency hard to reason about and to eventually replace;
(2) mutable, re-derived boot state is a correctness and performance hazard.

## Decision

1. **Single reflection boundary.** All `reflect-metadata` access is confined to one file
   (`reflection/reflection.ts`). Nothing else in `@nextrush/class` calls `Reflect.*`. This
   isolates the one dependency that would need to change if the decorator-metadata mechanism
   ever moves (e.g. to the TC39 decorators-metadata standard).
2. **Immutable Application Graph IR.** Bootstrap runs as named stages
   (discover → metadata → provider-graph → validation → registrar → router) over a single
   context, then assembles an `ApplicationGraph` that is **deep-frozen** (`deepFreeze`). The
   router stage registers routes from the frozen graph; the runtime executes against the frozen
   **shape**. Request-scoped instances are still created per request — freezing is of structure,
   not of live instances.

## Consequences

- **Positive:** read-once/freeze/run gives a clear, testable boot pipeline; the frozen shape
  removes per-request re-derivation; the reflection dependency is a single swappable seam.
- **Negative / cost:** one indirection (the graph) between metadata and runtime; guarded by a
  unit test proving the IR is real (deep-frozen, populated) and not dead code.
- **Public surface:** `ApplicationGraph` is public as a **read** type (for diagnostics
  consumers); `deepFreeze`, `bootstrapPipeline`, and `BootstrapContext` are internal (ADR-0005).
