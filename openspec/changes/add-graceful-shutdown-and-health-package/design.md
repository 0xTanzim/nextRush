## Context

`packages/adapters/node/src/adapter.ts`'s `serve()` already returns a `close()` that drains
connections correctly (stop-accepting → force-close-after-timeout → `app.close()`), confirmed at
lines 224-242. No signal handler exists in the file. `@nextrush/health` doesn't exist; the
convention for new middleware packages is `packages/middleware/<name>/` with a
`middleware.ts`/`types.ts`/`constants.ts`/`index.ts` split (confirmed against
`packages/middleware/request-id/`, the smallest existing example of the same shape).

## Goals / Non-Goals

**Goals:**
- Wire SIGTERM/SIGINT to the existing drain logic, opt-in, cleanly installable/removable.
- Ship `@nextrush/health` with `/livez` + `/readyz` and a registrable check API.
- Make the two work together: a registered readiness check can reflect "currently draining" so
  a load balancer stops routing new traffic to a pod mid-shutdown, not just mid-crash.

**Non-Goals:**
- Not building a generic cross-runtime signal-handling abstraction in `@nextrush/runtime` for
  this task — Node's `process.on('SIGTERM', ...)` is Node-specific; Bun/Deno/edge adapters don't
  face the same k8s-SIGTERM lifecycle (edge isolates don't receive OS signals at all; Bun/Deno
  have their own signal APIs but no adapter currently claims to support graceful shutdown there).
  Scope this to `@nextrush/adapter-node` only; a cross-adapter seam is a separate, future proposal
  if Bun/Deno adapters ever need the same feature.
- Not making `@nextrush/health`'s checks async-queue-based or rate-limited — a check registry is
  a simple array of `() => Promise<boolean>` functions, run on each `/readyz` request. If check
  cost becomes a real problem (e.g. an expensive DB ping on every probe), that's a future caching
  layer, not day-one scope.
- Not adding authentication to `/livez`/`/readyz` by default — these are conventionally
  cluster-internal, unauthenticated probe endpoints (matching Kubernetes' own convention). The
  package's README must state this explicitly as a security posture decision, per this repo's
  security-disclosure steering, not leave it implicit.

## Decisions

**D1 — `gracefulShutdown` is a new field on `ServeOptions`, not a separate exported function.**
`serve()` already owns the server lifecycle and returns `close()`; the natural place for "also
wire signals to that close" is an option on the same call, not a second helper the user has to
remember to call separately. Alternative considered: a standalone `handleShutdown(server)`
helper (mentioned as an alternative in the checklist's own task description). Rejected as the
primary API — a second function invites "did I call this?" mistakes; an option on `serve()` is
harder to forget. A standalone helper MAY still be exported for advanced users who build their
own server lifecycle outside `serve()`, but `ServeOptions.gracefulShutdown` is the primary,
documented path.

**D2 — Default signal set is `['SIGTERM', 'SIGINT']`; override via
`{ signals, timeout }` shape.**
These are the two signals every orchestrator (k8s, PM2, systemd, Docker) sends for a graceful
stop request. `SIGKILL` is deliberately excluded — it cannot be caught by design, so listing it
would be misleading. `timeout` in this option, if provided, overrides `ServeOptions.shutdownTimeout`
for the signal-triggered path specifically (falls back to the existing `shutdownTimeout` if
omitted) — one timeout concept, not two competing ones.

**D3 — Signal handlers are registered only when `serve()` is called with the option truthy, and
removed when `close()` completes.**
Per this repo's `AGENTS.md` philosophy ("never ask developers for information the framework
already knows" balanced against "no hidden side effects, no magic behavior") — auto-installing
process-wide signal handlers on every `serve()` call, even without being asked, is exactly the
kind of global side effect the steering warns against; opt-in is the correct default. Removing
the handler on completion (rather than leaving it attached) avoids leaking a listener if the
server is started/stopped multiple times in one process (e.g. in tests).

**D4 — `@nextrush/health`'s readiness check can reflect an in-progress graceful shutdown, via a
shared "draining" signal — but this is an optional integration, not a hard dependency.**
If both packages are installed together, `@nextrush/health` should be able to flip `/readyz` to
`503` the moment shutdown begins (not just once fully drained) — this is what actually helps a
load balancer stop routing traffic promptly. Alternative considered: no integration, treat them
as fully independent. Rejected as a missed, cheap win — but implemented as an *optional* check a
user registers (e.g. `healthChecks.register('draining', () => !isShuttingDown)`), not a hard
import dependency between the two packages, so `@nextrush/health` still works standalone for
users who don't use `gracefulShutdown` at all.

**D5 — `/livez` never depends on registered checks; `/readyz` does.**
This matches the standard Kubernetes liveness-vs-readiness distinction: liveness answers "is the
process alive enough to respond at all" (used to decide whether to restart the pod — should
almost never fail once the process is up), readiness answers "should traffic be routed here right
now" (used to decide load-balancer inclusion — expected to flip during startup/shutdown/degraded
states). Conflating them (e.g. failing `/livez` because a DB check failed) would cause
unnecessary pod restarts for a transient dependency outage.

## Risks / Trade-offs

- **[Risk]** Registering a `process.on('SIGTERM', ...)` handler changes the default Node.js
  behavior for that signal (default: process exits immediately). If a user's own code also
  listens for SIGTERM independently, there could be a double-handling conflict.
  → **Mitigation**: Document this behavior change explicitly in `serve()`'s JSDoc and the
  adapter's README — this is the entire point of the opt-in (a user with their own SIGTERM
  handling simply doesn't set `gracefulShutdown`, or coordinates the two directly). Use
  `process.once` semantics per removal (D3) to avoid a handler surviving past its `serve()` call.
- **[Risk]** A registered health check that never resolves (a hung DB ping) could make
  `/readyz` hang indefinitely.
  → **Mitigation**: Wrap each check invocation with a short timeout (e.g. a few seconds,
  configurable) inside the health package itself, treating a timed-out check as a failure —
  decide the exact default during implementation, but this must not be left unbounded.
- **[Risk]** `@nextrush/health` is a new network-exposed surface; if a user mounts it behind
  auth accidentally (or an adopter assumes it needs auth and blocks legitimate cluster probes),
  either misconfiguration causes a real outage.
  → **Mitigation**: The package's README states plainly, up front, that these endpoints are
  conventionally unauthenticated and cluster-internal, with an explicit note on how to add auth
  if the deployment requires it (e.g. network-policy-level restriction rather than
  application-level auth, which is the standard k8s pattern).

## Migration Plan

No runtime/data migration. Both pieces are purely additive (new option, new package) — no
existing behavior changes for anyone not opting in. Deploy as two independently-revertible
commits within one PR: (1) the `gracefulShutdown` option, (2) the `@nextrush/health` package.

## Open Questions

- Should the health check registry support both sync (`() => boolean`) and async
  (`() => Promise<boolean>`) check functions, or async-only for consistency? Lean toward
  supporting both (many real checks — e.g. "is this env var set" — are trivially synchronous and
  forcing `Promise.resolve()` everywhere is friction), but confirm during implementation against
  how `@nextrush/request-id` or similar packages handle sync/async duality, if they do.
