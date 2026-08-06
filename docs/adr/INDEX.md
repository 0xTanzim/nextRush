# ADR Index

Architecture Decision Records, numbered sequentially (`ADR-0001`, `ADR-0002`, …) in a flat
directory — ADRs are terse, one-decision-per-file records; the set is small enough that grouping
into subfolders (as `docs/RFC/` now is) would add navigation overhead without benefit. Never
renumber or delete an ADR after it is accepted; a reversed decision gets a new ADR that
supersedes the old one by reference, the old file stays for history.

**Writing a new ADR?** Copy [`TEMPLATE.md`](TEMPLATE.md) — the standard terse ADR format
(Status/Date/RFC metadata → Context → Decision → Options → Consequences → Compliance, with a
done-checklist). ADRs are the terse decision record; the design exploration lives in the
governing RFC (`docs/RFC/`, which has its own `TEMPLATE.md`).

| ADR | Decision | Status | Governing RFC |
| --- | --- | --- | --- |
| [ADR-0001](ADR-0001-decorator-dialect.md) | Commit to the legacy TypeScript decorator dialect (not TC39 Stage 3) | Accepted | — |
| [ADR-0002](ADR-0002-extension-model.md) | Extension Model (`Plugin` → `Extension`) | Accepted · Shipped | `docs/RFC/class-runtime/005-plugin-system.md` |
| [ADR-0003](ADR-0003-class-consolidation.md) | Class Runtime Consolidation (`@nextrush/class`) | Accepted · Shipped | `docs/RFC/class-runtime/007-class-consolidation.md` |
| [ADR-0004](ADR-0004-application-graph-reflection-boundary.md) | Immutable Application Graph & single reflection boundary | Accepted · Shipped | `docs/RFC/class-runtime/007-class-consolidation.md` (§ IR/runtime redesign) |
| [ADR-0005](ADR-0005-package-tiers-sealed-surface-deprecation.md) | Package tiers, sealed public surface & shim deprecation | Accepted | — |
| [ADR-0006](ADR-0006-deferred-1x-features.md) | Features deferred to 1.x (not 1.0 blockers) | Accepted | — |
| [ADR-0007](ADR-0007-serverless-adapter-and-enforced-contract.md) | Enforced adapter contract & serverless execution/event-format separation | Accepted | `docs/RFC/runtime-adapters/013-adapter-contract.md`, `docs/RFC/runtime-adapters/014-adapter-serverless.md` |
| [ADR-0008](ADR-0008-dev-tooling-capability-and-verification-first.md) | `dev-tooling` capability & verification-first hardening of `@nextrush/dev` | Accepted | `docs/RFC/dev-tooling/019-dev-tooling-capability.md` |
| [ADR-0009](ADR-0009-framework-composition-and-functional-install-boundary.md) | `framework-composition` capability & functional/class install boundary via optional peers | Accepted · Shipped | `docs/RFC/framework-composition/020-framework-composition-integrity.md` |
| [ADR-0010](ADR-0010-cross-runtime-parity-hardening.md) | Cross-runtime observable-parity hardening: per-cell real-runtime proof + Node timeout→504 & Bun/Deno graceful-shutdown convergence | Accepted | `docs/RFC/runtime-adapters/013-adapter-contract.md` |
| [ADR-0011](ADR-0011-project-scaffolding-version-resolution.md) | Per-package version resolution with a build-time fallback map for `create-nextrush` | Accepted · Shipped | `docs/RFC/scaffolding/021-project-scaffolding-capability.md` |
| [ADR-0012](ADR-0012-bounded-teardown-lifecycle.md) | Bounded, per-hook-isolated `Application.close()` teardown | Accepted · Shipped | `docs/RFC/class-runtime/022-bounded-teardown-lifecycle.md` |
| [ADR-0013](ADR-0013-nextrush-cli-launcher-discoverability.md) | Thin `nextrush` CLI launcher on the meta-package for dev-toolkit discoverability | Accepted | `docs/RFC/framework-composition/020-framework-composition-integrity.md` (§21 addendum) |
| [ADR-0014](ADR-0014-adapter-nextjs-prepend-only.md) | `@nextrush/adapter-nextjs` — prepend-only Next.js App Router bridge | Accepted · Shipped | `docs/RFC/runtime-adapters/024-adapter-nextjs.md` |
| [ADR-0015](ADR-0015-defer-router-radix.md) | Defer `@nextrush/router-radix` on evidence-negative T017 | Accepted | `docs/RFC/runtime-adapters/015-router-radix.md` |
| [ADR-0016](ADR-0016-canonical-tls-shape.md) | Canonical nested TLS shape and ALPN-negotiated HTTP/2 for server adapters | Proposed | `docs/RFC/runtime-adapters/028-tls-transport-negotiation.md` |
| [ADR-0017](ADR-0017-canonical-request-path.md) | Canonical request-path ownership in `@nextrush/router` (`ctx.path`/`ctx.originalPath`, dot-segment rejection) | Proposed | `docs/RFC/request-data/029-canonical-request-path.md` |
| [ADR-0018](ADR-0018-typed-proxy-trust.md) | Typed proxy-trust boundary (`proxy: false \| number \| string[]`) replacing the boolean | Proposed | `docs/RFC/runtime-adapters/030-typed-proxy-trust.md` |
| [ADR-0019](ADR-0019-context-bound-signatures.md) | Context-bound signature construction for signed cookies (name + issue time) | Proposed | `docs/RFC/request-data/031-context-bound-signatures.md` |
| [ADR-0020](ADR-0020-session-position.md) | `@nextrush/session`: documented position, implementation deferred to a future RFC | Proposed | `docs/RFC/class-runtime/032-session-position.md` |
| [ADR-0021](ADR-0021-fast-property-request-containers.md) | Fast-property request containers derived from a shared null-prototype base (`ctx.params`/`query`/`headers`) | Accepted · Shipped | — |
| [ADR-0022](ADR-0022-design-token-architecture-orange-identity.md) | Layered design-token architecture & orange `#F16913` identity (warm-paper/graphite), CI-enforced | Accepted · Shipped | — |
| [ADR-0023](ADR-0023-scaffolder-dx-environment-manifest-deno.md) | Scaffolder DX architecture — unified env config (`.env`/`.env.example`/`config` for all runtimes), declarative dependency manifest + single runtime policy, Deno `--env-file` parity | Accepted | `docs/RFC/scaffolding/034-environment-configuration-scaffolding.md` (consolidates 035, 036) |
| [ADR-0024](ADR-0024-create-nextrush-strict-automation-contract.md) | `create-nextrush` strict automation contract — versioned JSON result/error schema (`schemaVersion` 1, stable codes + remediation), `--dry-run`/`--json`, explicit destructive `--overwrite` policy (never implied by `--yes`), non-zero `TARGET_DIRECTORY_NOT_EMPTY` | Accepted | `docs/RFC/scaffolding/021-project-scaffolding-capability.md` |

## Overlap note: ADR-0003 vs ADR-0004

Both cite the same RFC (`007-class-consolidation.md`) but record distinct decisions: ADR-0003 is
the package-merge decision (`@nextrush/decorators` + `@nextrush/controllers` → `@nextrush/class`);
ADR-0004 is the reflection-boundary/immutable-IR decision (a single `Reflect.*` call site,
deep-frozen `ApplicationGraph`). Kept as two ADRs, not merged — each is independently revertible
and addresses a different architectural concern, matching this repo's "one decision per commit/PR"
change-hygiene rule.
