# RFC Index

RFCs are numbered globally in authorship order (`001`, `002`, …) and grouped into topic
subfolders — the number is a stable, citable identity; the folder is where it lives for
browsing. Never renumber a shipped RFC; a superseding decision gets a new RFC/ADR that
references the old number, per this repo's `tdd-workflow.md` "RFC before implementation" rule.

## Groups

| Folder | Covers |
| --- | --- |
| `release-process/` | Versioning, publishing, release strategy |
| `request-data/` | Route metadata, request validation, response streaming — the request/response data path |
| `class-runtime/` | The `@nextrush/class` decorator/DI/module system: extensions, DI ownership, class consolidation, request scope, lifecycle, interceptors, filters, modules |
| `runtime-adapters/` | Platform adapters, adapter contracts, serverless execution, routing engines |

## All RFCs (by number)

| # | Title | Status | Group |
| --- | --- | --- | --- |
| [001](release-process/001-hybrid-versioning.md) | Hybrid Versioning & Release Strategy | Implemented | release-process |
| [002](request-data/002-route-metadata.md) | Route Metadata System (OpenAPI as first renderer) | Approved / shipped | request-data |
| [003](request-data/003-stream.md) | `@nextrush/stream` — unified response streaming | Shipped | request-data |
| [004](request-data/004-validation.md) | `@nextrush/validation` — Standard Schema request validation | Shipped | request-data |
| [005](class-runtime/005-plugin-system.md) | Extension Model (Plugin → Extension), Composition-First | Shipped — see ADR-0002 | class-runtime |
| [006](class-runtime/006-di-container-ownership.md) | Per-app DI container ownership & isolation | Shipped (Option A) | class-runtime |
| [007](class-runtime/007-class-consolidation.md) | `@nextrush/class` runtime consolidation | Shipped — see ADR-0003, ADR-0004 | class-runtime |
| [008](class-runtime/008-request-scope.md) | Request-scoped dependency injection | Shipped | class-runtime |
| [009](class-runtime/009-lifecycle-hooks.md) | Service lifecycle hooks (`OnInit`/`OnShutdown`) | Shipped | class-runtime |
| [010](class-runtime/010-interceptors.md) | Interceptors | Shipped | class-runtime |
| [011](class-runtime/011-exception-filters.md) | Exception filters | Shipped | class-runtime |
| [012](class-runtime/012-modules.md) | Module system (`@Module` + `registerModule`) | Shipped | class-runtime |
| [013](runtime-adapters/013-adapter-contract.md) | Enforced adapter contract (`ServerAdapter`/`FetchAdapter`) | Shipped — see ADR-0007 | runtime-adapters |
| [014](runtime-adapters/014-adapter-serverless.md) | `@nextrush/adapter-serverless` | Shipped — see ADR-0007 | runtime-adapters |
| [015](runtime-adapters/015-router-radix.md) | `@nextrush/router-radix` (opt-in radix router) | **Proposed — deferred**, not built | runtime-adapters |

## Note on RFC-005 (Plugin System)

This RFC's own status line still reads "Draft / ready for approval" from its last revision, but
`docs/adr/ADR-0002-extension-model.md` records the decision it proposed as **Accepted · Shipped**.
The RFC is kept as the historical design record ADR-0002 cites — it is not a duplicate of the ADR
(the RFC is the multi-revision design exploration; the ADR is the terse final decision record) and
is not deleted. The status-field mismatch is a known, minor inconsistency, noted rather than
silently edited into agreement.

## Note on RFC-015 (Router Radix)

The only RFC in this set that is **not** implemented. It intentionally commits to nothing at
runtime — it is a specification for a future, opt-in package, gated on an unconfirmed performance
or migration driver (see the RFC's own §9). Kept as-is; not moved or deleted.
