## Why

T010 and T011 are the two remaining P1 tasks in Phase 1 (Production Ready — Node) — per the
gap checklist, they're the entire remaining gate for "Production readiness (Node)" now that
T001/T002/T003/T005/T006/T007/T012/T013 are all closed. Both are genuinely production-blocking:
without T010, a SIGTERM in Kubernetes/PM2/systemd kills the process mid-request (dropped
in-flight requests, 502s on every rollout); without T011, there is no standard liveness/readiness
contract for orchestrators to probe.

Verified directly against source, not carried forward from the checklist:
- `packages/adapters/node/src/adapter.ts`'s `serve()` already implements real connection-drain
  logic in its returned `close()` (stop accepting new connections, force-close after
  `shutdownTimeout`, then `app.close()`) — confirmed at lines 224-242. What's missing is wiring
  that `close()` to an OS signal (`SIGTERM`/`SIGINT`); no signal handler exists anywhere in the
  file.
- `find packages -maxdepth 1 -iname '*health*'` returns no matches — `@nextrush/health` does not
  exist as a package today.

Grouping these two together because they're both "make a Node service safe to run in an
orchestrator" — the same operational concern, and a real health-check package benefits from
graceful shutdown existing first (a `/readyz` that flips before shutdown drain completes is more
useful than one bolted on separately).

## What Changes

- Add an opt-in `gracefulShutdown` option to `serve()`'s `ServeOptions` (boolean or
  `{ signals, timeout }`) that wires `SIGTERM`/`SIGINT` to the already-existing `close()` drain
  logic. Never auto-registers signal handlers when the option is omitted — this repo's own
  `AGENTS.md` "convention over configuration" principle is satisfied by a sensible default
  *shape*, but auto-installing global process-signal handlers without being asked is a different
  kind of surprise (global side effect on module load) that the opt-in avoids.
- Create a new package `@nextrush/health` (middleware, modeled on the existing
  `@nextrush/request-id` package's file layout: `middleware.ts`, `types.ts`, `constants.ts`,
  `index.ts`) exposing `/livez` and `/readyz` endpoints plus a check-registry API for registering
  custom readiness checks (DB ping, cache ping, etc.). A failing registered check flips `/readyz`
  to `503`; `/livez` reflects process liveness only (always `200` unless the process itself can't
  respond).
- **BREAKING**: None. `gracefulShutdown` is a new optional field on an existing options object,
  defaulting to today's behavior (no signal handlers installed). `@nextrush/health` is an
  entirely new, separately-installed package — zero impact on existing consumers.

## Capabilities

### New Capabilities

- `signal-wired-graceful-shutdown`: The requirement that `serve()` supports an opt-in mechanism
  wiring OS termination signals to the existing connection-drain logic, installable/removable
  cleanly, with zero dropped in-flight requests on a signal.
- `health-check-endpoints`: The requirement that a `@nextrush/health` package exposes liveness
  and readiness HTTP endpoints backed by a registrable check system, suitable for Kubernetes-style
  probes.

### Modified Capabilities

- None. No existing `openspec/specs/*` capability governs shutdown signal handling or health
  endpoints.

## Impact

- **Affected code:** `packages/adapters/node/src/adapter.ts` (`ServeOptions`, `serve()`);
  possibly `packages/runtime/src` if the signal-wiring helper is meant to be adapter-agnostic
  (decide during design — Node-specific signal APIs may mean this stays adapter-node-only, or a
  thin cross-adapter seam is warranted; see design.md). New package
  `packages/middleware/health/` (or wherever this repo's convention places new middleware
  packages — check `packages/middleware/request-id`'s parent directory for the real path).
- **Affected docs:** `packages/adapters/node/README.md` (new option documented),
  new `packages/middleware/health/README.md`, root `README.md`'s middleware table (add
  `@nextrush/health` alongside the existing entries).
- **Dependencies:** Neither task depends on any other open checklist item. `@nextrush/health`
  has no dependency on the shutdown work at the code level, but per this proposal's own grouping
  rationale, implementing shutdown first gives the health package something more meaningful to
  reflect in `/readyz` during a drain window (see design.md).
- **Systems:** `@nextrush/health` is a new, separately-installed middleware package — zero
  impact on existing consumers who don't install it. The `serve()` option is additive. Both
  changes are documented as security-relevant per this repo's steering: a `/readyz`/`/livez`
  endpoint is a new network-exposed surface and should be flagged for its own authentication
  posture (typically none needed for cluster-internal probes, but this must be stated explicitly
  in the package's docs, not left implicit).
