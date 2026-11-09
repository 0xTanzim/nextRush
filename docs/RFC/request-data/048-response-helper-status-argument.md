# RFC-048: Response helpers accept a status code or a response-options object

| Field | Value |
| --- | --- |
| **Status** | Approved — additive (no breaking change) |
| **RFC number** | `048` |
| **Date** | 2026-10-26 |
| **Author(s)** | NextRush maintainers |
| **Group** | `request-data` (context response surface) |
| **Packages touched** | `@nextrush/types`, `@nextrush/runtime`, `@nextrush/adapter-node`, `nextrush` (type re-export only) |
| **Framework impact** | Additive public-API change to `Context`; one documented-behavior fix (content-type precedence) |
| **Implements** | change `context-response-status-args` |

---

## 1. Summary (TL;DR)

`ctx.json`, `ctx.html` and `ctx.send` gain a second argument: a numeric status or a
`ResponseOptions` object (`{ status?, headers? }`). `ctx.status = code` keeps working unchanged. The
effective status is written back to `ctx.status`, invalid statuses fail fast, and supplied headers
merge through the existing header implementation.

## 2. Problem & Motivation

Two gaps, confirmed against source and by probe:

1. `ctx.json(data, 202)` answers **200** — the second argument is silently ignored. Sending a
   non-200 response requires a preceding `ctx.status` assignment.
2. There is no per-call way to set response headers. `Location`, `Cache-Control`, `ETag` and
   request-id headers each need a separate `ctx.set()` call before the body write.

Both cost developers a line and a mental lookup on every handler, and both put the framework behind
the response-helper contract developers arrive with. Fixing them is additive; the breaking
`ctx.status(code)` redesign is explicitly separate.

## 3. Decision Summary

| # | Decision |
| --- | --- |
| D1 | Second argument is `number \| ResponseOptions`; a number is shorthand for `{ status }`. |
| D2 | Precedence: explicit status → carried `ctx.status` → `200`. The effective status is assigned to `ctx.status`. |
| D3 | Accepted statuses are integers 200-599; anything else throws `RangeError` before serialization. |
| D4 | One resolver in `@nextrush/runtime`, called by both the Web and Node context implementations. |
| D5 | `OutgoingResponse.setBody` treats a supplied content type as a **fallback**, so an explicitly supplied `Content-Type` wins. |
| D6 | A supplied `Content-Length` is rejected with `TypeError`; the framework derives it from the body. |

## 4. Detailed Design

### 4.1 Public surface

```ts
interface ResponseOptions {
  status?: number;
  headers?: Record<string, string | number | string[]>;
}

ctx.json(data: unknown, statusOrOptions?: number | ResponseOptions): void;
ctx.html(content: string, statusOrOptions?: number | ResponseOptions): void;
ctx.send(body: ResponseBody, statusOrOptions?: number | ResponseOptions): void;
```

`ResponseHeaders` mirrors `ctx.set()`, which is the framework's existing header-write contract. A DOM
`HeadersInit` is deliberately not used: it appears nowhere in the repository, the base tsconfig
compiles without the DOM lib, and accepting a `Headers` instance normalizes casing and collapses
multi-value fields — the two properties this policy must preserve.

### 4.2 Status semantics

1. No argument → carried `ctx.status`, default 200.
2. Number → that value for this response.
3. Object → `options.status` when present.
4. The explicit value overrides a prior `ctx.status` assignment and is assigned back to `ctx.status`.
5. Validation runs before serialization: integers 200-599 only, else `RangeError`.
6. `204`, `304`, HEAD and 1xx responses stay bodyless, as today.
7. A call on an already-committed response changes neither the response nor `ctx.status`.

The 200-599 range is the intersection every adapter can answer. The adapters disagree today: the Web
builder rejects 1xx at construction and platform `Response` allows 200-599, while Node `writeHead`
accepts 100-999. Validating the carried `ctx.status` assignment path is explicitly out of scope.

### 4.3 Header merge

Supplied headers merge through the existing `HeaderList.set` semantics, so the rule is implemented
once for both adapter families:

- an ordinary field replaces a previously recorded value in place (case-insensitive);
- `Set-Cookie` accumulates, so cookies set by middleware survive;
- an array replaces the field, then contributes each element;
- every field passes `assertHeaderSafe`;
- a supplied `Content-Type` overrides the helper's automatic media type;
- a supplied `Content-Length` throws, because the framework computes it at flush and a disagreeing
  value truncates or over-reads the response.

### 4.4 Why content type becomes a fallback

`OutgoingResponse.setBody(body, contentType)` currently overwrites the recorded content type. A probe
shows `ctx.set('Content-Type', 'text/plain')` followed by `ctx.json()` answering `application/json`,
which already contradicts the `web-adapters` requirement that an explicit content type wins. Making
the argument a fallback fixes that, and lets the options path apply headers **before** the body write
for every body kind — including streams, which commit their head during the call.

## 5. Alternatives Rejected

| Alternative | Why rejected |
| --- | --- |
| Numeric-only argument | No extension point; the approved scope includes headers. |
| Options-only argument | Verbose for the common case; inconsistent with `redirect(url, status)`. |
| Chained `ctx.status(code)` | Breaking redesign, tracked separately. |
| Accept 100-999 | Node would answer what the Web adapters cannot — a parity failure. |
| Pass `Content-Length` through | Silent truncation; adapter-divergent failure mode. |
| Re-apply `Content-Type` after the body write | Needs stream detection and breaks for streams. |
| Validate inside `WebResponseBuilder` only | `NodeContext` would diverge on exactly the inputs this policy exists to make predictable. |

## 6. Impact

- `Context` gains two optional parameters and `@nextrush/types` gains two type exports (surface-lock
  updated).
- `@nextrush/runtime` gains the resolver, and `setBody`'s content-type assignment becomes a fallback.
- `@nextrush/adapter-node` routes its three helpers through the shared resolver.
- Conformance gains the cross-adapter scenarios; docs and migration tables are updated.
- No new dependencies, no DOM lib, no protocol change, no persisted state.

## 7. Migration

Additive minor release. Existing single-argument calls are unchanged. The only behavior change —
an explicitly set `Content-Type` now winning over the body method's default — is the documented
behavior and is covered by a regression test. Rollback is a revert.

## 8. Verification

- Unit tests for the resolver and the content-type fallback.
- Conformance scenarios on every runnable driver: numeric and options status, precedence,
  persistence, rejection, header merge, body suppression, post-commit no-op.
- Node-specific tests for `send(obj, options)` delegation and `send(stream, { status: 204 })`.
- Gates: workspace `typecheck`, `lint`, per-package tests, `check:coverage`.

## 9. Open Items

- Final public name of the options type (`ResponseOptions`) is confirmed at implementation review;
  the shape and semantics are settled.
