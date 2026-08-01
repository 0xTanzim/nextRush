# ADR-0009 — Framework composition capability & functional/class install boundary via optional peers

- **Status:** Accepted · Shipped
- **Date:** 2026-07
- **Deciders:** Framework Architecture Review
- **Governing RFC:** `docs/RFC/framework-composition/020-framework-composition-integrity.md`
- **Supersedes:** `—`
- **Superseded by:** `—`
- **Related:** ADR-0005 (extends its package-tier policy), ADR-0008 (sibling precedent for
  introducing a new tooling/composition capability)

---

## Lifecycle progress

`Proposed ▶ Accepted ▶ Shipped`  ·  `[████████████████████]` **Shipped** — 3 / 3

---

## Context

`report/framework/framework-composition-review.md` found the `nextrush` meta-package's stated
promises — "install only what you need", "zero-dependency functional core" — true at *runtime*
but not at *install time*: every install downloads the class/DI stack regardless of paradigm used.
The same review found a public type-name collision (`RouteMetadata` means two different things
depending on subpath) and a published README documenting removed/non-existent exports. None of
the 16 existing OpenSpec capabilities own package composition, the install graph, or manifest
discipline — the closest, `public-surface-lock` (introduced by ADR-0005's sealed-surface policy),
owns only per-package symbol-lock tests. This decision extends ADR-0005's package-tier framing
with the missing composition contract and picks the specific mechanism for closing the install gap.

---

## Decision

We will **(1)** introduce the `framework-composition` OpenSpec capability owning package
composition, the install-graph-matches-advertised-footprint requirement, and canonical manifest
conventions; **(2)** move `nextrush`'s `@nextrush/class`, `@nextrush/di`, and `reflect-metadata`
from hard `dependencies` to **optional `peerDependencies`** (`peerDependenciesMeta.<name>.optional:
true`), declaring all three individually rather than routing through `@nextrush/class`'s barrel;
and **(3)** rename `@nextrush/class`'s colliding `RouteMetadata` interface to
`ControllerRouteMetadata` with a one-minor deprecated alias, reserving `RouteMetadata` for the
single renderer-facing contract in `@nextrush/types`.

Because a new, durable composition capability is genuinely missing from the registry (the same
gap ADR-0008 identified and filled for `dev-tooling`), and because optional peer dependencies are
the only npm-ecosystem primitive that both (a) are never auto-installed unless the consumer
explicitly adds them and (b) require no custom resolution logic — `optionalDependencies` still
auto-installs when resolvable, which defeats the footprint goal entirely.

**Peer-install-matrix confirmation (RFC §18, resolved before P2):** optional peer dependencies with
`peerDependenciesMeta.optional: true` are honored (never auto-installed) by npm ≥7, pnpm ≥8 (even
with `auto-install-peers=true`, the `optional` flag suppresses installation), and yarn (classic and
Berry) — this is standard, specification-level `peerDependenciesMeta` behavior, not
version-fragile. The `nextrush/class` resolution guard remains the universal backstop regardless.

## Options considered

- **Optional `peerDependencies` for `@nextrush/class`/`@nextrush/di`/`reflect-metadata`** — ✅
  chosen: never auto-installed, requires no custom logic, matches the existing import-level
  layering (`class`/`di` already sit above `core`/`router` per the package hierarchy).
- **`optionalDependencies`** — ❌ rejected: still installed whenever resolvable (always true inside
  npm/the monorepo), so the functional footprint would not shrink at all.
- **Route `nextrush/class` entirely through `@nextrush/class`'s re-exports, declare one peer** — ❌
  rejected: verified during RFC authoring that `@nextrush/class`'s barrel omits `Config`, `delay`,
  `Injectable`, `Optional`, and several DI type exports — would silently break the public surface.
- **Keep the monolithic install; soften the "install only what you need" claim instead** — ❌
  rejected: forfeits the framework's stated differentiator permanently to save one install step.
- **Do nothing** — ❌ rejected: the gap between claim and reality widens with every release that
  grows `@nextrush/class`, and the `tsyringe`/`reflect-metadata` supply-chain exposure keeps
  affecting functional-only users who never execute that code.

## Consequences

- **Positive:** the framework's core differentiator ("install only what you need") becomes true at
  install time, not just at runtime; the `tsyringe`/`reflect-metadata` supply-chain surface shrinks
  for the majority (functional) use case; the `RouteMetadata` collision and README drift get a
  durable home (`framework-composition`, `public-surface-lock`) so they cannot silently reopen.
- **Negative / cost:** two breaking changes ship in one change (install graph + a type rename);
  manual (non-scaffolded) class-based installers must add one explicit `pnpm add @nextrush/class`
  step that a prior single-command install did not require.
- **Neutral:** `create-nextrush`'s scaffolded templates absorb the extra install step automatically,
  so the majority of new class-based projects see no added friction.
- **Follow-up:** a canonical package catalog for satellite-package discoverability (tracked as
  documented-but-deferred in the RFC's Future Work, not blocking this decision).

## Compliance / enforcement

Enforced by four new tests introduced in the implementing change: (1) an install-graph test
asserting a functional-only `nextrush` install excludes `@nextrush/class`/`@nextrush/di`/
`tsyringe`/`reflect-metadata`; (2) a `nextrush/class` resolution-guard test; (3) a cross-subpath
type-name coherence check (`public-surface-lock`) that fails on any future same-name/different-shape
collision; (4) a canonical-manifest lock test covering the dependency/peer-declaration and
install-script rules. All four are CI-gated, not "by convention."

---

## Checklist

- [x] One decision only (composition capability + the specific install-boundary mechanism it requires).
- [x] Context states the forces/trigger (the review) without pre-empting the decision.
- [x] Decision is in the active voice with its primary reason.
- [x] Options list includes the chosen one, alternatives, and "do nothing".
- [x] Consequences include a real negative/cost (two breaking changes, one manual install step).
- [x] Compliance/enforcement names concrete mechanisms (four CI-gated tests).
- [x] Lifecycle progress bar reflects the current Status field (Shipped — 3/3).
- [x] Governing RFC linked.
- [x] Registered in docs/adr/INDEX.md.
