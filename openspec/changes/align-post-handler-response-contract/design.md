# Design

## Context

See `proposal.md` — Why for the measured problem. This section records only what shapes the
approach.

Current state, verified this session:

- `WebResponseBuilder` (Web family) records the response privately and builds the `Response` after
  the chain; the Node adapter (via `NodeContext`) writes straight through with
  `res.writeHead()`/`res.end()` inside the response method. That single difference is the origin of
  both bugs and of the divergence `openspec/specs/runtime-adapter-contract` already forbids.
- Every Node response method (`json`, `send`, `html`, `redirect`, `sendStream`) already guards with
  `if (this._responded || this._res.headersSent) return;`. `ctx.set()` is the sole exception: it
  calls `res.setHeader()` unconditionally, so it is also the sole path that can throw
  `ERR_HTTP_HEADERS_SENT`.
- `packages/runtime/src/web-runner.ts` `dispatchWithTimeout()` observes a settlement promise and
  burns up to `SETTLE_TURNS` (4) microtask turns before deciding whether to arm a timer. For a
  synchronously-answered handler the loop exits at turn 1; the remaining cost is the settlement
  wrapper allocation plus one turn (measured 0.42–0.60 µs/request, 14.4 % in the A/B).
- `openspec/specs/web-adapters` already requires the timeout be armed only when the handler has not
  already settled, and that "no timeout racing is performed" for a synchronous handler. The runner
  does not satisfy the second half.
- The in-proc dev-check entries import `@nextrush/adapter-bun`'s `createHandler` unconditionally, so
  the Node in-proc row measures the shared Web runner on Node, not the Node adapter.

Constraints that bound the approach: the core stays runtime-independent (`AGENTS.md` §7); the
package hierarchy is respected (lower never imports from higher); every adapter-touching behaviour
change carries a cross-adapter conformance task; and observable-behaviour changes are bundled
deliberately, not smuggled in under a tooling change.

## Goals / Non-Goals

**Goals:**

- Make the post-handler write outcome and the timeout-completion outcome identical on every
  adapter, so the divergence that produced both bugs becomes a conformance failure.
- Keep every change reversible per adapter: the Node post-commit guard and the Web timeout
  completion are independent edits with independent tests.
- Leave the in-proc gate able to catch this class of drift, and to verify the fixes.

**Non-Goals:**

- The recorded-response model itself (RFC-041 §15 P1–P4). Compression and timer headers becoming
  functional on Node requires that model; this change does not build it and does not remove the
  `FB-03` exemption.
- Any new public API, new package, or new configuration option.
- A general "make `ctx.set` never throw" guarantee. Only the post-commit case becomes a no-op; the
  invalid-field/control-character guard still throws, before commit, on every adapter.
- Cache-line or kernel-visibility claims. JavaScript exposes no portable cache-miss or
  branch-mispredict counter, so any layout statement is recorded as labelled inference; kernel-level
  behaviour is left to the existing OS-queue and socket-timeout evidence rather than asserted from
  user space.

## Decisions

### D1 — A post-commit header write is a no-op that reports once, not a throw

`ctx.set()` on Node joins the response methods that already no-op after commit, and reports once per
process. Rationale: the guards on `json`/`send`/`html`/`redirect`/`sendStream` are the established
contract for "response already committed", so `set` is the outlier being brought into line, not the
rule being changed; and the throw is precisely what truncates the chain, so catching it elsewhere
would leave the composer deciding whether an adapter-internal rejection is a legitimate error.

Alternatives considered:

- **Catch the rejection in the composer / `handleError`.** Rejected: the throw originates inside the
  adapter context, and the composer cannot distinguish a late header write from a real handler error
  without inspecting the error code — putting platform knowledge in the runtime-agnostic layer.
- **Throw a typed framework error instead of the platform error.** Rejected for this change: a typed
  throw is still a throw, so the chain still aborts. It is the right shape *if* a later decision
  wants late writes to be fatal, which is why D1 keeps the warning observable.
- **Leave it and document it.** Rejected: it silently discards unrelated outer middleware work
  (metrics, audit, cleanup), which is a correctness bug, not a documentation gap.

Consequence to accept: a middleware that intended to set a header and now silently does not. Mitigated
by the once-per-process warning and by the compression/timer README notes that already exist for the
same surface.

### D2 — A committed response wins over the handler timeout

When the handler has already committed a response, every adapter delivers that response; the 504 is
reserved for a request that produced nothing. Rationale: Node already behaves this way, and the Web
504 discards a response the handler correctly produced.

Alternatives considered:

- **Unify on "always 504 when the timeout wins".** Rejected as unimplementable without buffering: on
  Node the response is already on the wire, so a later 504 cannot replace it. Only the
  recorded-response model (RFC-041) could make a late 504 possible, and adopting 504 as the contract
  today would make that model a behaviour break rather than a refinement.
- **Keep the divergence and pin it in the driver contract.** Rejected: it contradicts
  `runtime-adapter-contract`'s existing parity requirement, and it means the same handler is
  "successful" or "failed" depending on the deployment target.

### D3 — The arming decision stays cheap, and the chain is still awaited

The design does not skip awaiting the middleware chain when a response is already committed, because
post-handler middleware that lands a header today (Bun) would lose it. What changes is the
*decision*: the runner must reach "already settled, so no timer" without allocating a settlement
wrapper for that case, and must deliver the committed response when the handler outlives its
timeout (D2) rather than either hanging the socket or substituting a 504.

Candidate shapes to A/B, in order of preference:

1. A synchronous `ctx.responded` check immediately after `handler(ctx)` that selects a non-racing
   path, with the settlement wrapper allocated only on the path that can actually arm a timer.
2. Reducing the observation to a single turn with the settlement recorded on a scalar, removing the
   holder object and its promise.
3. Leaving the structure and reducing `SETTLE_TURNS`.

The measurement decides, and the task is gated on it: shape 3 is expected to be worthless because
the loop already exits at turn 1 for a settled chain, and the design records that expectation so a
null result is a finding rather than a surprise. The target is the committed
`inproc.nextrush.vs_hono` gate and a CPU-pinned A/B; a run-to-run spread of 8–12 % is the noise
floor on this machine, so an improvement below that is not evidence.

### D4 — The in-proc measurement exercises the adapter it names

An in-proc entry selects the adapter for the runtime it runs under, so a Node row measures the Node
adapter and a Bun row measures the Web entry point; and every row records which adapter and runtime
it exercised, so a runner cost is never read as an adapter cost. The existing Bun entry, which
deliberately measures the shared runner, is kept and labelled rather than deleted — it is the
control that isolates runner cost from adapter cost.

### D5 — The durable decision is recorded in `docs/RFC/` before this change is archived

This change fixes an adapter-contract behaviour, which `openspec/config.yaml` RFC-gates, and the RFC
that owns this surface (`docs/RFC/runtime-adapters/041-recorded-response-model.md`) is currently
`Deferred`. The decision this change makes — post-commit writes are discarded-and-reported, and a
committed response outlives the timeout — is therefore recorded in that RFC as the interim contract
that the recorded-response model must preserve, so the model is built as a refinement of it rather
than in conflict with it. No new RFC is created: the surface already has an owner.

## Risks / Trade-offs

- **A silently dropped header replaces a loud throw.** → The warning fires once per process and names
  the field; a test asserts the warning fires, so the guard cannot swallow without reporting.
- **Delaying the response to post-handler middleware stays as-is, so the fix is not a latency win.**
  → Expected and accepted: the win in D3 is removing racing, not changing delivery order.
- **The 504 → committed-response change surprises a caller.** → Marked **BREAKING (observable)** in
  the proposal with migration guidance, and pinned by a conformance scenario on every adapter.
- **A behaviour change ships under a change that also touches tooling.** → The adapter behaviour
  changes and the measurement change are separated into distinct task groups, each independently
  revertible, so a revert of one does not drag the other.
- **The perf A/B is inconclusive on a noisy box.** → The task records a null result as the outcome
  and does not ship a change without a committed-gate improvement above the noise floor.

## Migration Plan

Order: record the decision (D5) → land the two behaviour fixes behind their own tests → reconcile
the measurement entry → re-run the gates. Each step is independently revertible: the Node guard and
the Web timeout completion are separate edits with separate tests, and neither depends on the
measurement change. Rollback at any point restores the previous adapter behaviour without touching
the other adapter family.

## Open Questions

None arising in this change. The one question this surface leaves open — whether a committed
response should ever be *replaceable* — is RFC-041's decision, and this change deliberately records
the interim answer (D2) instead of pre-empting it.
