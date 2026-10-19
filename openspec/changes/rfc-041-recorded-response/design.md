# Design

## Context

See `proposal.md` — Why, and RFC-041 §3, §7, §8 for the analysis. Four facts from source constrain
the approach:

- `packages/adapters/node/src/context.ts` writes the socket from inside each response method:
  `json()` calls `res.writeHead(...)` then `res.end(...)`; `send()`/`html()`/`redirect()` set headers
  and end; `sendStream()` pipes. `isCommitted()` is `_responded || _res.headersSent`.
- `packages/runtime/src/response-builder.ts` already records status/headers/body for the Web family,
  and `packages/runtime/src/web-runner.ts` materialises the `Response` after the chain.
- `packages/middleware/compression/src/middleware.ts` reaches the outgoing response only through
  `ctx.raw.res.getHeader` — the marker that is absent on Web, so it warns and returns.
- `packages/middleware/static/src` writes `ctx.raw.res` directly (`removeHeader`, `end`, `pipe`).
  That is the escape hatch that must keep working unchanged.

The Node context is the only adapter whose response model has to move.

## Goals / Non-Goals

**Goals**

- One recorded outgoing response, one flush, on every adapter.
- Post-handler header writes and body rewrites observable on every adapter.
- Zero body copies when no post-handler middleware can rewrite the response, with a counter proving it.
- Streaming and the static middleware's direct writes untouched.

**Non-Goals**

- Changing the `Context` method set. `json`/`send`/`html`/`redirect`/`set` keep their signatures.
- Making streams rewritable. A started stream is committed.
- Removing `ctx.raw.res` on Node. The escape hatch stays, documented as immediate-commit.
- Changing error bodies, status codes, or the serialization guarantee.

## Decisions

### D1 — One `OutgoingResponse` record owned by the runtime, not by each adapter

A single class in `@nextrush/runtime` holds `status`, an ordered case-insensitive header map with
multi-value support, the serialized body (`string | Uint8Array | null`), and `committed`. Both
adapter families construct it. The Node context writes it instead of the socket; the Web builder
writes it instead of its private fields.

*Alternative considered:* keep two implementations and align their behaviour by test. Rejected — that
is exactly today's divergence, and it is what the change exists to remove. One implementation means a
fix in one place reaches both families.

*Alternative considered:* a `Map<string, string | string[]>` header record. Rejected — `set-cookie`
accumulation and case-insensitive lookup are already specified, and `Headers` on the Web side already
implements them. The record wraps the existing semantics rather than re-deriving them.

### D2 — Header writes from middleware need no new public API; body rewrites use an internal accessor

`ctx.set()` already writes the response header map, so the documented post-handler pattern —

```ts
app.use(async (ctx, next) => {
  await next();
  ctx.set('x-response-time', `${elapsed}ms`);
});
```

— needs no accessor at all. It works because the record is still mutable at that point.

Reading or replacing the *body* after the handler is the part that needs reach, and the only shipped
consumer is in-repo (`@nextrush/compression`). That path uses a symbol-keyed property exported from
`@nextrush/types` and marked `@internal` (no semver guarantee, not part of the documented surface):

```ts
import { OUTGOING_RESPONSE } from '@nextrush/types';
const outgoing = ctx[OUTGOING_RESPONSE];
```

The symbol is a real export, so the `public-surface-lock` test records it and any change to it is a
deliberate, reviewed edit rather than an accident.

*Alternative considered:* a public `ctx.outgoing` property. Rejected for this change — it enlarges the
public surface for a capability that in-repo middleware can reach internally, and the public-surface
commitment (AGENTS.md §1) argues for the smaller surface. It can graduate to public later if a
third-party middleware needs it.

*Alternative considered:* `ctx.raw.res` shims on Node that expose `getHeader`/`setHeader` over the
record. Rejected — it preserves the adapter-specific branch the change removes, and it would make
`ctx.raw.res` mean two different things depending on when it is read.

### D3 — The flush is a method on the record, invoked by the adapter runner

`flush()` materialises a `Response` (Web) or performs `writeHead` + `write` + `end` (Node). It is
idempotent: a second call is a no-op, which is what makes the "flush exactly once" requirement
checkable.

Node's `writeHead` merges the record's headers with any header the compat bridge wrote through
`ctx.raw.res.setHeader`, preserving the existing `writeHead`-precedence behaviour the current code
documents.

### D4 — The Node buffer is allocated only when a post-handler rewrite is possible

The runner knows the middleware stack. A chain with no middleware that can run after the handler
writes the serialized body straight to `res.end(body)` — no intermediate buffer, counter stays 0. A
chain with a post-handler middleware buffers the body so a rewrite can replace it, counter increments
once.

*Alternative considered:* always buffer, then measure. Rejected — RFC-041 §14 criterion 2 asks for
zero copies on the untouched path, and always-buffer makes that unachievable by construction.

*Alternative considered:* detect "did a middleware actually rewrite" and copy lazily. Rejected — the
body has to exist somewhere before the rewrite, so a lazy copy would have to re-serialize from a
retained reference, which is the same memory with more branches.

### D5 — `ctx.responded` keeps its meaning: the record is committed

`responded` today means "a response has been committed". Under the record model the handler commits
the record, and the adapter flushes it later, so `responded` stays true from the moment the handler
writes. That keeps the double-response guard, the error-path check, and every middleware that reads
`ctx.responded` working unchanged.

The timeout rule from the previous change is preserved by the same field: a handler that committed a
response outlives the timeout, and the adapter still flushes it.

### D6 — Streaming commits immediately and marks the record non-rewritable

`sendStream`, SSE and NDJSON set `committed` and hand the stream to the adapter at once. A
post-handler write then hits the "already flushed" path and is reported once, matching the interim
contract rather than throwing.

The static middleware's `ctx.raw.res` writes bypass the record entirely on Node and are documented as
an immediate-commit escape hatch. On Web, `ctx.raw.res` is already `undefined`, so the static
middleware's Node branch is already adapter-specific; this change does not widen it.

### D7 — The gate runs before the model is adopted, on both runtimes

Order of work: record + counter first, measurement second, adoption third. Concretely:

1. Land the record and the Node flush behind the existing behaviour being preserved (tests green).
2. Run RFC-041 §14: `dev-check` on Bun and Node for `inproc.nextrush.vs_hono` against the committed
   maximums, and the copy counter for the untouched path.
3. Only then delete `FB-03` from `knownFailures` and the capability flag from the driver contract.

If the measurement regresses `inproc` beyond the committed maximum on either runtime, the change is
parked with the numbers recorded — RFC-041 §14 is the authority, not the design.

### D8 — Conformance loses the flag, gains a body-rewrite scenario

`honorsPostHandlerHeaderWrite` is removed from `ConformanceDriver`, from all five drivers, and from
scenario #29, which asserts the header is present unconditionally. A new scenario asserts a
post-handler body replacement lands with a matching `Content-Length`. Both are required to fail if any
adapter regresses to the old model.

## Risks / Trade-offs

- **Node buffer cost on large bodies** → mitigated by D4 (no buffer without a post-handler
  middleware) and by the existing in-memory cap compression already enforces. A body above the cap is
  not rewritten and is streamed as today.
- **A middleware holds the record past the request** → the record is per-request and must not be
  retained; the same rule that already applies to `ctx`. Documented in the record's JSDoc.
- **`ctx.raw.res` semantics change on Node** → a `getHeader` after the handler now reads the record
  rather than the socket. Documented, and the compat bridge's `on-headers` position is preserved
  (D3). The static middleware's direct writes are unaffected.
- **Header order** → the record preserves insertion order; `writeHead` receives it in that order. No
  consumer may rely on order over HTTP/2, and no scenario asserts it.
- **A custom error handler that writes after the flush** → it already has to check `ctx.responded`;
  the record makes that check correct on Node too, where today `responded` is set before the write
  and the socket state is the real boundary.
- **Coverage** → the Node context is the largest edit; every response method's tests must be re-run
  against the record. The change is not mergeable on partial coverage of those branches.

## Migration Plan

1. Land the record and the Node flush with `FB-03` still exempt, so the gate's state does not move
   ahead of the measurement.
2. Run and record the RFC-041 §14 gate.
3. Delete `FB-03`, delete the driver flag, update the two middleware READMEs and the adapter docs.
4. Rollback: the record and the flush are separable — reverting the flush commit restores the
   previous write path while leaving the record type in place (unused), so the revert is one commit
   and does not require a second refactor.

## Open Questions

- Whether the Node write-through path (D4) needs a second counter for bytes written versus bytes
  buffered. It is useful for the gate's narrative but not required by it; it can be added when the
  gate runs if the copy count alone is ambiguous.
