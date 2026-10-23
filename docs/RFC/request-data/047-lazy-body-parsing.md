# RFC-047: `@nextrush/body-parser` — opt-in lazy body parsing

| Field                | Value                                                           |
| -------------------- | --------------------------------------------------------------- |
| **Status**           | `Draft`                                                         |
| **RFC number**       | `047`                                                           |
| **Date**             | `2026-10-23`                                                    |
| **Author(s)**        | NextRush performance campaign                                   |
| **Group**            | `request-data`                                                  |
| **Packages touched** | `@nextrush/body-parser`, `@nextrush/runtime`, `@nextrush/types` |
| **Framework impact** | `Additive, non-breaking`                                        |
| **Supersedes**       | `—`                                                             |
| **Superseded by**    | `—`                                                             |
| **Related**          | `RFC-017`, `RFC-029`, campaign §13–§15                          |

---

## Progress Tracker

[░░░░░░░░░░░░░░░░░░░░] 0% — 0 / 4 phases complete

| Phase                | Status         | Scope                                                       |
| -------------------- | -------------- | ----------------------------------------------------------- |
| 1 — contract + types | ⬜ not started | `BodyParserOptions.lazy`, `ctx.readBody()`, capability flag |
| 2 — implementation   | ⬜ not started | reader memoisation, abort wiring, error mapping             |
| 3 — verification     | ⬜ not started | mode-matrix tests, conformance both modes, cross-runtime    |
| 4 — docs + release   | ⬜ not started | README/ARCHITECTURE, migration note, benchmark disclosure   |

---

## 0. Revision History

| Date       | Author               | Change                                                |
| ---------- | -------------------- | ----------------------------------------------------- |
| 2026-10-23 | performance campaign | Initial draft from the candidate #10/#11 measurements |

---

## 1. Summary

Add an opt-in `lazy: true` mode to `@nextrush/body-parser`. In that mode the middleware
performs **detection only** — method, existing body, media type, configured parsers — and
defers the byte read, the size guard, `verify`, and the parse to an explicit
`await ctx.readBody()`. The default (`lazy: false`) keeps today's eager behaviour exactly.

The motivation is measured but conditional: on Bun, the eager parser path is **2.85 µs of the
4.78 µs** of framework JavaScript for a 1 KB JSON POST, and **62 %** of that stage is native
(`request.text()` 596 ns + `JSON.parse` 406 ns). An application whose handler never reads the
body pays that cost for nothing. Lazy mode lets such an application stop paying it, at the
price of a contract change that must be explicit and opted into.

## 1a. Terminology

| Term               | Meaning                                                                           |
| ------------------ | --------------------------------------------------------------------------------- |
| **Eager**          | Today's behaviour: the middleware reads and parses before `next()` runs           |
| **Lazy**           | `lazy: true`: the middleware detects only; a read happens at `ctx.readBody()`     |
| **Detection**      | Method check, `ctx.body !== undefined` check, media-type match, parser selection  |
| **Read**           | Byte acquisition from `ctx.bodySource`, size enforcement, `verify`, decode, parse |
| **Unread request** | A request whose handler and middlewares never call `ctx.readBody()`               |

## 2. Decision Summary

1. `bodyParser({ lazy: true })` and `json({ lazy: true })` (plus the other parser factories)
   accept the flag. Absent → current behaviour, byte for byte.
2. `ctx.readBody(): Promise<unknown>` is added to **both** modes. Eager mode resolves
   immediately from the already-parsed value; lazy mode performs the deferred work once.
3. In lazy mode, reading `ctx.body` before a successful `readBody()` **throws** rather than
   returning `undefined`. Silent `undefined` is the failure mode this RFC exists to prevent.
4. Nothing else triggers a read. Not `next()`, not `getResponse()`, not the runner's
   finalisation. A body that is never read is never parsed.
5. The adapter's transport-level cap (`Bun.serve({ maxRequestBodySize })` and its equivalents)
   is unconditional and unaffected. Only the parser-level limit becomes deferred.

## 2a. Decision Drivers

- **Measured cost.** 2.85 µs per JSON POST is 12–14 % of a 20.8–26.0 µs wire request on this
  bench. Applications that ignore the body (auth-only endpoints, webhook signature endpoints
  that read raw bytes, health/metrics POSTs) pay it entirely.
- **Eager parsing is a contract, not an optimisation.** It guarantees a malformed body is
  rejected _before_ any handler or middleware side effect. Changing the default would be a
  silent behaviour change for every existing application — rejected in §10.
- **DX first.** An opt-in flag with a loud, teaching failure beats a default that is faster in
  a benchmark and surprising in production.

## 3. Problem & Motivation

A JSON POST on Bun spends ~4.78 µs of framework JavaScript. The parser stage is 2.85 µs:
`WebBodySource` construction 319 ns, `request.text()` 596 ns, `JSON.parse` 406 ns,
`checkJsonDepth` 146 ns, glue ~378 ns. None of it is waste for a handler that reads the body.

It is entirely waste for a handler that does not. The benchmark handler — the shape the
campaign measures — answers `{"ok":true}` and never touches `ctx.body`. Making the parse lazy
was identified as the single largest removable stage in the request path, and was deliberately
**not** shipped as a default change in the campaign (§14.3) because:

- a 400 for malformed JSON currently arrives before the handler runs; lazy parsing moves it
  into the handler's call stack, so an auth middleware that answers 401 first would win where
  400 wins today;
- a 413 for an oversized body likewise becomes conditional on the body being read;
- a handler that ignores the body would silently stop observing an error it can observe today.

Each of those is a defensible trade for an application that opts in, and an unacceptable one to
impose. Hence a flag.

## 4. Goals & Non-Goals

**Goals**

- Remove the entire parser stage for requests whose body is never read, in a mode the
  application explicitly selects.
- Keep the eager path bit-identical, including error precedence, when `lazy` is absent.
- Keep handler code portable between modes for the common case (`await ctx.readBody()`).
- Preserve single consumption, caching, `rawBody`, `verify`, size limits, depth guard, abort
  propagation and timeout behaviour inside lazy mode.

**Non-Goals**

- Making lazy the default. Not in this RFC, not gated to a major here.
- Parsing in the background or after the handler returns. The body is read on demand or not
  at all.
- Streaming/incremental JSON parsing. Out of scope; `checkJsonDepth` remains a whole-body walk.
- Extending lazy semantics to multipart file uploads, where the bytes are the payload and the
  read is the point.

## 5. Impact

| Area                     | Impact                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Public API               | Additive: one option, one context method, one capability flag                         |
| Behaviour (default)      | None                                                                                  |
| Behaviour (`lazy: true`) | Error timing, error precedence, and `ctx.body` availability change — §12              |
| Conformance              | New mode matrix; both modes must satisfy the same response contract for read requests |
| Performance              | Removes ~2.85 µs for unread requests; adds one function call for read requests        |

## 6. Proposed Solution

```ts
// Opt in at registration. Everything else about the call is unchanged.
app.use(bodyParser({ lazy: true }));

// Handler code that works in BOTH modes:
app.post('/hooks', async (ctx) => {
  const payload = await ctx.readBody<{ id: string }>();
  return ctx.json({ received: payload.id });
});
```

In lazy mode the middleware becomes detection plus a capability installation:

```ts
// shape, not final code
return (async (ctx, next, prechecked = false) => {
  if (!prechecked && !detect(ctx)) {
    if (next) await next();
    return;
  }
  installLazyReader(ctx, config); // sets the deferred reader, returns immediately
  if (next) await next();
}) as unknown as Middleware;
```

`installLazyReader` records the config on the context and defines a one-shot reader that:

1. returns the cached value if a previous read completed;
2. returns the in-flight promise if a read is already running (concurrent callers share it);
3. otherwise performs `read` → `verify` → `decode` → parse → depth guard → assign `ctx.body`,
   memoise, and resolve.

### 6a. Trade-offs

| Gain                                                    | Cost                                                            |
| ------------------------------------------------------- | --------------------------------------------------------------- |
| ~2.85 µs removed for unread requests                    | Error timing becomes handler-dependent                          |
| Auth/rejection paths stop paying for a body they reject | 401 can precede 400 where it does not today                     |
| Signature endpoints can read raw bytes only when needed | `ctx.rawBody` is only populated after `readBody()`              |
| No default change                                       | A new public method and option to document, teach, and maintain |

## 7. Architecture

Lazy parsing does **not** add a stage; it removes the read from the middleware stage and moves
it into the handler's call stack. The middleware keeps detection, which is what decides whether
a parser is responsible for this request at all.

```
eager:  ctx → detection → read+limit+verify+parse → next() → handler
lazy:   ctx → detection → install reader → next() → handler
                                                     └─ await ctx.readBody() → read+limit+verify+parse
```

The reader is the same code the eager path uses, called from a different place. No second
implementation of the size guard, the depth guard, `verify`, or decode is introduced.

### 7a. Architecture Invariants

1. **One read per request.** `ctx.bodySource` is single-consumption; the reader memoises and is
   idempotent even under concurrent callers.
2. **Eager mode never calls the lazy path.** `lazy` is read once at registration.
3. **The transport cap is not deferred.** `maxRequestBodySize` (and Node/Deno equivalents) stay
   unconditional, so an attacker cannot make the framework accept an unbounded body by choosing
   a handler that ignores it.
4. **No parse after the response.** The reader is not invoked by finalisation, so a handler that
   answers without reading cannot produce a body error after its response was committed.
5. **The deadline still bounds everything.** A lazy read happens inside the dispatch, so the
   existing `dispatchWithTimeout` race covers it with no new timer.

## 8. Detailed Design

### 8.1 Trigger

Only `ctx.readBody()`. Not `ctx.body` (it throws in lazy mode when unparsed), not `next()`, not
`getResponse()`, not the runner.

```ts
// types
interface BodyCapableContext {
  /** Parsed body. Throws in lazy mode until `readBody()` resolves. */
  readonly body: unknown;
  /** Read the body, parsing it once and caching the result. Idempotent. */
  readBody<T = unknown>(): Promise<T>;
}
```

### 8.2 Handler never reads the body

No bytes acquired, no size check, no `verify`, no parse, no depth walk, no `ctx.body`. The
response is whatever the handler produced. A malformed body, an oversized body, or a body with a
failing signature produces **no error in this mode** — this is the documented bargain, and the
loud argument for not making it the default.

### 8.3 Malformed JSON

`JSON.parse` failure inside `readBody()` throws the same `BodyParserError` (`INVALID_JSON`) the
eager path throws, through the same error envelope. The difference is the stack: the rejection
lands at the `await ctx.readBody()` call site, so a `try/catch` in the handler can observe it,
and an uncaught rejection reaches the app's error handler exactly as an uncaught throw from a
handler does.

### 8.4 Size limit

Order inside the reader is unchanged from today: `content-length` check first (no bytes read),
then `readTextIfProvenWithin(limit)`, then a streamed count for undeclared lengths. `413` with
the same envelope. A request that is never read is never limited by the parser — see invariant 3
for why that is not a hole.

### 8.5 Caching and single consumption

```ts
// one slot per request, three states: unset | in-flight promise | value
let cached:
  { state: 'pending'; promise: Promise<unknown> } | { state: 'done'; value: unknown } | undefined;
```

- second call after `done` → returns `value` synchronously-resolved (no re-parse);
- second call while `pending` → returns the same promise (the body source is never read twice);
- `ctx.body` is assigned once, on success, and keeps object identity for later readers;
- a rejected read caches the rejection for the request's lifetime, so a retry cannot re-read a
  consumed stream and cannot produce a different error.

### 8.6 Raw body and signature verification

`rawBody: true` and `verify` keep their eager _order_ (bytes → `verify` → decode → parse), they
are only deferred. `ctx.rawBody` is populated at the same moment `ctx.body` is. A signature
middleware must call `await ctx.readBody()` before reading `ctx.rawBody`; in lazy mode
`ctx.rawBody` is `undefined` until then, which is the same fail-fast rule as `ctx.body`.

### 8.7 Middleware ordering and early responses

- Middleware registered **before** `bodyParser()` cannot see a parsed body in either mode unless
  it reads it itself; in lazy mode the detection has not run yet, so `ctx.readBody()` must be
  the consumer's own call. Documented as: _lazy mode makes every body consumer an explicit one._
- Middleware registered after it must `await ctx.readBody()` instead of reading `ctx.body`. This
  is the single migration obligation.
- An early response (401/403/404) before any read yields no body error. Recorded as an
  intentional precedence change in §12.

### 8.8 Cancellation and timeout

- The reader accepts the request's abort signal: an aborted read rejects with `AbortError`, so a
  handler awaiting a dead body does not hang.
- The read is inside the dispatch, so `dispatchWithTimeout` still bounds it; a handler that
  ignores the abort still gets the existing 504 path and connection release.
- `ctx.triggerTimeout()` semantics are untouched: the abort is a signal, not a response writer.

### 8.9 Cross-runtime requirements

The reader is written against `ctx.bodySource` only — no runtime-specific path. Requirements per
runtime, all already satisfied by the body-source abstraction:

| Runtime           | Requirement                                                                    |
| ----------------- | ------------------------------------------------------------------------------ |
| Bun               | `readTextIfProvenWithin` proven-length fast path; `Request.signal` abort       |
| Node              | `IncomingMessage` source honours the same limit and abort; no `Buffer` in core |
| Deno              | proven-length fast path, abort via `AbortSignal`                               |
| Edge / serverless | unknown length is normal; streamed count path only; memory bound respected     |

No runtime may buffer the whole body when the application never reads it: the reader is not
called, and no adapter may pre-read the body at context construction. `WebContextBase` currently
constructs `WebBodySource` (319 ns) without reading — that stays; the header reads it performs
are required for `bodyLength` and the settle-window decision.

## 9. Alternatives

### A. Parse after the handler returns, before finalisation

Keeps eager error semantics for read-less handlers (400 still returned) while letting the
handler run first. Rejected: a handler's side effects would already have happened before a 400
was written, so the client sees an error for work that was performed. Worse than both modes.

### B. `ctx.body` becomes a `Promise`

`await ctx.body` reads naturally and needs no new method. Rejected: it makes `ctx.body` a
different type in different modes (portable handler code breaks), and every existing handler
that reads `ctx.body` synchronously would silently compare a promise.

### C. Lazy by default

Rejected for this RFC. It is the only way to remove the stage for applications that never ask,
but it changes observable error behaviour for every existing user without their consent. A
future major may revisit it with the migration window that a major allows.

### D. A separate `bodyParserLazy()` factory

Rejected: two middlewares to document, two code paths to keep in sync, and no way to express
"lazy for JSON, eager for form". One option is smaller.

## 10. Rejected Ideas

- **Skip parsing when the handler's source looks like it does not read `ctx.body`** (static
  analysis at registration). Rejected: unsound across middleware, closures and dynamic access —
  and it would make behaviour depend on a heuristic.
- **Parse in a microtask after `next()` resolves.** Rejected: races the handler's own reads and
  produces non-deterministic error timing.
- **Defer only `JSON.parse`, keep the read.** The read is 596 ns of the 2.85 µs but the guard,
  decode and source construction stay; the stage is not removed, only trimmed.
- **Lower `maxDepth` or drop `checkJsonDepth`** to cheapen the eager path. Rejected: the guard is
  the only protection against a stack-depth DoS, and it costs 146 ns.

## 11. Risks

| Risk                                                                    | Likelihood     | Mitigation                                                                                                              |
| ----------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Users enable `lazy` and lose 400/413 without noticing                   | Medium         | `ctx.body` throws when unparsed; docs state the bargain in the option's TSDoc; dev-mode startup log                     |
| A downstream middleware reads `ctx.body` and gets a throw in production | Medium         | The throw names `readBody()` and the middleware is on the stack trace; migration guide lists every first-party consumer |
| Concurrent reads double-consume the stream                              | Low            | Single-slot memoisation with a pending state; dedicated test with two concurrent `readBody()` calls                     |
| Lazy read escapes the deadline                                          | Low            | Read is inside the dispatch; test with a never-ending body and a short timeout                                          |
| Benchmark claims compare lazy-without-read against eager-with-read      | High (process) | Benchmarks must label the workload difference; §14 forbids a parser-speed claim from it                                 |

## 12. Backward Compatibility

- `lazy` absent or `false` → today's code path, today's timing, today's error precedence.
- New `ctx.readBody()` exists in both modes; eager implementations resolve from `ctx.body`.
- New `lazy: true` differences, all documented in the option's TSDoc and the migration guide:
  1. malformed body → error at `readBody()`, not before the handler;
  2. oversized body → 413 only if read;
  3. `ctx.rawBody` → only after `readBody()`;
  4. `ctx.body` read before `readBody()` → throws (fail fast, not `undefined`);
  5. a middleware that answers early can preempt a body error.
- No migration is required for applications that do not set the flag.

## 13. Cross-Cutting Concerns

- **Security:** the transport cap is not deferred (invariant 3). The parser's limit and depth
  guard still apply to every read. No new input path is trusted.
- **Observability:** lazy mode should log once at startup that it is active, and may emit a
  counter for "body never read" so operators can see how much they are saving.
- **Docs:** README section "When to use lazy", `ARCHITECTURE.md` sequence diagram for both modes,
  migration guide entry, and a note on every first-party middleware that reads `ctx.body`.
- **Testing:** mode matrix (eager/lazy × read/unread × valid/malformed/oversized/deep/aborted),
  plus conformance in both modes, plus the cross-runtime suite.

## 14. Success Metrics

| Metric                         | Target                          | How                                            |
| ------------------------------ | ------------------------------- | ---------------------------------------------- |
| Unread-request parser cost     | → 0 ns in the parser stage      | in-process attribution, same harness as §13    |
| Read-request regression        | ≤ 50 ns (one extra call + slot) | in-process, paired                             |
| Error parity for read requests | identical status/body/envelope  | conformance matrix, both modes                 |
| Wire CPU/req, unread workload  | measured, paired, order-flipped | `ab2.mjs`, labelled as an unread-body workload |
| Eager path                     | zero change                     | same-window control vs the current bundle      |

A benchmark comparing lazy-NextRush-without-read to Hono-`c.req.json()` is **not** a parser
comparison. Results must state the workload on both sides; the honest pairing is
lazy-without-read vs a Hono handler that also never reads the body.

## 15. Phased Implementation

1. **Contract + types** — `lazy` option, `readBody()` on the context type, capability flag,
   TSDoc stating the five behaviour differences. Tests first.
2. **Implementation** — deferred reader, memoisation, abort wiring, error mapping; eager mode
   untouched (guarded by the existing 320-test suite).
3. **Verification** — mode matrix, conformance both modes, Bun/Node/Deno/edge, in-process
   attribution, one paired wire run.
4. **Docs + release** — README, ARCHITECTURE diagram, migration note, benchmark disclosure.

## 16. Rollback Plan

The flag is opt-in and additive. Rollback is: remove `lazy: true` at the registration site. No
data, no stored state, no migration depends on it. If phase 3 finds a semantic gap that cannot be
documented safely, the option ships marked experimental or does not ship; the eager path is never
touched.

## 17. Future Work

- Expose `ctx.bodyRead` as a boolean so observability can count unread requests without a hook.
- Evaluate lazy-by-default behind the next major, with a deprecation window and a codemod that
  rewrites `ctx.body` reads to `await ctx.readBody()`.
- Streaming JSON parse would remove the whole-body requirement for very large payloads; it needs
  its own RFC and a depth guard that works incrementally.

## 18. Open Questions

1. Should `lazy: true` also defer _detection_, so a request with no matching media type costs no
   header reads either? Detection is ~60–120 ns and decides who owns the request; deferring it
   would make ordering decisions handler-dependent. Leaning no.
2. Does the dev-mode "body never read" counter belong in `@nextrush/logger` or in a dedicated
   metric? Leaning a debug-level log line, no new package surface.
3. Is a per-parser `lazy` (e.g. lazy JSON, eager form) worth the API weight? Leaning no — one
   flag per `bodyParser()` call.

## 19. Decisions Log

| #   | Decision                                     | Rationale                                                        |
| --- | -------------------------------------------- | ---------------------------------------------------------------- |
| 1   | Opt-in flag, default unchanged               | Error timing is a contract; a silent change is unacceptable      |
| 2   | `ctx.readBody()` in both modes               | One handler shape that works in both                             |
| 3   | `ctx.body` throws in lazy mode when unparsed | Fail-fast teaching beats a silent `undefined`                    |
| 4   | Nothing parses implicitly                    | Any implicit trigger recreates eager semantics with worse timing |
| 5   | Transport cap stays unconditional            | Lazy mode must not widen the DoS surface                         |

## 20. References

- `report/performance/campaign-scoreboard.md` §13.2 (parser decomposition), §13.3 (rejected
  parser candidates), §14.3 (the eager-parse decision), §15 (candidate #11 attribution).
- `packages/middleware/body-parser/src/parsers/json.ts` — `json()`, `checkJsonDepth`.
- `packages/middleware/body-parser/src/parsers/reader.ts` — `readBody`, `readBodyText`.
- `packages/runtime/src/body-source.ts` — `WebBodySource`, `readTextIfProvenWithin`.
- `packages/runtime/src/web-runner.ts` — `dispatchWithTimeout`, `settleTurnsFor`.
- RFC-017 — body-source limit propagation; RFC-029 — canonical request path.
