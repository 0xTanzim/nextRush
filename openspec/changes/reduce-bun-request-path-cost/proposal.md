# Proposal

## Why

Bun wire throughput is the largest measured runtime gap left after the POST body-read work: NextRush 36,859 rps versus Hono's 46,390 rps (0.79×), Elysia 50,970, and the raw listener 51,056 (wire stage, median of three, same run and machine). The Bun in-process GET ratio sits at 1.31–1.39 against a committed target of 1.3 and max of 1.9 — inside the hard gate but above target, and noisy. Both were deferred when the performance program closed; the POST body-read gap is owned by the sibling change `bun-body-read-parity`.

Two per-request overheads are already verified in code, not hypothesized:

- `trackedHandler` in `packages/adapters/bun/src/adapter.ts` wraps every request in an async function with a try/finally that increments and decrements a JS counter (`activeRequests`) only to serve graceful-shutdown drain accounting.
- `createBunRequestRunner` allocates a resolver thunk (`() => server.requestIP(request)?.address ?? ''`) per request even when `ctx.ip` is never read.

Chasing these without measurement is exactly what this repository's performance discipline forbids. The wire stage exists, runs a real listener on Bun, and reports a median of three — it is the right A/B instrument. This change is profile-gated: candidates land only on measured evidence, and within-spread results are parked.

## What Changes

- Take a Bun request-path baseline: wire-stage before numbers with spread, a CPU profile of the request path attributing cost across adapter/runner/dispatch/response, and per-candidate allocation baselines for the drain wrapper and the resolver thunk.
- Record the durable decision per the RFC gate: one RFC and one ADR covering drain accounting, client-address resolution, and the wire-stage acceptance rules, written before implementation.
- Land the candidates that profile evidence supports, each behind characterization/allocation tests, each keep/discard:
  - Drain accounting without the per-request async wrapper (platform pending-request count, if the pinned Bun version provides it and drain semantics stay identical).
  - Client-address resolution without the per-request resolver thunk (hold the platform references and resolve on first read, preserving the lazy, byte-identical `ctx.ip` behavior).
  - Wire-path costs the profile actually attributes, bounded to the Bun adapter/runner/server path.
- Verify: conformance on real Bun, unchanged behavior on all runtimes, no coverage decrease, budgets hold, wire-stage after numbers with the same invocation, and a budget-target ratchet only if a real reduction is proven.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `web-adapters`: one added requirement — Bun request-path candidates are accepted only on reproducible stage evidence (wire-stage A/B for wire-path work, deterministic allocation evidence for sub-noise trims) and are parked when the measured effect falls inside the run-to-run spread, with byte-identical behavior and no coverage decrease.

## Impact

- **SPEC deltas**: `web-adapters` — one added requirement pinning how Bun request-path work is accepted (wire-stage A/B; allocation evidence for sub-noise trims; parking rule; parity and coverage). No behavior change to any existing requirement.
- **Affected code**: `packages/adapters/bun/` (`adapter.ts`, `context.ts`); possibly `packages/runtime/src/web-runner.ts` only if the profile attributes cost there. No public API change. Node adapter untouched.
- **Guardrails**: cross-adapter conformance (real Bun, Node, Deno, edge), per-package tests, lint, strict typecheck, line coverage, dev-check budgets.
- **Out of scope**: POST body-read (sibling change), AOT (ADR-0029), serializer work (RFC-042), routing/middleware semantics, any public API or breaking change.
- **Durable decision**: RFC and ADR required before implementation (Bun adapter request-path work is RFC-gated). Planned as RFC-044 and ADR-0032, written after baseline attribution and before any implementation task.
