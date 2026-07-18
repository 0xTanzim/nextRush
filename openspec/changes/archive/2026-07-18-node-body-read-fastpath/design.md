## Context

`packages/adapters/node/src/body-source.ts` `NodeBodySource.buffer()` (verified current) does, in
order: return the cached buffer if already consumed; throw `BodyConsumedError` on a second read;
throw `BodyTooLargeError` if `content-length` exceeds the limit (before reading); then
`for await (const rawChunk of this.req)` accumulating `chunkToBuffer(rawChunk)` into `chunks[]`,
checking the running total against the limit (on exceed → `this.req.destroy()` + `BodyTooLargeError`),
and finally `Buffer.concat(chunks)` cached into `_cachedBuffer`. `text()` and `json()` call
`buffer()`; `stream()` is a separate unbuffered `Transform` path.

`for await…of` over an `IncomingMessage` allocates an async iterator and a per-chunk promise. The
classic `req.on('data')` / `req.on('end')` accumulation avoids that overhead. This change swaps the
read mechanism while preserving every observable behavior — but the event form must explicitly
handle the stream-lifecycle cases the async iterator handled implicitly.

## Goals / Non-Goals

**Goals:**

- Replace `for await…of` in `buffer()` with event-listener accumulation, byte-identical results
  and identical limit / error / cache semantics.
- Explicitly handle already-ended streams, client disconnect/abort, single-settle, and listener
  cleanup — the cases the async iterator covered for free.
- Gate on a `--profile full` **POST JSON** A/B (the scenario is in the `wrk` suite) + `bench:validate`.

**Non-Goals:**

- **Not** `JSON.parse` / the `json()` body-parser middleware (out of scope — dominates POST cost).
- **Not** the `stream()` method (unbuffered `Transform` path is unchanged).
- **Not** `WebBodySource` (Bun/Deno/Edge) — its Web reader-loop is a separate concern/follow-up.
- No public API/type change; the `BodySource` contract is preserved exactly.

## Decisions

**D1 — Event-listener accumulation inside a Promise.** Keep the synchronous preamble unchanged
(cached-buffer return, `BodyConsumedError`, `content-length` pre-check, `_consumed = true`), then
read via a `new Promise<Uint8Array>` whose executor attaches `data`/`end`/`error` (and `close`)
listeners **synchronously**: `data` → `chunks.push(chunkToBuffer(chunk))` + running-total limit
check; `end` → resolve `Buffer.concat(chunks)`; `error` → reject. Node keeps the request stream
paused (non-flowing) until a consumer attaches, so attaching in `buffer()` loses no data.

**D2 — Single-settle guard + listener cleanup.** A `settled` flag ensures exactly one of
resolve/reject fires (the limit-exceed, `end`, and `error`/`close` paths cannot double-settle). On
settle, remove all attached listeners (`data`/`end`/`error`/`close`) to avoid leaks — especially
after `this.req.destroy()` on a limit breach.

**D3 — Already-ended stream.** Before attaching, guard the case the async iterator handled
implicitly: if `req.readableEnded` is already true (body fully consumed/ended before `buffer()` is
called), resolve with an empty buffer rather than attaching an `end` listener that will never fire
(which would hang the request). If the stream was already destroyed with an error, reject.

**D4 — Client disconnect / abort mid-body.** Reject on `error` (modern Node surfaces premature
close as `ERR_STREAM_PREMATURE_CLOSE`), matching the async iterator's reject-on-error. Defensively,
a `close` without a prior `end` (and not already settled) also rejects, so a mid-body disconnect
never leaves the promise pending. The rejection reason is the stream error (or an aborted error),
propagated as-is.

**D5 — Limit semantics preserved exactly.** The `content-length` pre-check still throws
synchronously before any listener is attached (no bytes consumed). The streaming check runs inside
the `data` handler on the running total; on exceed it calls `this.req.destroy()` and rejects with
`BodyTooLargeError(this.options.limit, totalLength)` — identical to today.

**D6 — Caching, chunk handling, and downstream unchanged.** `chunkToBuffer` (Buffer / string /
Uint8Array / ArrayBuffer), `Buffer.concat`, and `_cachedBuffer` caching are unchanged, so `text()`
(TextDecoder) and `json()` (JSON.parse → `BadRequestError` on failure) behave identically.

**D7 — Characterize before changing + measurement-gated.** Pin current `buffer()`/`text()`/`json()`
behavior with a test matrix (below) and a differential check across a payload corpus BEFORE the
rewrite. Accept only on: the matrix green, `bench:validate` parity, and a `--profile full` POST-JSON
A/B showing no regression. **Honest expectation:** `JSON.parse` dominates POST, so the RPS delta
may be small; the change is accepted on no-regression + the removed per-chunk async-iterator
overhead, not an overstated POST win.

## Risks / Trade-offs

- **[Risk] Data lost if the stream is flowing before listeners attach.** → **Mitigation:** Node
  keeps the request paused until a consumer; listeners are attached synchronously in `buffer()`; a
  test streams a chunked body and asserts the full payload is received.
- **[Risk] An already-ended stream hangs (the `end` listener never fires).** → **Mitigation:** D3
  guards `req.readableEnded`; a test calls `buffer()` after the stream ended and asserts a clean
  empty/settled result.
- **[Risk] Double-settle on a limit+`end` or `error`+`close` race.** → **Mitigation:** D2's
  `settled` flag; a test drives a limit breach and asserts a single `BodyTooLargeError`.
- **[Risk] Listener leak after `req.destroy()`.** → **Mitigation:** cleanup on settle; verified by
  a listener-count assertion after a limit breach.
- **[Risk] A client disconnect mid-body leaves the promise pending.** → **Mitigation:** D4's
  `error`/`close` handling; a test aborts mid-body and asserts the promise rejects.
- **[Risk / honest] The POST RPS gain is marginal because `JSON.parse` dominates.** →
  **Mitigation:** the POST-JSON A/B gates only against regression; the win is the removed per-chunk
  async-iterator/promise overhead, documented as such — no overstated POST claim.

## Migration Plan

No runtime migration and no consumer-facing change — behavior-preserving, pinned by the scenarios.
Ship as a single-method edit to `NodeBodySource.buffer()` behind the test matrix + the POST-JSON
A/B; trivially revertible (restore the `for await…of` loop).

## Open Questions

- Should `WebBodySource` (Bun/Deno/Edge) get an analogous reader-loop review? Likely a smaller
  effect (Web streams differ); note as a possible follow-up, not gating this change.
- Is a dedicated body-read allocation micro-bench worth adding, or does the POST-JSON A/B plus the
  behavior matrix suffice? Left to implementation.
