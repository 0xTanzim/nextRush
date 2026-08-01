# Subsystem — Serializer

**Playbook phase:** Part 4 §4.18, analysed with the §4.1–4.10 methodology
**Package:** `@nextrush/adapter-node` — `packages/adapters/node/src/context.ts` (`json`)
**Verdict:** **No optimisation recommended now.** At parity with Fastify and raw Node. One
forward-looking opportunity documented and deliberately deferred.

---

## 1. Purpose (§4.1)

Convert a handler's return value into response bytes with a correct `Content-Type` and
`Content-Length`. NextRush has no dedicated serializer package: serialization is `JSON.stringify`
invoked from `NodeContext.json()`.

## 2. Architecture (§4.2)

There is no serialization abstraction — deliberately. `ctx.json(data)` performs:

```ts
const json = JSON.stringify(data);
res.writeHead(this.status, {
  'Content-Type': 'application/json; charset=utf-8',
  'Content-Length': String(Buffer.byteLength(json)),
});
res.end(json);            // or end() when shouldSuppressBody()
```

No schema registry, no compiled serializer, no reflection, no per-type cache. The absence of an
abstraction is worth recording explicitly, because it is the reason there is nothing to optimise: the
framework adds no layer over V8's own serializer.

## 3. Request lifecycle participation (§4.3)

Once per JSON response — nine of ten benchmark scenarios.

## 4. Performance characteristics (§4.4)

Serialization cost is isolated two ways, both using each framework as its own control:

**Small payload** (`hello-world µs/req − that framework's own empty-response floor`):

| | NextRush | Fastify | Raw Node.js |
| --- | --- | --- | --- |
| Small-object serialize + write | **4.28 µs** | 4.37 µs | 5.61 µs |

**Large payload** (`large-json µs/req − that framework's own hello-world`) — isolates the marginal
cost of a bigger object, removing both the fixed floor and the small-write baseline:

| | NextRush | Fastify | Raw Node.js | Hono | Koa | Express |
| --- | --- | --- | --- | --- | --- | --- |
| Large-payload marginal cost | **17.51 µs** | 17.80 µs | 17.90 µs | 18.35 µs | 17.40 µs | 26.27 µs |

**Every framework except Express clusters within 1 µs.** They are all paying the same
`JSON.stringify` on the same shared payload object, and NextRush is marginally the cheapest of the
Node-adapter group. The Large JSON benchmark gap (−9.9% vs Fastify, −11.3% vs raw Node) is therefore
**entirely inherited from the fixed per-request floor** (P-01) and not attributable to serialization
at all.

This is the cleanest negative finding in the investigation: the arithmetic isolates a subsystem and
shows it contributes nothing to the gap.

## 5. Runtime behaviour (§4.5)

Per JSON response: one `JSON.stringify` result string, one `Buffer.byteLength` scan over that string,
one `String(number)` conversion, one header object literal, one `writeHead`, one `end`.

`Buffer.byteLength` is a second pass over the serialized string. It is required to emit an accurate
`Content-Length`, and the alternative — omitting `Content-Length` and letting Node choose chunked
framing — is measurably worse for small responses and is what the raw-node baseline does. Keeping it
is correct.

## 6. Bottleneck analysis (§4.6)

No measured bottleneck. Items reviewed and cleared:

| Reviewed | Finding |
| -------- | ------- |
| Double pass (`stringify` then `byteLength`) | Necessary for accurate `Content-Length`; the alternative is worse |
| Header construction | One object literal feeding one `writeHead` — the HP-14 trim; strictly better than two `setHeader` calls |
| `String(Buffer.byteLength(...))` | Node accepts a number for `Content-Length`; the explicit `String()` is a defensive conversion of negligible cost. `send()`'s branches pass the number directly, so there is a minor internal inconsistency but no measurable difference. |
| Per-type caching | None — correctly, since there is no schema to cache against |
| Circular references | `JSON.stringify` throws `TypeError`, propagating to the error handler |

## 7. Root cause candidates (§4.7)

Not applicable — no defect.

## 8. Optimisation opportunities (§4.8)

**Nothing to do now.** One forward-looking item, recorded so the decision is explicit rather than
accidental:

### Schema-compiled serialization (deferred, not recommended today)

Fastify's headline serialization advantage comes from `fast-json-stringify`, which compiles a JSON
schema into a specialised serializer function. **It is not engaged in this benchmark** — the Fastify
server returns plain objects with no response schema — which is exactly why the measured
serialization costs are at parity. The parity result therefore proves NextRush has no *current*
deficit; it does **not** prove NextRush could not gain from compiled serialization.

| | |
| --- | --- |
| **Potential** | 2–5× on serialization for schema-annotated routes, based on `fast-json-stringify`'s published characteristics. On the Large JSON scenario, serialization is 17.51 of 52.09 µs/req (34% of total cost), so even a 2× improvement there would be worth roughly 8.8 µs/req — larger than the entire P-01 floor finding. |
| **Prerequisite** | A response-schema surface. `@nextrush/openapi` already derives OpenAPI 3.1 from route metadata, and `@nextrush/validation` already integrates Standard Schema (Zod/Valibot/ArkType) for requests. The metadata substrate plausibly exists; a response-schema binding does not. |
| **Cost** | A new dependency or a hand-written compiler; a public API addition (therefore RFC-gated); a code-generation path that must be audited for injection via schema-derived property names; and a second serialization path to keep behaviourally identical to the default. |
| **Why deferred** | It is a **feature**, not a fix. It is large, it is RFC-gated, and it would be premature to build a compiled serializer while the framework still pays +7.59 µs on its fixed floor — the floor is cheaper to fix and benefits 100% of requests rather than only schema-annotated ones. Sequencing matters: fix the floor first, then measure again, then decide. |
| **Verdict** | **Phase 4 research item.** Not recommended for the current roadmap. |

## 9. Edge cases reviewed (§4.9)

| Case | Behaviour |
| ---- | --------- |
| `undefined` passed to `json()` | `JSON.stringify(undefined)` returns `undefined`; `Buffer.byteLength(undefined)` would throw — worth a targeted test, though no evidence of it occurring on any real path |
| Circular reference | `TypeError` propagates to the error handler |
| `BigInt` in payload | `JSON.stringify` throws `TypeError` |
| Non-ASCII content | `Buffer.byteLength` correctly counts UTF-8 bytes, not characters — so `Content-Length` is right |
| HEAD / 204 / 304 | `shouldSuppressBody()` → headers including `Content-Length` written, body omitted. Node's `writeHead` retains `Content-Length` (unlike the Fetch-family adapters, where `new Response(null)` drops it — a known cross-adapter divergence, F-03) |
| Very large payload | Single monolithic string allocation; no streaming serialization. Unmeasured beyond the benchmark's Large JSON payload. |

## 10. Investigation summary (§4.10)

| | |
| --- | --- |
| **Finding** | No performance defect. Serialization is at parity with Fastify and raw Node and marginally the cheapest of the Node-adapter group. The Large JSON benchmark gap is entirely inherited from the fixed per-request floor (P-01), not from serialization. |
| **Evidence** | Large-payload marginal cost 17.51 µs vs Fastify 17.80 / raw Node 17.90 / Hono 18.35 / Koa 17.40; small-object write 4.28 vs 4.37 / 5.61; `json()` read at HEAD confirming single `writeHead` + `end` |
| **Root cause** | n/a |
| **Runtime impact** | Serialization is ~34% of total request cost on Large JSON, but that share is identical across frameworks |
| **Performance impact** | No gap to close today |
| **Recommendation** | **Do not optimise.** Record parity. Revisit schema-compiled serialization as a Phase 4 research item **after** the floor is fixed and re-measured, and only via RFC. |
| **Trade-offs** | Compiled serialization would trade a new public API, a code-generation attack surface, and a second behavioural path for a gain that only schema-annotated routes see |
| **Priority** | None now; **Research** for Phase 4 |
| **Confidence** | Confirmed (measured parity + source read) for the current verdict; Hypothesis for the compiled-serializer upside |
| **Validation** | V-01 regression sweep must show Large JSON improving by the same absolute µs as Hello World when P-01 lands — if it does not, the floor attribution in this report is wrong and should be re-opened |

**Cross-references:** `response.md` (the write path `json()` shares), `01-benchmark-analysis.md` §5,
`07-optimization-roadmap.md` Phase 4.
