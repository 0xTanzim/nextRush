# NextRush OpenSpec — Governance & Capability Registry

This directory separates **living behavioral truth** from **change-level engineering history**.
The distinction is intentional: the capability specs stay small and stable, while the change
records explain why and how the framework evolved.

```text
openspec/
├── config.yaml       → Workflow configuration and NextRush-specific OpenSpec guidance.
├── README.md         → This governance guide and the capability ownership registry.
├── specs/            → LIVING TRUTH: what the framework is required to do today.
└── changes/          → CHANGE RECORDS: proposals, deltas, designs, and implementation tasks.
    └── archive/      → Completed change records, subject to the retention policy below.

docs/RFC/ and docs/adr/
                    → Curated, durable architectural decisions.
```

The two OpenSpec directories have different purposes and lifecycles:

- **`specs/` is the current contract.** It is a small, stable set of durable capability specs.
  Agents and maintainers should read it to understand what NextRush is required to do.
- **`changes/` records proposed and completed work.** Active changes explain what is being
  changed and how. Archived changes are historical records, not the current behavioral source
  of truth.
- **`docs/RFC/` and `docs/adr/` preserve decisions that outlive an individual change.** Only
  decisions with lasting architectural significance belong there.

The failure mode this governance prevents is one-folder-per-change growth in `specs/`. A
`specs/` directory full of change-shaped stubs (`router-match-path-allocation-trim`,
`*-fastpath`, `*-cleanup`, or `TBD - created by archiving…`) makes the question
"What does NextRush guarantee today?" difficult to answer. Keep capability ownership durable
and the living spec set intentionally small.

## 1. The governing rule

> **A change updates the requirements of an existing durable capability. It does not create a
> new capability folder unless a genuinely new, durable responsibility is being introduced.**

A change targets one or more capabilities from the registry below. Its delta uses the
appropriate `ADDED`, `MODIFIED`, `REMOVED`, or `RENAMED` requirement section. When the change
is synchronized or archived, the delta is incorporated into the owning capability's living
spec. The number of capabilities should grow only when the framework's durable responsibility
set actually grows.

### Capability naming and ownership

- Names describe durable responsibilities (`router`, `node-adapter`), never a change,
  optimization, implementation technique, or temporary cleanup
  (`router-fastpath`, `*-trim`, `*-cleanup`, `*-microtrims`).
- Every capability spec has a meaningful `## Purpose` that explains what the capability owns.
  Never leave a generated `TBD - created by archiving…` placeholder.
- Choose ownership by **behavior and responsibility**, not merely by package name or the file
  being edited. A package can participate in more than one capability; one capability can
  span multiple packages.
- A cross-cutting change may update multiple existing capability specs, but each requirement
  must have one clear owner. Do not duplicate the same contract across capabilities.
- If no capability fits, first check whether the behavior belongs to an existing broader
  capability. Create a new capability only when it represents a distinct, durable framework
  responsibility that cannot be expressed cleanly under an existing owner.

### What belongs in a spec versus a design

- **Specs define observable contracts:** inputs, outputs, ordering, errors, lifecycle, limits,
  security guarantees, runtime behavior, and compatibility expectations.
- **Designs explain implementation choices:** package boundaries, algorithms, data structures,
  allocation behavior, runtime mechanisms, performance hypotheses, trade-offs, and alternatives.
- Do not turn living specs into implementation notes, benchmark diaries, task lists, or source
  code inventories. Those belong in change designs, tests, benchmark reports, or engineering docs.
- A pure internal refactor or optimization that does not change observable behavior does not
  need an invented spec delta. Use the OpenSpec `skip_specs` mechanism when appropriate and
  explain the reason in the change proposal.

## 2. Capability registry

The registry currently contains **19 durable capabilities**. This is the ownership index for
changes; it is not a target count or a reason to create more folders. For each change, select
the closest existing owner based on the behavior being specified.

| Capability | Owns |
| ---------- | ---- |
| `router` | Segment-trie routing: match/params/precedence, registration (`all()`/`@All`, prefix/mount/group), `RouteMatch` shape, null-prototype params, 404/405 dispatch, module-size (≤300-line) & dedup discipline, segment-trie doc accuracy, the future-radix RFC. |
| `core-middleware` | `@nextrush/core` `compose()` engine: onion ordering, guarded `next()`, error propagation, double-response warning, concurrency isolation, single-middleware fast path. |
| `node-adapter` | `@nextrush/adapter-node` request path & `NodeContext`: body reading, response emission (`ctx.json`/`ctx.set`), `ctx.query`/`ctx.ip`/`ctx.next`/`ctx.raw`, shared context-options. |
| `web-adapters` | `@nextrush/adapter-{bun,deno,edge}` shared per-request Context/response behavior (incl. Edge `cf-connecting-ip` precedence), pinned by conformance. |
| `body-parser` | `@nextrush/body-parser` behavior + actionable `@Body` errors when no parser ran. |
| `portable-middleware` | Middleware/extension edge-portability: Web-standard globals over `node:*`, per-package runtime-support declarations. |
| `graceful-shutdown` | `serve()` opt-in signal-wired connection drain (`SIGTERM`/`SIGINT`, timeout, handler cleanup). |
| `health` | `@nextrush/health` `/livez` + `/readyz`, check registry, bounded checks, draining-aware readiness integration. |
| `performance-gate` | CI perf-regression gate (smoke profile) + class-path-overhead benchmark methodology. |
| `runtime-adapter-contract` | Typed `ServerAdapter`/`FetchAdapter` two-tier contract, shared Context factory, compile-time conformance guard, observable parity. |
| `runtime-capability-negotiation` | Behavior decided by negotiated `RuntimeCapabilities` (never runtime identity), degradation/refusal, probing, named profiles. |
| `runtime-proof-harness` | CI proof of multi-runtime claims: real-runtime conformance, edge bundle budget, cold-start, cert matrix, scheduled cloud deploy, WinterCG assertion. |
| `serverless-adapter` | `@nextrush/adapter-serverless` tiered API, `EventMapper` registry, streaming, timeout→504, warm reuse, full-chain fixtures. |
| `adapter-development-kit` | `nextrush generate adapter` scaffolder + externally-consumable conformance entrypoint. |
| `public-surface-lock` | Per-package exported-symbol lock tests (runtime `Object.keys` + compile-time type surface); cross-subpath public type-name coherence; README-documents-only-locked-exports accuracy. |
| `gap-checklist-accuracy` | `docs/audits/03-gap-checklist.md` statuses verified against source, with citable notes. |
| `framework-composition` | How NextRush's packages compose into one installable framework: the meta-package's dependency/install footprint matching its advertised footprint, the no-install-script rule, canonical publishable-manifest conventions, and satellite-package discoverability via a maintained catalog. |
| `project-scaffolding` | The `create-nextrush` project-generation contract: per-package framework-version resolution with an offline fallback map, template generation across every style × runtime × middleware combination, the generate-then-install verifier gate, and the guarantee that a generated project installs, builds, and runs with working DI on its selected runtime, carrying production-ready defaults and honest, self-consistent documentation. |
| `security-boundaries` | The framework's cross-package security contract: fail-closed decisions on missing/malformed input, canonical-path-based path exemptions, the boot-time production security audit (proxy/CORS/static/cookie misconfiguration), the `security()` composite preset, fuzz-hardened parsers, cross-adapter header-write/proxy-trust conformance, and the documented `@nextrush/session` position. |
| `dev-tooling` | The `@nextrush/dev` local-development lifecycle contract: the CLI (`dev`, `build`, `generate`, `codemod`), SWC-everywhere TypeScript compilation with guaranteed decorator-metadata emission (so DI works), cross-runtime process spawning and native-watcher auto-restart, the incremental build cache, type-declaration emission, the cross-runtime loader-resolution strategy, and the toolchain's diagnostics and verification bar. |
| `ecosystem-interop` | Optional, opt-in adapters that wrap a stable external execution contract into NextRush `Middleware`, without reversing the dependency arrow into core, without claiming Edge portability, and with a test-backed compatibility registry. |

### How to choose a capability

1. Identify the externally observable behavior or guarantee being changed.
2. Find the capability whose **Owns** description covers that behavior.
3. Read that capability's living `spec.md` and inspect its existing requirements before writing
   a delta.
4. If the change spans capabilities, split the delta by ownership and avoid duplicated
   requirements.
5. If no owner fits, explain why in `proposal.md` and justify a new durable capability before
   creating its folder.

Do not select a capability just because its package contains the implementation. The spec owner
is determined by the contract being changed.

## 3. Change lifecycle

Use the built-in OpenSpec `spec-driven` workflow unless the project explicitly adopts a
different schema.

1. **Understand first.** Inspect the relevant living specs, source, tests, package boundaries,
   runtime behavior, and applicable RFCs/ADRs. Establish what the framework currently does and
   where the intended contract is recorded.
2. **Propose.** Explain the problem, motivation, scope, non-goals, affected capabilities,
   packages/runtimes, and compatibility impact.
3. **Specify.** Write deltas against existing capability requirements. Use `ADDED`,
   `MODIFIED`, `REMOVED`, or `RENAMED` correctly. Do not create a new capability merely to
   hold one change.
4. **Design.** For non-trivial work, explain the affected execution path, package boundaries,
   design decisions, alternatives, risks, and relevant performance/security/runtime implications.
   Keep implementation detail out of behavioral requirements.
5. **Plan.** Break the approved design into ordered, verifiable tasks. Include tests,
   conformance, benchmarks, documentation, and release work when applicable.
6. **Apply.** Implement against the approved artifacts. If implementation evidence changes the
   scope, contract, or design, update the change artifacts rather than silently drifting.
7. **Verify and archive.** Verify the implementation against every relevant scenario, synchronize
   the intended living specs, and preserve durable decisions in RFCs/ADRs before archiving.

The configuration in `config.yaml` adds NextRush-specific instructions to the built-in
`spec-driven` workflow. It does not redefine the schema's artifact graph or replace the generic
OpenSpec artifact syntax.

## 4. Archive retention

The archive is **not the source of current behavioral truth**. It is a historical convenience
whose retention follows the repository's actual Git and ignore policy.

- **Living specs are authoritative for current contracts.** Do not use archived change files to
  decide what the framework currently guarantees.
- **Git is the durable history.** Preserve the shipped change's rationale and implementation
  history in commits. The archive may be retained or pruned according to repository policy.
- **Do not assume archive contents are tracked.** Check `.gitignore` and the repository's
  configured OpenSpec archive behavior before relying on an archived folder as a durable record.
- **Promote the durable decisions.** A lasting architectural decision ("why the segment trie",
  "why ESM-only", "why request-scope bubbles") belongs in `docs/RFC/` or `docs/adr/` as
  appropriate. Capture and approve it **before** archiving if the change's governance requires
  it. A disposable archive is never the only home for load-bearing architectural rationale.

## 5. Keeping the living specs accurate

When a change ships:

1. Confirm the implementation and tests satisfy the accepted delta scenarios.
2. Synchronize the delta into the correct existing capability spec.
3. Preserve the capability's meaningful `## Purpose`; update it only if the durable ownership
   genuinely expands.
4. Check that no requirement was accidentally dropped, duplicated, weakened, or left describing
   behavior that was not shipped.
5. Check cross-capability references and runtime guarantees for consistency.
6. Confirm any required RFC/ADR, Changeset, migration note, and documentation updates exist.
7. Review the final diff. The living specs must describe the shipped contract, not the original
   intention if implementation changed through an approved revision.

The capability set should remain small and stable. The goal is not to minimize the number at all
costs; it is to ensure every folder represents a real, durable responsibility and every
requirement has a clear owner.