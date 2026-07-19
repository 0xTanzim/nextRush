# Middleware Deep Review — `@nextrush/body-parser`  - 19-jul-2026

> Read-only engineering audit. Scope: the body-parser middleware package only. Runtime, core
> hot-path, and router audits already exist in `/report/` and are treated as prior art (their
> findings — lazy `ctx.raw`/`ctx.state`/`ctx.signal`, event-listener body drain, `compose`
> dispatch — are referenced, not re-litigated here).
>
> Evidence base: full package source (`packages/middleware/body-parser/src/**`), the Node
> body pipeline (`packages/adapters/node/src/{context,body-source}.ts`), the runtime body
> abstraction (`packages/runtime/src/body-source.ts`), the `BodySource` contract
> (`packages/types/src/runtime.ts`), and the benchmark suite (`apps/benchmark`).
>
> **Benchmark caveat (stated up front, per the suite's own rule):** all numbers below come
> from the `quick` profile — single run, 64 connections, 10s, Node v26.4.0, i5-8300H,
> `cpuPinning off`. The harness explicitly marks this **NOT publishable** (no variance). They
> are used here only as *directional* correlation for code-level findings, never as proof of a
> specific percentage. Every finding also stands on implementation + HTTP + runtime evidence
> independent of the numbers.

---

## Executive Summary

`@nextrush/body-parser` is a clean, modular, security-conscious buffering body parser. The code
shape is exemplary (every file well under the 300-line cap, one responsibility each), the
prototype-pollution defenses are real, and the content-type fast paths are thoughtfully built.
It is faster than Express and Koa on the POST path and correct for the common case.

The audit nonetheless surfaces **one correctness/security-grade defect and one throughput
pattern that together explain why body parsing is NextRush's weakest hot path relative to its
peers.**

The single most important benchmark fact:

| Scenario | NextRush | Fastify | Hono | Raw Node |
|---|---|---|---|---|
| Hello World | **31,810 (🥇)** | 31,628 | 27,609 | 30,746 |
| POST JSON | **17,364 (4th of the fast group)** | 18,408 | **19,041** | 22,457 |
| Drop hello→POST | **−45.4%** | −41.8% | −31.1% | −26.9% |

NextRush is the *fastest* framework on Hello World and drops to *behind Hono and Fastify* the
moment a JSON body is parsed. Its overhead-over-raw grows from −3.5% (Hello World, i.e. faster
than raw) to **+22.7%** (POST) — the largest body-path regression of the fast group. The body
parser is where the lead is surrendered.

Headline findings:

| ID | Severity | Title |
|----|----------|-------|
| **BP-A** | **P1 (correctness + security)** | Configured parser `limit` never reaches the stream reader — sub-1MB limits give no incremental protection; >1MB limits are silently capped at 1MB with a misleading error |
| **BP-B** | **P1 (architecture)** | Buffer-everything model with the streaming limit enforced one layer down at a fixed 1MB — the documented "streaming size validation" no longer exists in the parser |
| **BP-C** | **P1 (throughput)** | POST hot-path per-request cost (allocation + promises + decode + second graph walk) is the measured gap vs Hono/Fastify |
| **BP-D** | **P2 (throughput/alloc)** | `checkJsonDepth` runs a full second graph traversal + 2 array allocations on *every* JSON request, including the 45-byte hot path |
| **BP-E** | **P2 (throughput)** | Combined `bodyParser()` duplicates method + content-type detection with each sub-parser it delegates to |
| **BP-F** | **P3 (alloc)** | `NodeBodySource` is allocated eagerly for every POST/PUT/PATCH even when no parser reads it, against the adapter's own lazy-field pattern |
| **BP-G** | **P3 (throughput)** | Node UTF-8 decode goes through `TextDecoder` when the bytes are already a `Buffer` (native `toString('utf8')` fast path unused) |
| **BP-H** | **P3 (HTTP correctness)** | `BODYLESS_METHODS` (parser) and `METHODS_WITHOUT_BODY` (runtime) disagree on DELETE and TRACE — a DELETE body is read by the adapter but never parsed |
| **BP-I** | **P4 (docs/security-doc)** | `ARCHITECTURE.md` + `README` describe a streaming `reader.ts` that no longer exists and misstate where the DoS size limit is enforced |
| **BP-J** | **P4 (maintainability)** | `createNodeBodySource()` is dead code; the decoupled `BodyParserBodySource` interface can silently drift from the real `BodySource` contract |

**Bottom line:** BP-A should be fixed first (it is a real limit-enforcement defect, not a
micro-optimization). BP-C/BP-D/BP-E are the throughput levers that would close most of the gap
to Hono/Fastify on the POST path. Nothing here requires abandoning the buffering model, which
is the correct default for JSON.

---

## Middleware Architecture Overview

**Primary responsibility.** Read a request body, decode/parse it according to Content-Type, and
assign the result to `ctx.body` (and optionally `ctx.rawBody`). Reject bodies that are too
large, malformed, or hostile (deep nesting, parameter flooding, prototype-pollution keys).

**Package shape** (`packages/middleware/body-parser/src`):

```
index.ts            Barrel — public surface only
types.ts            BodyParserContext, BodyParserBodySource, option interfaces
constants.ts        Limits, content-type tables, BODYLESS_METHODS, FORBIDDEN_KEYS, PATTERNS
errors.ts           BodyParserError + Errors factory (status/code/expose)
parsers/
  combined.ts       bodyParser() — content-type router over the four parsers
  json.ts           json()  — readBody → decode → JSON.parse → strict + depth check
  urlencoded.ts     urlencoded() — readBody → decode → parseUrlEncoded
  text.ts           text()  — readBody → decode(charset)
  raw.ts            raw()   — readBody → toRawBody
  reader.ts         readBody() — the single choke point that calls ctx.bodySource.buffer()
utils/
  buffer.ts         bufferToString (cached TextDecoder), concatBuffers, toRawBody
  url-decode.ts     parseUrlEncoded, setNestedValue (proto-pollution guards)
  limit.ts          parseLimit ('1mb'→bytes), formatBytes
  content-type.ts   getContentType, matchContentType, isJsonContentType, charset helpers
```

**Supported HTTP methods.** Parses POST/PUT/PATCH. Skips GET/HEAD/DELETE/OPTIONS via
`BODYLESS_METHODS`. (See BP-H — this set diverges from the adapter's.)

**Supported content types.** JSON (`application/json`, `*+json`), URL-encoded
(`application/x-www-form-urlencoded`), text (`text/*`), raw (`application/octet-stream`).
`multipart/*` is explicitly rejected with a 415 and a pointer to `@nextrush/multipart`.

**Lifecycle position.** Application middleware (`~99%` extension type), typically attached
per-route (`router.post('/users', json(), handler)`) or globally. It runs *after* routing has
selected the handler chain and *before* the route handler. It is opt-in — the framework never
parses a body on its own.

**Upstream dependency.** `ctx.bodySource` — the cross-runtime `BodySource` supplied by the
adapter. On Node this is `NodeBodySource` (or the `EmptyBodySource` singleton). This is the
critical coupling: **body-parser owns *what to do with* the bytes; the adapter owns *how the
bytes are read and size-limited*.** The seam between those two is where BP-A lives.

**Downstream dependency.** The route handler and any later middleware read `ctx.body` /
`ctx.rawBody`. `ctx.body` is a plain field (default `undefined`), not a getter — there is no
hidden lazy-parse, and no framework code reads the body except this package.

---

## Middleware Lifecycle Analysis

Tracing a `POST /users` with `Content-Type: application/json` through `json()`:

```
Adapter (per request, in NodeContext constructor)
  └─ new NodeBodySource(req)            ← eager, no options → adapter limit fixed at 1MB (BP-F, BP-A)

json() middleware invoked
  1. BODYLESS_METHODS.has('POST')?      → no        (Set.has, O(1))
  2. ctx.body !== undefined?            → skip if already parsed
  3. getContentType(ctx.headers)        → header lookup
  4. isJsonContentType(ct)              → regex test (fast path, no alloc)
  5. readBody(ctx, limitBytes):
       a. pre-check Content-Length vs limitBytes   → sync 413 if oversized (uses PARSER limit ✓)
       b. await ctx.bodySource.buffer()            → drains stream, enforces ADAPTER 1MB limit (BP-A)
       c. post-check uint8Array.length > limitBytes → 413 (uses PARSER limit, but AFTER buffering)
  6. rawBody? toRawBody(buffer)          → zero-copy Buffer view (only if opted in)
  7. buffer.length === 0? next()
  8. verify?                            → optional callback
  9. bufferToString(buffer)             → TextDecoder.decode → new string  (BP-G)
 10. JSON.parse(str, reviver)           → parsed object
 11. strict? typeof check
 12. checkJsonDepth(parsed, 64)         → SECOND full graph walk + 2 array allocs (BP-D)
 13. ctx.body = parsed
 14. await next()
```

Every stage 1–4 and 6–13 is per-request. Stages that are pure overhead relative to `raw-node`
(which does `req.on('data')` + `JSON.parse`): the `NodeBodySource` object, the extra Promise
layer in `readBody`, the content-type checks, and — uniquely — `checkJsonDepth`'s second walk.

**Registration-time vs request-time split (good).** `json(options)` pre-computes `limitBytes`,
the `types` array, and the `useSimpleCheck` flag *once* at registration. The returned closure
captures them. No option parsing happens per request. This is correct and matches the
middleware philosophy.

---

## Pipeline Construction Review

**Individual parsers are flat.** `json()`/`urlencoded()`/`text()`/`raw()` each return a single
`async (ctx, next) => …` closure created once. There is no per-request wrapper allocation, no
nested dispatch, no composition cost. This is as flat as a middleware can be, and the benchmark
server correctly uses `json()` directly.

**The combined parser adds a dispatch layer (BP-E).** `bodyParser()` builds a router that, per
request, detects the content type and then delegates to a *pre-created* sub-parser. The
sub-parsers are built once at registration (good), but the delegation re-runs detection that the
combined parser already did (see Execution Pipeline Review). Because `bodyParser()` is the
README's "recommended" entry point, this duplicated detection is on the path most users will
actually take, even though the benchmark avoids it.

**No compiled/flattened pipeline.** Each parser is an independent middleware in the `compose`
chain. That is idiomatic for a Koa-style pipeline and appropriate here — there is no case for
"compiling" a single body parser. The one flattening opportunity is internal to `bodyParser()`
(BP-E), not across the middleware chain.

---

## Execution Pipeline Review

**Short-circuiting is correct and early.** All four parsers check, in order, (1) bodyless
method, (2) already-parsed body, (3) content-type match — and call `next()` without reading the
body if any fails. A JSON parser attached to a route that receives a form POST does no body read.
This satisfies the "early short-circuit over unnecessary work" principle.

**Duplicate work in the combined parser (BP-E).**
- *Current situation:* `combined.ts` runs `BODYLESS_METHODS.has(method)`, `getContentType()`,
  and `matchContentType(ct, jsonTypes)`; on a match it calls `jsonParser(ctx)`, which *again*
  runs `BODYLESS_METHODS.has(method)`, `ctx.body !== undefined`, `getContentType()`, and
  `isJsonContentType(ct)`/`matchContentType()`.
- *Impact:* header lookup ×2, content-type parse/match ×2, method check ×2 per request through
  `bodyParser()`. `getContentType` is cheap but `matchContentType` allocates (`slice`, `trim`,
  `toLowerCase`) on the non-fast-path.
- *Root cause:* the combined parser reuses the full public sub-parser as its worker, so the
  sub-parser cannot assume routing was already done.
- *Proposed optimization:* give each parser an internal `parseResolved(ctx, contentType)` core
  that skips re-detection; `bodyParser()` calls the core after it has routed, the public
  `json()` wrapper does detection then calls the core. One detection per request.
- *Expected benefit:* removes one header lookup + one content-type match per combined-parser
  request. Small but on the recommended path.
- *Risk:* low — internal refactor, public behavior unchanged. *Validation:* POST-JSON benchmark
  with `bodyParser()` (not `json()`) before/after; unit tests already cover routing.

**No repeated parse/serialize elsewhere.** The body is read exactly once (`_cachedBuffer` in the
source guarantees idempotency), decoded once, parsed once. No duplicate framework-level read
exists — `core` and the adapter never call `bodySource.*` except the constructor.

---

## Request Processing Review

**Processing strategy: eager, buffer-everything.** `readBody` awaits `ctx.bodySource.buffer()`,
which fully materializes the body into a single `Uint8Array` before any parsing begins. This is
correct and unavoidable for JSON and URL-encoded (both need the whole body), and it is the right
default for a general parser. It is documented as streaming, which it is not (BP-B, BP-I).

**The limit-propagation defect (BP-A) — the central request-processing finding.**

- *Current situation:* three size checks exist, at two layers, against two different limits:
  1. `reader.ts` pre-check: `contentLength > limit` → `entityTooLarge` — uses the **parser's**
     configured limit. Correct for honest Content-Length.
  2. `NodeBodySource.buffer()` incremental check: `totalLength > this.options.limit` +
     `req.destroy()` — uses the **adapter's** limit, which is `DEFAULT_BODY_LIMIT` (1MB) because
     `NodeContext` constructs `new NodeBodySource(req)` **with no options**. The parser's limit
     is never passed here.
  3. `reader.ts` post-check: `uint8Array.length > limit` → `entityTooLargeStreaming` — parser's
     limit, but only *after* the full buffer is in memory.
- *Impact — two distinct failure modes:*
  - **`limit` > 1MB is silently broken.** `json({ limit: '5mb' })` on a chunked 2MB upload:
    pre-check passes (2MB < 5MB), then `NodeBodySource.buffer()` destroys the socket at 1MB. The
    error is caught in `readBody` and re-thrown as `entityTooLargeStreaming(5MB)` — a message
    that says "exceeds 5242880 byte limit" for a request that actually died at 1MB. A legitimate,
    correctly-configured request is rejected with a misleading diagnostic.
  - **`limit` < 1MB gives no incremental protection.** `json({ limit: '10kb' })` on a chunked
    body with no/lying Content-Length: the pre-check can't fire, `NodeBodySource.buffer()`
    happily buffers up to the adapter's 1MB before returning, and only then does the post-check
    reject at 10kb. An attacker forces ~100× the configured limit into memory per request before
    rejection. The "streaming size validation" the docs promise for this endpoint does not exist
    at the configured limit.
- *Runtime evidence:* `NodeContext` ctor `this.bodySource = … new NodeBodySource(req)` (no
  options); `NodeBodySource` `options.limit = options.limit ?? DEFAULT_BODY_LIMIT` (1MB);
  `readBody` calls `bodySource.buffer()` with no argument; `buffer()` has no `limit` parameter.
- *HTTP evidence:* RFC 9110 §8.6 (Content-Length) — the honest-CL path is fine; the hazard is
  chunked / absent / lying Content-Length, exactly the case incremental enforcement exists for.
- *Proposed optimization:* propagate the parser's limit to the read. Minimal, contract-preserving
  option: extend `BodySource.buffer(limit?: number)` (and the runtime `AbstractBodySource` /
  `NodeBodySource` implementations) so `readBody(ctx, limit)` calls `bodySource.buffer(limit)`.
  The adapter then enforces the *parser's* limit incrementally, `req.destroy()` fires at the real
  configured threshold, and `reader.ts`'s post-check becomes belt-and-suspenders. Map the
  adapter's `PayloadTooLargeError`/`BodyTooLargeError` to the parser's error carrying the
  *actual* limit that fired.
- *Expected benefit:* correct enforcement of both >1MB and <1MB limits; bounded memory under
  attack; honest error messages. This is a correctness + DoS-hardening fix, not a perf change.
- *Risk:* medium — `BodySource` is a cross-runtime contract implemented by node/bun/deno/edge;
  all implementations and the conformance suite must move together. Behavior changes are
  strictly toward correctness (previously-broken large limits start working; small limits start
  protecting). *Validation:* new tests for (a) 2MB body under `limit:'5mb'` succeeds, (b) chunked
  body under `limit:'10kb'` rejected at ~10kb not ~1MB (assert peak buffered bytes), across all
  adapters via the conformance suite.

**Ownership of parsed data (good).** `ctx.body` is written once and owned by the parser; the raw
bytes are exposed as a zero-copy `Buffer` view only when `rawBody` is opted in.

**Lazy-processing opportunities.** Reading is already lazy relative to method/content-type
(nothing is read unless the type matches). The decode and depth-walk are the eager steps that
can be trimmed (BP-D, BP-G).

---

## Response Processing Review

Body-parser performs **no response processing** — it does not serialize, compress, set response
headers, or touch the response body. This is architecturally correct: a request-body parser
should not participate in the response lifecycle. There is therefore no duplicate serialization,
no duplicate compression, and no response mutation to audit in this package. (Response
serialization lives in `NodeContext.json()`, reviewed in the core hot-path audit, not here.)

The only response-adjacent behavior is error propagation: a `BodyParserError` thrown during
parsing carries `status`, `code`, and `expose`, and is surfaced through the framework's error
handler — correct separation (the parser signals; the framework responds).

---

## Streaming & Backpressure Analysis

**There is no request-side streaming in the parser (BP-B).** Every parser consumes the fully
materialized buffer. This is the correct and deliberate choice for JSON/urlencoded, but it means:

- Large bodies are fully resident: raw bytes + decoded string + parsed object can coexist (~2–3×
  the body size in peak memory for JSON).
- There is no streaming-transform path (hash-as-you-go, tee-to-disk) through body-parser; a user
  who needs that must bypass it and use `ctx.bodySource.stream()` directly.
- The "streaming" described in the docs refers to the *adapter's* internal drain, not anything
  the parser exposes or controls.

**Backpressure is handled correctly at the layer that owns it — the adapter, not the parser.**
`NodeBodySource.buffer()` reads via `req.on('data')` with a single-settle guard and explicit
`cleanup()` of `data`/`end`/`error`/`close` listeners; `req.destroy()` is called on limit breach
and on unexpected chunk types. The `WebBodySource` path uses a reader loop with incremental size
enforcement and `reader.cancel()` on breach. `EmptyBodySource` is a shared singleton.
`NodeBodySource.stream()` wraps the raw stream in a size-enforcing `Transform`. These are solid.

The gap is not *whether* backpressure/limits are handled — they are — but *which limit* is
enforced (BP-A) and the fact that the parser has surrendered all streaming control to the
adapter while the docs still claim otherwise (BP-I).

**Single-chunk optimization (good).** `concatBuffers` returns the sole chunk directly when
`chunks.length === 1`, avoiding an allocation+copy for the common small-body case; the Node
source likewise returns `Buffer.concat(chunks)` which no-ops the copy for a single chunk.

---

## HTTP Compliance Review

**Correct behaviors:**
- Content-Length pre-check yields a synchronous 413 for honestly-oversized bodies (RFC 9110 §8.6).
- `multipart/*` returns 415 with a helpful pointer rather than silently passing (good DX + honest
  content negotiation).
- JSON content-type matching accepts the `+json` structured-syntax suffix (`application/*+json`)
  per RFC 6839 — better than a naive `=== 'application/json'`.
- Charset handling normalizes and whitelists (`content-type.ts`), falling back to UTF-8 for
  unknown charsets rather than throwing.
- Empty bodies are handled per type (JSON → skip, urlencoded → `{}`, text → `''`).

**Finding BP-H — method-set divergence (DELETE / TRACE).**
- *Current situation:* body-parser's `BODYLESS_METHODS = {GET, HEAD, DELETE, OPTIONS}` while the
  runtime's `METHODS_WITHOUT_BODY = {GET, HEAD, OPTIONS, TRACE}`. The runtime set has an explicit
  comment: "DELETE is intentionally excluded — RFC 7231 §4.3.5 permits a body on DELETE; TRACE is
  included per §4.3.8 which forbids a body on TRACE."
- *Impact:* the adapter creates a real `NodeBodySource` for DELETE (it may have a body) but
  body-parser treats DELETE as bodyless and never parses it — a `DELETE` with a JSON body yields
  `ctx.body === undefined` silently. Conversely, body-parser omits TRACE from its bodyless set
  (harmless in practice because the adapter hands it an `EmptyBodySource`, but conceptually
  inconsistent).
- *Root cause:* two independently-maintained method sets in two packages, no shared source of
  truth (a consequence of body-parser's deliberate decoupling from `@nextrush/types`).
- *Proposed optimization:* align body-parser's set with the runtime's documented policy (drop
  DELETE, add TRACE) — or, if DELETE bodies should remain unparsed by policy, document the
  divergence explicitly. Prefer sharing one constant.
- *Expected benefit:* consistent, RFC-aligned method handling; DELETE-with-body becomes parseable.
- *Risk:* low; behavior change only for the rare DELETE-with-body case. *Validation:* a
  conformance test asserting DELETE-with-JSON-body is parsed identically across adapters.

**Not applicable / correctly out of scope:** Transfer-Encoding, Content-Encoding negotiation,
conditional requests, Range, and Keep-Alive are the adapter's/other middleware's concern; a body
parser correctly does not touch them. One note: body-parser does **not** inspect
`Content-Encoding` — a `gzip`-encoded request body would be parsed as raw bytes (garbage JSON).
That is standard (Express body-parser also requires an upstream `inflate`), so it is a
documentation point, not a defect.

---

## Security Review

**Strong, real defenses (understand before judging):**
- **Prototype pollution:** `parseUrlEncoded` and `setNestedValue` build results with
  `Object.create(null)` and reject `__proto__`/`constructor`/`prototype` via `FORBIDDEN_KEYS`, in
  both extended and simple modes. Verified in `url-decode.ts`.
- **Sparse-array abuse:** array indices in bracket notation are capped at `< 1000`, preventing
  `a[999999999]=x` memory blow-ups.
- **Parameter flooding:** `parameterLimit` (default 1000) → 413 `TOO_MANY_PARAMETERS`.
- **Nesting DoS:** `depth` (urlencoded, default 20) and `maxDepth` (JSON, default 64) both reject
  deep structures; the JSON checker is *iterative* (explicit stack), so it cannot itself be
  stack-overflowed by a hostile payload.
- **ReDoS:** content-type/charset/size patterns are pre-compiled and anchored; none exhibit
  catastrophic backtracking.
- **Charset injection:** whitelist + UTF-8 fallback.
- **Error hygiene:** `BodyParserError.expose` is `status < 500`, so server-side detail is not
  leaked to clients (aligns with project rule §3).

**Security-relevant findings:**
- **BP-A (repeat, security lens):** for a sub-1MB configured limit, an attacker can force up to
  the adapter's 1MB into memory per request before rejection. Multiply by concurrent connections
  and this is a memory-pressure DoS the operator *thought* they had capped at, say, 10kb. This is
  the security half of BP-A and is why it is rated P1, not a perf nicety.
- **BP-I (repeat, security-doc lens):** the threat matrix in `ARCHITECTURE.md` claims "DoS via
  Large Body → Size limits with streaming validation → `reader.ts` → limit check." An operator
  reading that believes their configured limit is enforced during streaming. It is not (BP-A).
  A security doc that overstates a mitigation is itself a risk.

**Secure-by-default posture:** defaults are conservative (JSON 1MB, urlencoded/text/raw 100KB,
strict mode on, depth capped). The disconnect is enforcement plumbing (BP-A), not the defaults.

---

## Memory & Allocation Analysis

Per POST-JSON request, allocations attributable to body-parser (beyond the unavoidable
raw-node baseline of one buffer + `JSON.parse`):

| Allocation | Where | Necessary? |
|---|---|---|
| `NodeBodySource` instance | adapter ctor, every body method | Reducible (BP-F, lazy) |
| Promise in `readBody` (async frame) | reader.ts | Inherent to async read |
| Promise + closure set in `buffer()` (settle/cleanup) | adapter | Inherent (well-managed) |
| decoded string | `bufferToString` | Inherent (JSON.parse needs a string) |
| `values` + `depths` arrays | `checkJsonDepth`, every request | **Removable for small bodies (BP-D)** |
| `toRawBody` Buffer view | only if `rawBody: true` | Opt-in, zero-copy (good) |
| content-type `slice/trim/toLowerCase` | `matchContentType` non-fast-path | Avoided on JSON fast path (good) |

**Object lifetime / GC pressure.** The parsed object and decoded string live for the request;
the raw buffer is dropped after decode (unless `rawBody`). The `checkJsonDepth` arrays are pure
short-lived garbage created on every JSON request — the cleanest allocation to eliminate on the
hot path (BP-D). The `NodeBodySource` object is short-lived but created even when unused (BP-F).

**Good allocation hygiene already present:** cached `TextDecoder` instances (`decoderCache`),
single-chunk concat short-circuit, zero-copy `toRawBody`, pre-allocated `EMPTY_BUFFER`, shared
`EmptyBodySource` singleton, and the event-listener drain (a prior runtime-audit win that avoids
async-iterator per-chunk promise allocation).

---

## V8 Runtime Analysis

**Hidden-class stability (good).** `ctx.body` is declared as a field and always transitions from
`undefined` to its parsed value — a monomorphic shape for `NodeContext`. The parser closures
capture a fixed set of primitives (`limitBytes`, `types`, `useSimpleCheck`), so their environment
is stable across calls; TurboFan can inline the hot closure.

**Polymorphism risk — `ctx.body` and parser return types.** `ctx.body` holds `object` (JSON),
`Record` (urlencoded), `string` (text), or `Buffer` (raw) depending on the parser. Any downstream
code reading `ctx.body` across mixed routes sees a polymorphic value — but that is inherent to a
multi-type parser and unbounded only if a single site mixes types; typical per-route usage is
monomorphic. No action beyond awareness.

**`checkJsonDepth` and megamorphism.** It iterates arbitrary user objects via
`Object.keys` + indexed access — inherently megamorphic on user-controlled shapes. This is the
second reason (besides allocation) to gate it out for small payloads (BP-D): it is a megamorphic
walk over untrusted shapes on the hot path.

**Decode path.** `TextDecoder.decode` is a native call with stable input types (`Uint8Array`),
so it is IC-friendly; the BP-G opportunity is not about deopt but about `Buffer.toString('utf8')`
often being a faster native path for small buffers.

**No deopt traps observed.** No `arguments` leakage, no `try/catch` around hot loops (the
`try/catch` in `json()` wraps `JSON.parse`, which is standard and not a deopt in modern V8), no
polymorphic arithmetic. The package is V8-friendly; the wins are algorithmic (fewer walks/allocs),
not deopt fixes.

---

## Framework Comparison

| Framework | Read model | Limit reaches reader? | JSON safety | POST RPS |
|---|---|---|---|---|
| **NextRush** | buffer-everything via `BodySource` | **No (BP-A)** | parse **then** iterative depth walk | 17,364 |
| Express `body-parser` | buffer via `raw-body` + `iconv-lite` | **Yes** (`raw-body` gets the limit) | parse only (no depth walk) | 12,083 |
| Fastify | content-type parser registry | **Yes** (`bodyLimit`) | `secure-json-parse` (proto-safe, single pass) | 18,408 |
| Hono | Web-native `Request.json()` | platform-enforced | V8-native parse, no JS-land walk | **19,041** |
| Koa `koa-bodyparser` | buffer via `co-body`/`raw-body` | **Yes** | parse only | 14,250 |
| Hyper Express (uWS) | `onData` streaming callbacks | streaming, per-read | user choice | n/a here |

**Where NextRush already wins:** it beats Express and Koa on POST, has a cleaner
runtime-agnostic byte layer than Express's `iconv-lite` charset zoo, and its prototype-pollution
and sparse-array defenses are stronger than Express's default `body-parser`.

**Techniques worth adopting:**
1. **Wire the configured limit to the reader (Express, Fastify, Koa all do this).** This is
   precisely BP-A. Express's `raw-body` receives the limit and enforces it incrementally; NextRush
   should do the same via `BodySource.buffer(limit)`.
2. **Single-pass safe parse (Fastify / `secure-json-parse`).** Fastify detects prototype-pollution
   *during* parsing and does not do a separate depth walk. NextRush's separate `checkJsonDepth`
   (BP-D) is the pattern to replace or gate — either fold depth tracking into a reviver/single
   pass, or short-circuit it for small payloads.
3. **Content-type parser registry (Fastify).** Not needed now, but if body-parser grows more
   types, a registry beats the hard-coded four-way `if` chain in `combined.ts` and would
   naturally remove BP-E's duplication.

**Techniques to reject (respecting NextRush's goals):**
- Do **not** adopt `iconv-lite`-style charset breadth — `TextDecoder` already covers the required
  charsets with zero dependencies, consistent with the zero-dep rule.
- Do **not** couple the Node path to a runtime-native `Request.json()` (Hono's approach) — it
  would break the adapter abstraction NextRush deliberately maintains. The lesson from Hono is
  narrower: *minimize JS-land work between bytes and `JSON.parse`* (BP-D, BP-G), not "use the
  platform object."
- Do **not** convert body-parser into a streaming parser wholesale (uWS style) — buffering is the
  right default for JSON. Expose streaming as an escape hatch, keep buffering as the default.

---

## Architectural Opportunities

Separated from implementation optimizations, the architectural questions:

- **Should the limit live in the parser or the adapter?** Today it is split, incoherently
  (BP-A). The clean architecture: the *parser* owns the policy (the configured limit) and passes
  it to the *adapter*, which owns the mechanism (incremental enforcement + `destroy`). This keeps
  the adapter runtime-specific and the policy in user-facing middleware. Implement via a
  `buffer(limit?)` contract addition.
- **Should `bodySource` be lazy?** Yes (BP-F). It already fits the adapter's established lazy
  pattern (`_raw`, `_state`, `signal`). A `get bodySource()` that constructs on first read makes
  POST routes without a parser allocation-free and costs nothing for routes with one.
- **Can two layers become one for the depth check?** Yes (BP-D): depth validation can be folded
  into the parse pass or gated by size, removing a whole traversal of user data.
- **Should the combined parser share a detection core?** Yes (BP-E): one detection per request.
- **Is the decoupled `BodyParserContext`/`BodyParserBodySource` interface worth its drift risk?**
  It buys independence from `@nextrush/types` but duplicates the `BodySource` contract (BP-J). If
  BP-A adds `buffer(limit?)`, the minimal interface must track it or the fix won't type-check
  against the real source. Consider re-coupling to the canonical type, or add a contract test that
  asserts structural compatibility.

None of these require abandoning the buffering model or the cross-runtime `BodySource` seam — they
tighten it.

---

## Prioritized Optimization Roadmap

Ordered by the prompt's principle (delete/​correct work first, then reduce allocation, then
micro-opts), with severity:

1. **BP-A — Propagate the configured limit to the reader (P1, correctness + security).** Add
   `buffer(limit?: number)` to the `BodySource` contract; `readBody` passes the parser limit;
   adapters enforce it incrementally; map errors to the real limit. *Biggest correctness win; no
   throughput cost.*
2. **BP-D — Gate/​fold `checkJsonDepth` (P2, throughput + alloc).** Short-circuit the walk when
   `buffer.length < maxDepth * 2` (a body that small cannot reach the depth limit), or fold depth
   tracking into the parse pass. *Removes two array allocs + a megamorphic walk from every JSON
   request, including the 45-byte benchmark payload.*
3. **BP-E — De-duplicate combined-parser detection (P2, throughput).** Internal
   `parseResolved(ctx, contentType)` core. *Removes redundant detection on the recommended path.*
4. **BP-F — Lazy `bodySource` (P3, alloc).** `get bodySource()` on `NodeContext`. *Allocation-free
   POST routes without a parser.*
5. **BP-G — Node UTF-8 fast path (P3, throughput).** Use `Buffer.prototype.toString('utf8')` when
   bytes are already a `Buffer` and charset is UTF-8; keep `TextDecoder` as the edge fallback.
   *Measure first — modern `TextDecoder` may match it for large buffers.*
6. **BP-H — Align method sets (P3, HTTP correctness).** One shared constant; decide DELETE/TRACE
   policy explicitly.
7. **BP-I / BP-J — Docs + dead code (P4).** Rewrite the `ARCHITECTURE.md` data-flow + threat
   matrix to the two-layer reality; fix the README streaming claim; remove
   `createNodeBodySource()`; add a `BodyParserBodySource`↔`BodySource` compatibility test.

**Do not** pursue: converting JSON/urlencoded to streaming parsers (buffering is correct);
replacing `TextDecoder` wholesale (zero-dep constraint); "compiling" the middleware chain (a
single parser gains nothing).

---

## Validation Plan

Every change is gated on before/after evidence; revert anything that does not show measurable
benefit or that regresses correctness.

**Correctness (BP-A, BP-H) — must pass before any perf work:**
- New cross-adapter conformance tests: (a) `json({limit:'5mb'})` accepts a 2MB chunked body;
  (b) `json({limit:'10kb'})` rejects a chunked body at ~10kb with **peak buffered bytes asserted
  ≤ ~limit**, not ~1MB; (c) error message/`code` reflects the limit that actually fired;
  (d) DELETE-with-JSON-body parses identically on node/bun/deno/edge.
- Run the existing 80KB `body-parser.test.ts` suite + adapter `body-source` tests unchanged
  (no regressions).

**Throughput (BP-C, BP-D, BP-E, BP-F, BP-G):**
- Primary: `apps/benchmark` **POST-JSON**, `--profile full` (5 runs, mean ± stddev, CV) with
  `cpuPinning` on — the quick single-run numbers in this report are not a valid gate.
- Baseline to beat: current NextRush 17,364; targets are Fastify (18,408) and Hono (19,041).
- Micro-benchmarks (isolate each lever): `checkJsonDepth` gated vs ungated on 45B/1KB/64KB/deep
  payloads; `bufferToString` (`TextDecoder` vs `Buffer.toString`) at the same sizes;
  `bodyParser()` combined vs `json()` direct to size BP-E.
- Allocation: `--expose-gc` heap-used-per-request delta and a heap snapshot on the POST path
  before/after BP-D and BP-F (expect fewer short-lived arrays and no `NodeBodySource` on
  parser-less POST routes).
- CPU: `node --cpu-prof` flamegraph of the POST server before/after to confirm time moves out of
  `checkJsonDepth` / content-type detection.

**Gate:** parity (`pnpm bench:validate`, byte-identical responses) must still pass; per-package
line coverage stays ≥ 90%; a full profile must show POST-JSON improvement outside the noise band
or the change is reverted.

---

## Final Engineering Recommendations

1. **Fix BP-A first.** It is the one finding that is a genuine defect rather than an
   optimization: the configured body limit does not do what operators think it does. It is both a
   correctness bug (large limits silently broken) and a DoS-hardening gap (small limits give no
   incremental protection). It also makes the security documentation honest again.
2. **Then take the three throughput levers (BP-D, BP-E, BP-G) plus BP-F.** Together they target
   the exact per-request overhead — a redundant graph walk, redundant detection, a suboptimal
   decode, and an eager allocation — that separates NextRush's POST path from Hono's and
   Fastify's. The benchmark story (fastest on Hello World, fourth on POST) says the ceiling is
   real and reachable.
3. **Keep the buffering model.** It is the correct default for JSON/urlencoded. The problem was
   never that body-parser buffers; it is that it buffers against the wrong limit and does
   avoidable work per request. Expose `ctx.bodySource.stream()` as the documented escape hatch
   for the rare streaming-transform case rather than reworking the parser.
4. **Restore doc-vs-reality (BP-I) and align the method sets (BP-H).** "Outdated documentation is
   a bug" (project rule); a stale security threat matrix is a bug with teeth.
5. **Preserve what is good.** The modular shape, prototype-pollution defenses, cached decoder,
   zero-copy `toRawBody`, single-chunk optimization, early short-circuiting, and opt-in body
   reading are all correct and should be protected by the tests that accompany the changes above.

The package is close. One correctness fix and a handful of scoped, measured trims would make
body parsing a NextRush strength instead of the one hot path where it trails the field.
