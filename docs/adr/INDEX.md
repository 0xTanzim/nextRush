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

## Overlap note: ADR-0003 vs ADR-0004

Both cite the same RFC (`007-class-consolidation.md`) but record distinct decisions: ADR-0003 is
the package-merge decision (`@nextrush/decorators` + `@nextrush/controllers` → `@nextrush/class`);
ADR-0004 is the reflection-boundary/immutable-IR decision (a single `Reflect.*` call site,
deep-frozen `ApplicationGraph`). Kept as two ADRs, not merged — each is independently revertible
and addresses a different architectural concern, matching this repo's "one decision per commit/PR"
change-hygiene rule.
