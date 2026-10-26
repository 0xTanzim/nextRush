# Proposal

## Why

NextRush builds every Web response through a `Headers` instance and labels every JSON body
`application/json; charset=utf-8`. Two measured facts make that pair expensive:

1. **The `Headers` instance is per-request garbage.** `buildResponse` allocated one `Headers` plus one
   `has()` and one `set()` for responses that carry nothing but a content type — the dominant response
   shape. An isolated Deno probe puts the whole construction at **1.019 µs/response**, against 0.230 µs
   for a plain init record.
2. **Deno's `Response` constructor has a static fast path that the framework's media type misses.**
   `ext/fetch/23_response.js` skips header-list validation and the native re-map only when the init
   record is a plain object with exactly one header named `content-type` whose value is one of
   `"text/plain"`, `"text/plain;charset=UTF-8"`, `"application/json"`. The framework's
   `application/json; charset=utf-8` is not in that list, so every JSON response paid the slow path.

The two changes are complementary, not independent: the plain init record supplies the *shape* Deno
requires, and the bare media type supplies the *value* it accepts. Measured alone, each is worth
little; together they are worth **−16.6% server CPU per request on Deno GET** and **−8.1% on Deno
POST**, with no regression on Bun or Node.

The media type is also wrong on its own terms. RFC 8259 §8.1 defines no `charset` parameter for
`application/json`, and the frameworks this repository benchmarks against already send the bare
value: Hono 4.13.0's `c.json()` sends `application/json`, and Express 5.2.1's `res.json()` sends
`application/json`. Only Fastify sends the parameterised form. The archived conformance rule
(F-05) forbade a *bare* `application/json` only because adapters drifted — Edge and Bun's
server-level error path emitted bare while the rest emitted the parameterised form. Routing every
adapter through one shared helper that emits the bare value keeps the uniformity the rule was
protecting and removes the drift instead of preserving it.

## What Changes

**BREAKING** — the framework's JSON responses change media type on the wire.

- Change the framework-generated JSON media type from `application/json; charset=utf-8` to
  `application/json` in `@nextrush/runtime` (`response-builder.ts`, `response-body.ts`) and
  `@nextrush/adapter-node` (`context.ts`, `adapter.ts`), so every adapter emits one value.
- Build the Web response from a plain init record when the recorded response carries no header
  beyond its content type, keeping the `Headers` path for every response that carries extra headers
  (so multi-value `Set-Cookie` is preserved exactly).
- Declare the context's constructor-assigned fields with `declare`, so `useDefineForClassFields`
  stops emitting a per-instance define that the constructor immediately overwrites.
- Update the conformance suite and the affected package tests to the new media type, and record the
  migration note for applications that assert the exact header string.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `node-adapter` — the JSON response's `Content-Type` scenario now names the shared media type.
- `web-adapters` — adds the shared JSON media type and the plain-init-record construction rule, and
  the cross-adapter parity gate for both.

## Impact

- **Affected packages:** `@nextrush/runtime`, `@nextrush/adapter-node`, `@nextrush/adapter-bun`,
  `@nextrush/adapter-deno`, `@nextrush/adapter-edge`, `@nextrush/adapter-serverless`,
  `@nextrush/adapter-conformance`.
- **Affected audiences:** Application developers (the wire header value changes); Adapter authors
  (the shared media type is now a contract); Contributors.
- **Explicitly NOT affected:** request parsing, routing, middleware ordering, `ctx.next()`, body
  limits, raw-body bytes, streaming, error status mapping, and every non-JSON media type.
- **Governing documents:** `docs/RFC/runtime-adapters/046-json-media-type-and-response-construction.md`,
  `docs/adr/ADR-0034-json-media-type-and-response-construction.md`.
