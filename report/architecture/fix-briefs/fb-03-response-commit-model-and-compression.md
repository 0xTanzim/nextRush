# FB-03 — Eager response commit: Node and Web adapters diverge, and `@nextrush/compression` does nothing

> **RESOLVED (2026-10-19) by RFC-041.** Stage 0 landed earlier (the clean 504, the discard-once
> report). Stage 1 landed as the recorded response model: one `OutgoingResponse` per request, flushed
> once by every adapter after the chain unwinds. All three probe ids pass on Node and Bun, and
> `FB-03` is deleted from `knownFailures`. The brief is kept as the measurement record; see
> `docs/RFC/runtime-adapters/041-recorded-response-model.md` §14.1 for the gate table.

| Field | Value |
| --- | --- |
| **Severity / Priority** | Medium–High · P1 (Stage 0 now) → P1 architecture (Stage 1) |
| **Area** | `@nextrush/adapter-node` (`context.ts`), `@nextrush/runtime` (`response-builder.ts`, `web-context-base.ts`), `@nextrush/compression`, `@nextrush/timer`, `@nextrush/types` (`Context`) |
| **Depends on** | FB-01 (shared JSON serialization helper) |
| **RFC-gated** | **Stage 1 yes — RFC-041 "Recorded response model" (number reserved, not yet written).** Stage 0 no. |
| **Size** | Stage 0: S · Stage 1: L |
| **Probe ids** | `timer-header`, `server-timing-header`, `compression-gzip` (`knownFailures: FB-03`) |

## Finding

- **Current situation (measured, probes use `timer({exposeHeader:true})`, `serverTiming({exposeHeader:true})`, `compression({threshold:0})`):**

  | Behaviour | Node adapter | Bun adapter |
  | --- | --- | --- |
  | `timer` sets `X-Response-Time` after `await next()` | **header missing** | present |
  | `serverTiming` sets `Server-Timing` after `await next()` | **header missing** | present |
  | `compression` on a 20 KB JSON / text response, `Accept-Encoding: gzip` | **not compressed** | **not compressed** |

- **Root cause — two different response models behind one `Context`:**
  - **Node commits eagerly.** `NodeContext.json()` calls `res.writeHead` + `res.end` inside the handler (`adapters/node/src/context.ts:323-345`). Anything a middleware does *after* `await next()` (set a header, transform the body) is too late.
  - **Web adapters record, then materialise.** `WebResponseBuilder.json()` stores `_status/_headers/_body` and `getResponse()` builds the `Response` after the whole chain (`runtime/src/response-builder.ts:192-202`, `bun/adapter.ts:239`). Post-`next()` header writes still land.
  - The same middleware therefore behaves differently per adapter — a direct breach of ADR-0010 (identical observable behaviour). The conformance suite does not exercise middleware × adapter.
- **Why `compression` is a no-op everywhere (independent of the above):** `packages/middleware/compression/src/middleware.ts:168-184` looks for the response body in `ctx.body` — which in NextRush is the **parsed request body** (`types/src/context.ts:148`) — and in `ctx.raw.res.body`, a property Node's `ServerResponse` does not have. For a `GET` both are empty, so it returns early. For a `POST` with a parsed body it would compress the **request** body (CPU wasted) and then call `ctx.set('Content-Encoding', …)` after the response is gone. *(The POST behaviour is from code reading; not executed.)* Its unit tests pass against mock contexts that have a response `body`.
- **Docs mismatch (small):** `timer()` / `serverTiming()` default `exposeHeader` to `false`, yet the JSDoc says `app.use(serverTiming()); // Sets: Server-Timing: total;dur=…` (`timer/src/middleware.ts`). A reader following the docs gets no header on either runtime.
- **Impact:** Post-handler middleware is unreliable and adapter-dependent: timing headers, compression, ETag/conditional responses, response validation (Hono v5 ships it), RFC 9457 error mapping, `defer`/after-response work. This is the main structural gap versus Hono (`c.res`) and Elysia (`mapResponse`/`afterHandle`).
- **Benefits of today's design:** Node's immediate `res.end` is cheap and simple; one write per response.
- **Drawbacks:** No interception point; two implementations of "respond"; `ctx.responded` means different things (written vs recorded).
- **Long-term risk:** Every new response-aware feature is either Node-only or Web-only, and the 746-line `NodeContext` stays a second implementation to keep in sync.
- **Recommendation:** Make **all** adapters record the response and commit once after the middleware chain (streams commit immediately and mark the response committed). Ship compression/timer/etc. on top of that.
- **Trade-offs:** Node loses "bytes leave inside `ctx.json()`"; it still writes once, just later in the same tick. Must be proven perf-neutral with `dev-check inproc` and `bench:alloc:*`.
- **Migration difficulty:** Hard (core contract change) — hence RFC-gated.

## Reproduce

```bash
node apps/benchmark/scripts/dev-check/check.mjs probe --rt node   # KNOWN timer-header / server-timing-header / compression-gzip
node apps/benchmark/scripts/dev-check/check.mjs probe --rt bun    # KNOWN compression-gzip only
```

## Stage 0 — do now (no RFC): stop the silent failures

1. **Compression honesty.** Until Stage 1 lands: on the first response where `compression()` finds no compressible outgoing body, log **one** warning (`"@nextrush/compression: no outgoing body available; responses written with ctx.json()/send() are committed before compression runs — see RFC-041"`). Mark the package README *"Not effective for ctx.json()/send() responses until RFC-041"*. Fix `getResponseBody` so it never reads `ctx.body` (the request body) — return `null` instead of compressing input.
2. **Timer docs/default.** Decide (maintainer): either make `exposeHeader` default `true` (the name and JSDoc imply it) or fix the JSDoc and examples. Whichever is chosen, add a test through a real adapter.
3. **Parity test.** Add a conformance scenario "post-handler header write via middleware" asserting the header on every adapter. It will fail on Node today; keep it in `knownFailures: FB-03` until Stage 1.
4. **Interim for Node timer/serverTiming (optional, small):** set the header *before* `next()` when the value can be known late — not possible for duration; skip. Do not hack `res.setHeader` hooks.

## Stage 1 — RFC-041 "Recorded response model" (write the RFC first)

Decisions the RFC must make (each with a measured basis):

1. **Model:** `ctx.json/send/html/redirect/status/set` record into a per-request `ResponseRecord` (`status`, `headers`, `body`) on **every** adapter; the adapter commits once after the chain. `sendStream`, `sse`, `ndjson`, and `ctx.raw.*` writes **commit immediately** and flip `ctx.committed`.
2. **Interception API:** a documented, minimal surface for middleware after `await next()` — e.g. read-only `ctx.response` view (`status`, `headers`, `body: string | Uint8Array | ReadableStream | undefined`) plus a mutator (`ctx.response.setBody(...)`, `ctx.response.headers.set(...)`) valid until commit. Decide sync vs async commit (compression needs async: `CompressionStream` / `zlib`).
3. **`ctx.responded` semantics:** rename/split into `ctx.recorded` vs `ctx.committed` (keep `responded` as an alias of "recorded" to avoid a break).
4. **Unify contexts:** Node builds the same `ResponseRecord` and writes to `res` at commit, so `NodeContext` (746 lines) shrinks toward `WebContextBase` (349 lines) and one shared runner (FB-07) becomes possible.
5. **First consumers (acceptance of the RFC):** compression (gzip/br, `Vary`, threshold, no-transform), timer/serverTiming, ETag, response validation, RFC 9457 error mapping, `defer` after-response queue.
6. **Perf gate (RFC-040):** `dev-check inproc` regression ≤ 3 % on Node and Bun; `bench:alloc:handler` and `bench:alloc:context` no new allocations on the no-interception path (lazy record).
7. **Compat:** `@nextrush/static` writes through `ctx.raw.res` (`static/src/index.ts:239`, `send-file.ts`) — treat as a committing escape hatch; list every middleware that touches `ctx.raw` (grep `ctx.raw`) and migrate or mark as committing.
8. **Alternatives to record:** (a) keep Node eager + add an `onSend` sync hook (cannot support async compression — rejected as the end state, acceptable as a stepping stone); (b) adopt Hono's "handler returns a `Response`" model (bigger API change).

## Tests first (Stage 0)

- `packages/middleware/compression/src/__tests__/real-adapter.test.ts` (new): `serve()` on port 0, route returning 20 KB JSON; today expect **no** `Content-Encoding` plus the one-time warning; flips to gzip in Stage 1.
- Remove reliance on mock contexts that fake an outgoing `ctx.body`: add at least one test per response-aware middleware that goes through a real adapter.
- Conformance scenario from Stage 0 step 3.

## Acceptance criteria

- **Stage 0:** [ ] compression no longer reads the request body; [ ] one-time warning + README caveat; [ ] timer docs/default fixed with a real-adapter test; [ ] parity scenario added; [ ] `FB-03` stays in `knownFailures` with a note "Stage 1 pending".
- **Stage 1:** [ ] RFC-041 accepted; [ ] all three probes PASS on bun and node; [ ] `FB-03` removed from `knownFailures`; [ ] perf gate met; [ ] `NodeContext` and `WebContextBase` share the record type.

## Do NOT

- Do not bolt response interception onto Node by monkey-patching `res.write/end` (Express-style) — it breaks the lazy/streaming guarantees and the Web parity.
- Do not make `ctx.json()` async.
