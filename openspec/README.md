# NextRush OpenSpec — Governance & Capability Registry

This directory has two layers with **opposite lifecycles**. Understanding the split is the
whole point.

```
openspec/
├── specs/      →  TRUTH:   what the framework does NOW.  SMALL & STABLE (~16 folders, forever).
│                          One folder per durable CAPABILITY. Changes EDIT these. We read this.
├── changes/    →  HISTORY: why we did it.  Grows forever — that's fine, git is the real history.
│   └── archive/            DISPOSABLE. Not read for truth. See "Archive retention" below.
docs/RFC/       →  the ~1% of durable architectural decisions (ADRs/RFCs). Curated by hand.
```

`specs/` growing one-folder-per-change is the failure mode this registry exists to prevent. A
`specs/` full of change-shaped stubs (`router-match-path-allocation-trim`, `*-fastpath`,
`TBD - created by archiving…`) makes "what does NextRush do today?" unanswerable. Keep it flat.

## The one rule

> **A change EDITS an existing capability's requirements.** It does **not** create a new
> `specs/<capability>/` folder — unless a genuinely new, durable capability is being born (rare,
> and you should expect to justify it).

Concretely, a change's delta targets one of the capabilities below with `ADDED` / `MODIFIED` /
`REMOVED` requirements. On sync/archive, that delta merges *into* the capability's living spec.
The folder count stays flat no matter how many changes ship.

- Capability names are **durable** (`router`, `node-adapter`), never change-shaped
  (`*-fastpath`, `*-trim`, `*-cleanup`, `*-microtrims`).
- Every capability spec has a **real `## Purpose`** — never a `TBD - created by archiving…` stub.

## Capability registry (16)

Pick the target capability for any change from this list. If nothing fits, that is the signal to
consider (and justify) a new capability — not to fall back to a change-shaped folder.

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

## Archive retention

The archive is **not** read for truth, so it is treated as disposable:

- **Git is the history.** Every proposal/design/tasks/delta is in git; the archive folder is a
  convenience copy, not the record of record.
- **Prune freely.** Archived change folders may be deleted after their change has shipped (and,
  if you like, one release later). Deleting them loses nothing recoverable — `git log` still has
  everything.
- **Promote the ~1% that's durable.** A decision with lasting architectural weight ("why the
  segment trie", "why ESM-only", "why request-scope bubbles") belongs in `docs/RFC/` as an
  RFC/ADR — a small, curated, hand-maintained set — **before** the change is archived, so nothing
  load-bearing lives only in a prunable archive.

## When a change lands (the loop that keeps `specs/` flat)

1. Propose the change against an **existing** capability (name it in `proposal.md`).
2. Write the delta as requirements ADDED/MODIFIED/REMOVED under that capability.
3. Sync/archive merges the delta into `specs/<capability>/spec.md` and updates its `## Purpose`
   if the capability's scope genuinely grew.
4. If the decision is architecturally durable, capture it in `docs/RFC/` too.
5. The archived change folder is now disposable.
