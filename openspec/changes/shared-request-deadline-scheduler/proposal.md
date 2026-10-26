# Proposal

## Why

The Deno POST path spent **19.5 % of the server's busy time** in the per-request timeout timer
(`Timeout` + `Timeout.<computed>` + `setTimeout` + `clearTimeout`), plus 6.67 % in
`dispatchWithTimeout` itself. Measured end to end against the same bundle with the handler race
disabled, the race cost **8.28 µs of server CPU per request on Deno POST (+29.8 %)**, 3.17 µs on
Bun (+14.6 %), and 0.97 µs on Node (+2.6 %).

The cause is a timer per request. `setTimeout` + `clearTimeout` costs 2.151 µs on Deno against
0.160 µs on Bun — 13× — and a request that waits on I/O (a body read) is still pending when the
timeout window opens, so the timer is armed for it. The deadline semantics do not need a timer per
request: one timer can serve every pending deadline.

## What Changes

- Serve the request deadline from one shared timer per runner instead of one timer per request
  (`packages/runtime/src/deadline-scheduler.ts`, `packages/runtime/src/web-runner.ts`).
- Keep the deadline exact: the shared timer wakes on a short window and is armed for the exact
  remaining time once the deadline is within that window.
- Replace the `Promise.race` over two promises with one deferred promise that whichever of the
  dispatch and the deadline settles first resolves.

**Not changed:** the timeout value, the 504 response, the `ctx.signal` cancellation, the committed-
response behaviour, the late-rejection guard, the microtask settle window, and the Node adapter's
own race (it has a separate implementation that coordinates with the socket-level `server.timeout`
guard).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `web-adapters` — adds the shared request deadline and its measurement gate.

## Impact

- **Affected packages:** `@nextrush/runtime` (and, through the shared runner, `@nextrush/adapter-bun`,
  `@nextrush/adapter-deno`, `@nextrush/adapter-edge`).
- **Affected audiences:** Application developers (a timeout still fires at the same deadline);
  Contributors.
- **Explicitly NOT affected:** request parsing, routing, middleware ordering, `ctx.next()`, response
  construction, body limits, streaming, error mapping, and the Node adapter's socket guard.
- **Governing documents:** `docs/RFC/runtime-adapters/046-json-media-type-and-response-construction.md`
  (extended), `report/performance/deno-post-timeout-and-json-media-type.md`.
