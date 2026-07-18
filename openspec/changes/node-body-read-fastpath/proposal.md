## Why

Finding **HP-16** of the hot-path review (`report/core-hot-path-performance-review.md`) — the last
high-impact item, targeting **POST JSON**, which is NextRush's **weakest relative benchmark**
scenario (behind both Hono and Fastify). `packages/adapters/node/src/body-source.ts`
`NodeBodySource.buffer()` reads the request body with:

```ts
for await (const rawChunk of this.req) { ... }
```

`for await…of` over an `IncomingMessage` allocates an async iterator and resolves a promise **per
chunk** — measurably heavier than the classic `req.on('data')` / `req.on('end')` accumulation used
by fast body readers. This is the core-adapter contribution to the POST latency.

**Honest scope:** the dominant cost of the POST scenario is `JSON.parse` plus the `json()`
middleware, both in `@nextrush/body-parser` — **out of scope**. This change is strictly the
**core-adapter stream-read** lever; it does not claim to close the whole POST gap, and no RPS gain
is promised beyond what a `--profile full` POST A/B measures.

## What Changes

- Rewrite `NodeBodySource.buffer()` to accumulate chunks via **event listeners**
  (`req.on('data')` → push, `req.on('end')` → resolve, `req.on('error')` → reject) instead of
  `for await…of`, preserving **every** current behavior:
  - the cached-buffer fast path on re-read;
  - `BodyConsumedError` on a second read;
  - the content-length pre-check limit (throws **before** reading);
  - the streaming limit check with `this.req.destroy()` and `BodyTooLargeError(limit, size)` when
    the body exceeds the limit mid-stream;
  - `chunkToBuffer` handling of `Buffer` / `string` / `Uint8Array` / `ArrayBuffer` chunks;
  - `Buffer.concat` + cache, and the empty-body → empty-buffer result;
  - `text()` and `json()` (which call `buffer()`) behaving identically.
- Handle the stream-lifecycle edge cases the async-iterator form handled implicitly: an
  **already-ended** stream (listeners attached after `end`), a client **disconnect / abort**
  mid-body, single-settle (never resolve-and-reject), and listener cleanup on settle.
- **NOT** touched: the `stream()` method (unbuffered `Transform` path), `JSON.parse` / the
  `json()` body-parser middleware (out of scope), and the Web adapters' `WebBodySource`
  (`@nextrush/runtime`) — its reader-loop shape is Web-native and, if worth trimming, is a
  separate follow-up.
- **BREAKING**: None. `BodySource.buffer/text/json` observable behavior — return values, the
  cached-read semantics, and the exact error types (`BodyTooLargeError`, `BodyConsumedError`,
  `BadRequestError` for invalid JSON) — are preserved and pinned by the spec's scenarios.

## Capabilities

### New Capabilities

- `node-body-read-fastpath`: The requirement that `@nextrush/adapter-node`'s `NodeBodySource`
  buffer the request body via event-listener accumulation rather than `for await…of`, while
  guaranteeing byte-identical results and identical error/limit/cache semantics — including the
  content-length and streaming size limits, `BodyConsumedError` on re-read, empty bodies, all chunk
  types, and correct settling on stream errors, client disconnects, and already-ended streams.

### Modified Capabilities

- None. This is an implementation-level rewrite of one method; the observable `BodySource`
  contract it preserves is captured by the new capability's scenarios as the regression contract.

## Impact

- **Affected code:** `packages/adapters/node/src/body-source.ts` (`NodeBodySource.buffer()` only;
  `text()`/`json()` are unchanged and benefit transitively; `stream()` untouched).
- **Affected tests:** `packages/adapters/node/src/__tests__/` — a body-read behavior matrix
  (limits via content-length and streaming, `BodyConsumedError`, empty body, chunk types, stream
  error, client disconnect, already-ended stream, cached re-read) plus a differential check that
  results match the pre-change reader across a payload corpus.
- **Performance harness:** `apps/benchmark` — a `--profile full` A/B on the **POST JSON** scenario
  (which the `wrk` suite drives via the Node server) and `bench:validate` parity; optionally a
  body-read micro-bench for per-chunk allocation.
- **Public API / types / dependencies:** none.
