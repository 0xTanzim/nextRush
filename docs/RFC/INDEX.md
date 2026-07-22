# RFC Index

RFCs are numbered globally in authorship order (`001`, `002`, …) and grouped into topic
subfolders — the number is a stable, citable identity; the folder is where it lives for
browsing. Never renumber a shipped RFC; a superseding decision gets a new RFC/ADR that
references the old number, per this repo's `tdd-workflow.md` "RFC before implementation" rule.

**Writing a new RFC?** Copy [`TEMPLATE.md`](TEMPLATE.md) — the universal, professional RFC
format every new RFC follows (frontmatter, numbered sections, mandatory issue→solution mapping,
explicit phased implementation plan). It exists to end the format drift across older RFCs; do not
invent a new structure per RFC.

## Groups

| Folder | Covers |
| --- | --- |
| `release-process/` | Versioning, publishing, release strategy |
| `request-data/` | Route metadata, request validation, response streaming — the request/response data path |
| `class-runtime/` | The `@nextrush/class` decorator/DI/module system: extensions, DI ownership, class consolidation, request scope, lifecycle, interceptors, filters, modules |
| `runtime-adapters/` | Platform adapters, adapter contracts, serverless execution, routing engines |
| `dev-tooling/` | The `@nextrush/dev` toolchain: dev server, SWC build pipeline, watch/restart, CLI, generators, codemods |
| `framework-composition/` | How NextRush's packages compose into one installable framework: the meta-package's dependency/install footprint, public-surface naming coherence, and manifest conventions |
| `scaffolding/` | The `create-nextrush` project-generation contract: version resolution, template generation, the generated-project install/build/run guarantee |

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
| [016](runtime-adapters/016-websocket-edge.md) | `@nextrush/websocket-edge` (edge-native WebSocket) | **Proposed** — design-only, not built | runtime-adapters |
| [017](request-data/017-body-source-limit-propagation.md) | `BodySource.buffer(limit?)` — cross-runtime body-size limit propagation | Accepted — shipped | request-data |
| [018](request-data/018-response-serialization.md) | Response serialization strategy for `ctx.json` — keep `JSON.stringify` as the default | Approved | request-data |
| [019](dev-tooling/019-dev-tooling-capability.md) | `@nextrush/dev` — the dev-tooling capability & verification-first hardening | Approved — see ADR-0008 | dev-tooling |
| [020](framework-composition/020-framework-composition-integrity.md) | Framework composition integrity — functional/class install boundary, surface naming, manifest discipline | Shipped — see ADR-0009 | framework-composition |
| [021](scaffolding/021-project-scaffolding-capability.md) | `create-nextrush` — the project-scaffolding capability & per-package version resolution | Approved — see ADR-0011 (Shipped) | scaffolding |
| [022](class-runtime/022-bounded-teardown-lifecycle.md) | `@nextrush/core` — Bounded, cancellation-aware teardown lifecycle | Shipped — see ADR-0012 | class-runtime |
| [023](dev-tooling/023-nextrush-doctor.md) | `@nextrush/dev` — `nextrush doctor` project health diagnostics | **Draft** — design-only, not built | dev-tooling |

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
