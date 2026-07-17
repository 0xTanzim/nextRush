# ADR-0006 — Features Deferred to 1.x (not 1.0 blockers)

- **Status:** Accepted
- **Date:** 2026-07
- **Addresses:** production-readiness review H1, M1, M3, #14

## Context

The production-readiness gate identified several capabilities as valuable but not required for
a stable 1.0. Stabilization is achieved by sealing the contract and shipping what is complete —
not by cramming half-built features into the release. Each item below is net-new public surface
and therefore requires its own approved RFC before implementation (repo iron law:
*RFC before implementation* for public APIs).

## Decision

Defer the following to the 1.x line (or 2.0 where breaking), with the rationale recorded so the
deferral is a decision, not an omission:

1. **Module encapsulation** (highest-value next feature). Today `@Module` groups and composes;
   `exports` is recorded but **not enforced** — every provider is visible through the shared
   container. Enforcing module-private providers / real `exports` needs per-module container
   work (`docs/RFC/class-runtime/012-modules.md`). The current behavior is documented honestly in the README.
   *Interim:* the `exports` field is treated as reserved-until-enforced; no code should rely on
   it hiding anything.

2. **Full per-app DI isolation by default.** Opt-in `isolate` ships now; flipping it to the
   default is breaking (`docs/RFC/class-runtime/006-di-container-ownership.md`) → 2.0.

3. **Request-pipeline observability.** First-class metrics/trace hooks around
   guard → interceptor → handler → filter. Dev-time diagnostics (`getClassDiagnostics`) exist;
   production observability is a 1.x RFC.

4. **Typed layered configuration.** An env/file/defaults configuration convention for class
   apps. Deferred to a 1.x RFC.

## Consequences

- **Positive:** 1.0 ships a sealed, honest, complete-for-its-scope contract; big features get
  proper RFC design instead of rushed inclusion.
- **Negative / cost:** enterprise users needing encapsulation or built-in observability wait for
  1.x. Module encapsulation is flagged as the first feature to pick up after 1.0.
