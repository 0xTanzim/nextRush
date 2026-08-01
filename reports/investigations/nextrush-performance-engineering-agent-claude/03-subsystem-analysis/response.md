# Subsystem — Response

**Playbook phase:** Part 4 §4.16, analysed with the §4.1–4.10 methodology
**Package:** `@nextrush/adapter-node` — `packages/adapters/node/src/context.ts`
(`json`, `send`, `html`, `redirect`)
**Owns finding:** **P-06 (Medium)** — `send()` type-dispatch ordering and function shape
**Notable:** this subsystem is the likely explanation for NextRush's concurrency-1 wins

---

## 1. Purpose (§4.1)

Write status, headers and body to the platform response object, choosing a strategy per body type
(string, Buffer, Uint8Array, ArrayBuffer, Node stream, Web `ReadableStream`, object, other) while
guaranteeing that a response is written exactly once and always carries a Content-Type.

## 2. Architecture (§4.2)

Three entry points on `NodeContext`, all guarded by a single `_responded` flag plus
`res.headersSent`:

| Method | Path |
| ------ | ---- |
| `json(data)` | `JSON.stringify` → **one** `writeHead(status, {Content-Type, Content-Length})` → `end(body)` |
| `send(data)` | Linear `typeof`/`instanceof` chain over 9 body kinds, each branch setting headers then `end()`; objects delegate to `json()` |
| `html`, `redirect` | Thin specialisations |

## 3. Request lifecycle participation (§4.3)

Exactly one of these runs per request. In the benchmark, `ctx.json()` serves nine of ten scenarios
and `ctx.send()` with no argument serves `empty-response`.

## 4. Performance characteristics (§4.4)

### 4.1 Serialization-and-write marginal cost — at parity

| Isolation | NextRush | Fastify | Raw Node.js | Verdict |
| --------- | -------- | ------- | ----------- | ------- |
| Small object write (`hello − empty floor`) | **4.28 µs** | 4.37 µs | 5.61 µs | **Best of the three** |
| User object write (`json-serialize − floor`) | 4.93 µs | 4.79 µs | 5.63 µs | Parity |
| Large payload write (`large-json − hello`) | 17.51 µs | 17.80 µs | 17.90 µs | **Parity / marginally best** |

The response write path is **not** a bottleneck. On the small-object write NextRush is marginally
*ahead* of both Fastify and raw Node.

### 4.2 Why this subsystem probably explains the c=1 wins

At concurrency 1 the measurement is latency-bound (~36–39 µs round trip dominated by loopback and
syscalls), so it is sensitive to **how many socket writes** a response produces rather than to
JavaScript cost. `ctx.json` performs exactly one `writeHead` followed by one `end(body)` — the shipped
HP-14 trim replaced two `setHeader` calls with a single outgoing-header-map write. The raw-node
baseline's `sendJson` does `writeHead(status, JSON_HEADERS)` then `end(JSON.stringify(data))`, which
is structurally the same but computes no `Content-Length`, so Node must choose a framing strategy
itself.

This is **Moderate evidence, not Confirmed.** The correlation is consistent (NextRush wins c=1 on
exactly the JSON-returning scenarios and loses `empty-response`, where there is no body to frame),
but confirming it requires packet-level or `strace` observation of write counts per response, which
no artifact provides. Logged as OQ-2 in `appendix/open-questions.md`.

The practical consequence matters more than the mechanism: **the response path is already efficient,
so the flat concurrency scaling cannot be blamed on it.** That isolation is what makes the Context
floor (P-01) the prime suspect.

## 5. Runtime behaviour (§4.5)

`json()` per request: one `JSON.stringify` string, one `Buffer.byteLength` scan, one `String()`
conversion of the length, one header object literal, one `writeHead`, one `end`. Minimal and
correct. The source documents precisely why one `writeHead` is behaviour-equivalent to two
`setHeader` calls (Node merges, giving `writeHead` precedence, so middleware-set headers including
accumulated `Set-Cookie` survive while `json()`'s Content-Type still overrides).

`send()` per request: a linear chain of up to nine type tests. Order encountered:

```
1. null/undefined      → end()                      ← empty-response exits here (cheap)
2. typeof string       → text/plain + Content-Length
3. Buffer.isBuffer
4. instanceof Uint8Array
5. instanceof ArrayBuffer
6. typeof .pipe === 'function'      (Node stream)
7. .getReader === 'function' && 'locked' in …  (Web stream)
8. typeof data === 'object'         → delegates to json()   ← 8th of 9
9. default                          → String(data)
```

## 6. Bottleneck analysis (§4.6)

| Observation | Category | Severity |
| ----------- | -------- | -------- |
| `ctx.send(obj)` traverses **seven** failed type tests before reaching the object branch, including two `instanceof` checks and two property probes on a plain object | CPU / branch cost | **Medium (P-06)** — affects only applications that call `send()` with an object rather than `json()`; the benchmark does not, so this is **unmeasured** |
| `send()` is a 142-line function with cyclomatic complexity 22 and cognitive complexity 37 | Code shape → indirectly perf | Medium — well past the project's own ~40–50-line function guidance and a barrier to future optimisation of this path |
| `'locked' in (data)` uses the `in` operator on a caller-supplied object | CPU | Low — `in` walks the prototype chain; reachable only after six earlier tests fail |
| Two `res.setHeader` calls in the string branch where `json()` uses one `writeHead` | Minor inconsistency | Low — the HP-14 trim was applied to `json()` but not to `send()`'s string branch |

**Explicitly not bottlenecks:**
- `json()` itself. Already trimmed; measured at or better than parity.
- Streaming branches. They correctly handle backpressure (`res.write` return value →
  `waitForDrainOrDisconnect`), client disconnect (`res.on('close')` → `reader.cancel()` /
  `stream.destroy()`), and `StreamAbortedError`. Not on any measured hot path, and the correctness
  here is worth more than any micro-optimisation.
- `shouldSuppressBody()` for HEAD/204. Necessary correctness.

## 7. Root cause candidates (§4.7)

**For P-06 — data structure / dispatch strategy.** A linear `if` chain orders its tests by
specificity rather than by frequency. Plain objects are overwhelmingly the most common `send()`
argument in real applications and are tested eighth. The chain also cannot be reordered naively,
because the tests are not mutually exclusive: a `Buffer` *is* a `Uint8Array` *is* an `object`, so
`typeof data === 'object'` must remain **after** every binary and stream test or Buffers would be
JSON-serialised. This constraint is why the fix is a two-level dispatch rather than a reorder.

**Confidence: Confirmed** for the ordering and the function shape (read in source). **Hypothesis**
for the runtime cost — no benchmark scenario calls `send()` with an object, so the impact is
unquantified. It is reported at Medium severity on that basis, not higher.

## 8. Optimisation opportunities (§4.8)

1. **Two-level dispatch in `send()`.** Branch first on `typeof data`:
   `'string'` → the string branch; `'object'` → a nested chain that tests binary and stream kinds
   before falling through to `json()`; `null`/`undefined` → `end()`; else → `String(data)`. Object
   sends then pay one `typeof` plus the binary/stream tests, and string sends pay one `typeof`.
   Preserves the mutual-exclusion ordering constraint exactly.
2. **Split `send()` into per-kind helpers** (`sendString`, `sendBinary`, `sendNodeStream`,
   `sendWebStream`). Brings a 142-line/complexity-22 function within the project's shape guidance,
   makes each branch independently testable, and makes the dispatch table explicit. Primarily a
   maintainability change with a modest inlining benefit — V8 is more likely to inline a short
   dispatcher than a 142-line polymorphic function.
3. **Apply the HP-14 single-`writeHead` trim to `send()`'s string branch** for consistency with
   `json()`.

None of these are priorities. They are listed so that when `send()` is next touched — and item 2 is
warranted on code-shape grounds regardless — the performance-relevant ordering is fixed at the same
time.

## 9. Edge cases reviewed (§4.9)

| Case | Behaviour | Preserve? |
| ---- | --------- | --------- |
| Double response | `_responded` flag + `res.headersSent` guard → second call is a no-op | Yes |
| HEAD / 204 / 304 | `shouldSuppressBody()` → headers written, body omitted, Content-Length retained | Yes |
| `Buffer` passed to `send` | Must hit the Buffer branch, **not** the object branch | **Yes — constrains any reordering** |
| `Uint8Array` non-Buffer | Wrapped via `Buffer.from(buffer, byteOffset, byteLength)` — no copy | Yes |
| Node stream errors | 500 JSON if headers not sent, else `res.destroy(err)` | Yes |
| Web stream backpressure | `res.write` false → `await waitForDrainOrDisconnect(res)` | Yes |
| Client disconnect mid-stream | `res.on('close')` cancels the reader / destroys the source | Yes |
| `StreamAbortedError` after disconnect | Swallowed deliberately — nothing to salvage | Yes |
| Middleware-set headers before `json()` | Survive, because Node merges `writeHead` over prior `setHeader` values | **Yes — documented reason the HP-14 trim is safe** |

## 10. Investigation summary (§4.10)

| | |
| --- | --- |
| **Finding** | The response write path is at or better than parity and is **not** a bottleneck — it is also the most plausible explanation for NextRush's concurrency-1 wins. One residual: **P-06**, `send()`'s object branch sits eighth of nine in a linear type chain, in a 142-line function with cyclomatic complexity 22. |
| **Evidence** | Small-object write 4.28 µs vs Fastify 4.37 / raw Node 5.61; large-payload write 17.51 vs 17.80 / 17.90; `json()` verified as a single `writeHead` + `end` (HP-14) at HEAD; `send()` dispatch order and metrics read at HEAD |
| **Root cause** | P-06: linear dispatch ordered by specificity rather than frequency, with a hard mutual-exclusion constraint (`Buffer` is an `object`) preventing a naive reorder |
| **Runtime impact** | Serialization/write: none. P-06: unmeasured — no scenario exercises `send(object)` |
| **Performance impact** | No projected benchmark movement. P-06 is a latent cost for applications using `send()` over `json()` |
| **Recommendation** | **Do not optimise `json()`.** Fix `send()`'s dispatch when the function is next touched for code-shape reasons; add a `send(object)` benchmark scenario so the cost stops being invisible |
| **Trade-offs** | Two-level dispatch is marginally less linear to read; splitting into helpers spreads the logic across more functions. Both are net positives given the current complexity metrics. |
| **Priority** | **Medium** (P-06); the subsystem overall is **no action** |
| **Confidence** | Confirmed (parity, and P-06's structure) / Moderate evidence (c=1 write-path explanation, OQ-2) / Hypothesis (P-06 magnitude) |
| **Validation** | `06-validation-regression.md` V-06 — requires a new benchmark scenario before the fix can be validated at all |

**Cross-references:** `serializer.md` (the `JSON.stringify` cost itself), `context.md` (the
lifecycle that finalises the response), `appendix/open-questions.md` OQ-2.
