# Subsystem — Body Parser

**Playbook phase:** Part 4 §4.17, analysed with the §4.1–4.10 methodology
**Package:** `@nextrush/body-parser` — `packages/middleware/body-parser/src/{parsers/reader,parsers/json,utils/buffer}.ts`
plus `@nextrush/adapter-node` — `packages/adapters/node/src/body-source.ts`
**Verdict:** **No optimisation recommended.** At parity with Fastify. Documented to establish that
the POST JSON benchmark gap is *not* a body-parser defect.

---

## 1. Purpose (§4.1)

Read the request body across runtimes, enforce a size limit *while* reading rather than after, and
decode it to the requested representation (JSON, form, text, raw bytes). It exists so that a handler
receives `ctx.body` without knowing whether the underlying runtime provides a Node stream, a Web
`ReadableStream`, or a pre-buffered payload.

## 2. Architecture (§4.2)

```
json() middleware
  └─ readBody(ctx, limit)
       ├─ Content-Length pre-check                 ← synchronous rejection before reading
       ├─ await ctx.bodySource.buffer(limit)       ← runtime-neutral; adapter enforces the limit incrementally
       ├─ post-read size check                     ← for chunked transfers with no Content-Length
       └─ error normalisation → BodyParserError
  └─ decode (TextDecoder) → JSON.parse
```

The `bodySource` indirection is the cross-runtime seam. The Node implementation reads via event
listeners rather than async iteration (a shipped trim), and a **singleton empty body source** is used
when no body exists, so GET requests allocate nothing for this subsystem.

## 3. Request lifecycle participation (§4.3)

**Conditional, not universal.** In the benchmark, `json()` is attached to the single POST route only
(`router.post('/users', json(), handler)`), not globally. This is the correct shape and matches how
Fastify/Hono are configured in the same harness — verified in `apps/benchmark/servers/nextrush-v3.js`.

Consequence: this subsystem contributes **zero** cost to nine of ten scenarios and cannot be a factor
in the fixed-floor finding.

## 4. Performance characteristics (§4.4)

Marginal cost of body reading plus `JSON.parse` (`post-json µs/req − that framework's own
hello-world`):

| | Marginal cost | vs Fastify |
| --- | --- | --- |
| **NextRush v3** | **21.26 µs** | **−0.09 µs (parity)** |
| Fastify | 21.35 µs | — |
| Hono | 17.52 µs | −3.83 µs |
| Raw Node.js | 11.36 µs | −9.99 µs |
| Koa | 21.42 µs | +0.07 µs |
| Express | 21.95 µs | +0.60 µs |

**NextRush is at parity with Fastify and marginally ahead of Koa and Express.** POST JSON also has one
of NextRush's two *healthy* concurrency-scaling ratios (×1.24 from 1 → 64 conn, versus ×1.01 on
route-params) — because per-request cost here is dominated by body I/O event handling rather than by
the framework pipeline, which is itself corroborating evidence that the pipeline is the flat-scaling
culprit and the parser is not.

**On the −28.9% gap versus raw Node:** raw Node's benchmark server does `body += chunk` string
concatenation with a byte counter and a single `JSON.parse`, with no content-type negotiation, no
charset handling, no `TextDecoder`, no error taxonomy, and no cross-runtime abstraction. It is 9.99 µs
cheaper than *every* real framework in the suite, all of which cluster at 17.5–22 µs. That is the
price of a correct parser, not a NextRush defect, and **no** framework in the benchmark is closer to
raw Node than Hono at −6.2 µs.

## 5. Runtime behaviour (§4.5)

Per POST request: one `bodySource.buffer(limit)` await, one `Uint8Array` from the adapter, one
`TextDecoder` decode (with a cached decoder per encoding — `decoderFor`), one `JSON.parse`, one result
object. Per GET request: **nothing** — the middleware is not mounted on GET routes, and even if it
were, `ctx.bodySource` would be the shared singleton empty source.

`readBody` allocates `new Uint8Array(0)` only in the no-body-source branch, which modern adapters never
take.

## 6. Bottleneck analysis (§4.6)

No measured bottleneck. Items reviewed and cleared:

| Reviewed | Finding |
| -------- | ------- |
| Buffer concatenation strategy | `concatBuffers` performs a single-pass allocation of the final size rather than repeated growth |
| Decoder allocation | `decoderFor` caches by encoding — no per-request `new TextDecoder()` |
| Limit enforcement | Incremental during read (RFC 017), *and* a Content-Length pre-check that rejects synchronously before any read begins — the pre-check is a genuine optimisation, not just a safety feature: oversized requests cost almost nothing |
| Error handling on the happy path | The `try/catch` wraps the read; error construction and the four-way `err.name` dispatch occur only on failure. Zero happy-path cost. |
| `await` count | One, on the actual I/O. Not a gratuitous async frame. |
| GET-path cost | Zero — conditional mounting plus singleton empty source |

One observation recorded without a recommendation: `readBody` has cognitive complexity 21 for 48
lines, concentrated entirely in the error-normalisation cascade. It is a readability observation, not
a runtime one, and it is out of this investigation's scope (§1.4 excludes style unless it affects
runtime).

## 7. Root cause candidates (§4.7)

Not applicable. The POST JSON gap versus raw Node is explained by the raw baseline doing materially
less work, and the gap versus Fastify is 0.09 µs — inside noise.

## 8. Optimisation opportunities (§4.8)

**None recommended.** Optimising a subsystem already at parity with the reference implementation
would violate playbook §1.6 (measure before optimising) and §2.3 (prioritise by impact).

Considered and rejected:

| Idea | Why rejected |
| ---- | ------------ |
| Skip `TextDecoder` and use `Buffer.toString('utf8')` on Node | Would fork the cross-runtime code path for a subsystem already at parity. Violates the runtime-independence rule for no measured gain. |
| Streaming/incremental JSON parse | Only pays off for very large bodies; the benchmark payload is a few dozen bytes, and V8's `JSON.parse` on a complete string is hard to beat. No evidence of a large-body problem exists — there is no large-POST scenario at all. |
| Reuse a per-request byte buffer pool | Introduces lifetime hazards (a handler retaining `ctx.body` after the response) for sub-microsecond gain. |

**One genuine gap, in coverage rather than code:** there is no benchmark scenario for a *large* POST
body (the POST payload is a few dozen bytes). Buffer-growth and copy behaviour under 1 MB payloads is
therefore entirely unmeasured. Recommended as a benchmark-suite addition, not as an optimisation —
see `07-optimization-roadmap.md` Phase 4.

## 9. Edge cases reviewed (§4.9)

| Case | Behaviour |
| ---- | --------- |
| No body source | Returns `new Uint8Array(0)` |
| Content-Length exceeds limit | `Errors.entityTooLarge` thrown **before** reading — cheap rejection |
| Chunked with no Content-Length, exceeds limit | Adapter enforces incrementally; post-read check as backstop |
| Body already consumed | `BodyConsumedError` → normalised to `bodyReadError` |
| Malformed JSON | `JSON.parse` throws → mapped to a 400-class `BodyParserError` |
| Deeply nested JSON | A depth limit exists (`json-depth-default.test.ts`) — a ReDoS/stack-exhaustion guard |
| Empty body with `Content-Type: application/json` | Handled by the JSON parser's own branch |
| GET request with the middleware mounted globally | Not the benchmark's shape; would short-circuit on the empty body source |

## 10. Investigation summary (§4.10)

| | |
| --- | --- |
| **Finding** | No performance defect. Body parsing is at parity with Fastify (21.26 vs 21.35 µs marginal) and ahead of Koa and Express. The −28.9% POST JSON gap versus raw Node is the cost of a correct, limit-enforcing, cross-runtime parser and is shared by every framework in the suite. |
| **Evidence** | POST JSON marginal cost 21.26 µs vs Fastify 21.35 / Koa 21.42 / Express 21.95 / Hono 17.52 / raw Node 11.36; healthy ×1.24 concurrency scaling; conditional mounting verified in the benchmark server; single-pass `concatBuffers`, cached `decoderFor`, and synchronous Content-Length pre-check read at HEAD |
| **Root cause** | n/a |
| **Runtime impact** | Zero on nine of ten scenarios (conditionally mounted) |
| **Performance impact** | None available to capture |
| **Recommendation** | **Do not optimise.** Add a large-payload POST scenario to the benchmark suite so buffer-growth behaviour stops being unmeasured. |
| **Trade-offs** | n/a |
| **Priority** | None for code; **Low** for the benchmark-coverage gap |
| **Confidence** | Confirmed (measured parity + source read) |
| **Validation** | Covered by V-01's regression sweep — POST JSON must not regress when P-01 lands, since both touch the adapter |

**Cross-references:** `request.md` (`ctx.bodySource`), `01-benchmark-analysis.md` §5 (negative
findings), `07-optimization-roadmap.md` Phase 4.
