# Design

## Context

See `proposal.md` — Why. The constraints that shape the approach:

- The measured gap: Bun `wire` 36,859 rps vs Hono 46,390, Elysia 50,970, raw 51,056 (median of three, same run); the Bun in-process GET ratio 1.31–1.39 against target 1.3 / max 1.9 (`inproc.nextrush.vs_hono`), noisy. POST is owned by the sibling change `bun-body-read-parity`.
- `wire` is deliberately INFO, not a budget row (dev-check README): a slow socket result on a shared machine is not regression evidence; the in-process ratio stays the gate. This design uses `wire` as the acceptance instrument for wire-path work without turning it into a budget.
- Two per-request overheads are verified in code: `trackedHandler` (`packages/adapters/bun/src/adapter.ts`) wraps every request in an async function only to increment/decrement `activeRequests` for graceful-shutdown drain; `createBunRequestRunner` allocates a resolver thunk (`() => server.requestIP(request)?.address ?? ''`) consumed lazily by `createBunContext` (memoized on first read).
- Contracts that must not move: graceful-shutdown semantics (opt-in; zero behavior when omitted; in-flight requests drain within the configured timeout); `ctx.ip` lazy resolution with byte-identical values across trust modes and adapters; cross-adapter conformance; adapter work is RFC-gated.
- The toolkit already supports before/after as the same command twice: every run writes `.out/last-run.<runtime>.json` and prints the delta against it.

## Goals / Non-Goals

**Goals:**

- Attribute the Bun request-path cost with stage evidence (wire + CPU profile) and remove the per-request overheads the evidence supports: the drain wrapper, the resolver thunk, and any profile-attributed site in the adapter/runner/server path.
- Make wire-stage before/after with spread the acceptance instrument for wire-path candidates; park anything inside the spread.
- Keep behavior byte-identical (drain, `ctx.ip`, conformance) and ratchet only what is proven.

**Non-Goals:**

- No new wire budget row; `wire` stays INFO and the in-process ratio stays the gate.
- No public API/config change; no Node adapter change; no router/core/middleware semantics.
- POST body-read, AOT (ADR-0029), and serializer (RFC-042) stay with their existing decisions.
- No speculative rewrites: sites without profile attribution are parked, not "optimized".

## Decisions

### D1 — Evidence selects the mechanisms; the named candidates are still keep/discard

Task group 1 measures before anything is written: the wire stage before (median + spread), a CPU profile of the request shape via the documented dev-check `profile` entries ranked by site, the in-proc ratio, and direct measurements of the drain wrapper and the resolver thunk. Only sites the profile attributes are eligible for code; the two named candidates are preconceived but still park if their own measurements do not support them.

Why: it matches the repo's performance discipline (profile before change) and keeps the change auditable against its own evidence.

Alternatives rejected: starting from the two known candidates without attribution — it leaves the rest of the gap unexplained and risks a "win" that does not move the wire number.

### D2 — Drop the per-request drain wrapper when the platform count is provably equivalent

`trackedHandler` exists only to keep `activeRequests` for the drain loop. If the pinned Bun version exposes a pending-request count on the server instance with equivalent semantics, use it and delete the wrapper; otherwise park. Drain behavior must stay identical: opt-in signal wiring, zero behavior when `gracefulShutdown` is omitted, bounded wait, unchanged close path.

Why: it removes one async frame plus two counter mutations per request, on the wire path where the gap is measured.

Alternatives rejected: a "cheaper" wrapper (still a frame per request); counting only while a drain is pending (requests already in flight when the signal arrives would be missed, under-draining).

### D3 — Resolve the client address without a per-request thunk

Pass the resolver inputs into `createBunContext` and resolve `ctx.ip` on first read with the existing memoization, deleting the per-request `() => server.requestIP(request)?.address ?? ''` closure. Park if the refactor forces a compensating allocation.

Why: `ctx.ip` is usually unread; the closure is pure overhead, and the web-adapters contract only requires lazy + identical values.

Alternatives rejected: eager resolution (pays `requestIP` per request even when unread, and breaks the laziness requirement); storing a bound function (same closure cost, just moved).

### D4 — Acceptance: wire spread governs wire work; allocation evidence governs sub-noise trims

Wire-path candidates are measured before/after with the same stage invocation, machine, and pinned runtime; the median plus min–max spread is recorded, and anything inside the spread is parked and reverted (the `web-adapters` spec delta pins this). Sub-noise per-request trims are accepted on deterministic allocation evidence plus the package tests and conformance, per the capability's existing discipline. Budget ratchets touch only the in-proc rules (`inproc.nextrush.vs_hono` target) and only after repeated runs land beyond the old value with headroom.

Why: `wire` is INFO by design, so it can support a before/after claim but must never become a gate; parking inside the spread keeps machine noise from shipping as progress.

Alternatives rejected: gating on wire (socket results on shared machines are not regression evidence); accepting single-run deltas (the documented sample spread was ~40% before the best-of-three protocol).

### D5 — Boundaries and the RFC gate

No public API change, no signature change outside `packages/adapters/bun`, no change to the adapter dependency direction. Task group 2 records the durable decisions as RFC-044 and ADR-0032 (the adapter request path is RFC-gated) after baseline attribution and before any implementation; task 2.3 links them from this design and the indexes. The records live at `docs/RFC/runtime-adapters/044-bun-request-path-trims.md` and `docs/adr/ADR-0032-bun-request-path-trims.md`.

Why: repo governance (an RFC precedes implementation) and the RFC's role as the durable record beyond the disposable archive.

Alternatives rejected: skipping the RFC for an "internal" change (the gate covers adapter changes); writing it before the baseline (it would pre-commit to mechanisms the evidence has not yet selected).

## Risks / Trade-offs

- **Wire spread swallows the result** → median of three, min–max recorded; park inside the spread; never claim a win smaller than the spread.
- **`pendingRequests` semantics diverge** (keep-alive edge cases, upgrades) → verify equivalence against the pinned Bun version; graceful-shutdown and probe tests must stay green; park D2 otherwise.
- **Context refactor changes `ctx.ip` behavior** → characterization tests for every trust mode plus conformance on Bun/Deno/Edge; park D3 if a compensating allocation appears.
- **Baseline drift** (machine, or the sibling body-read change landing mid-flight) → same machine and invocation for before/after; re-baseline if the tree under test changes.
- **Wire does not improve even when in-proc does** → the wire claim requires wire-stage evidence; record the parked result honestly and never ratchet on in-process numbers alone.

## Migration Plan

Internal only: no public API, config, schema, or dependency change. Each candidate is independently revertible; parked candidates leave no residue in the tree. Rollback = revert the candidate's commit; the drain wrapper and the resolver thunk remain the pre-change fallbacks.

## Open Questions

- Does the pinned Bun version's pending-request count match the JS counter's semantics under load? (Answered by the task 1.x measurements and the graceful-shutdown tests; D2 parks if not.)
- After the trims, does the in-proc GET ratio move enough to justify ratcheting the `inproc.nextrush.vs_hono` target? (Deferrable to the after-profile.)
