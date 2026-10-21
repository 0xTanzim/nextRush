---
'@nextrush/runtime': major
'@nextrush/core': major
'@nextrush/router': major
'@nextrush/types': major
'@nextrush/errors': major
'@nextrush/di': major
'@nextrush/adapter-node': major
'@nextrush/adapter-bun': major
'@nextrush/adapter-deno': major
'@nextrush/adapter-edge': major
'@nextrush/adapter-serverless': major
'@nextrush/adapter-nextjs': major
'nextrush': major
---

**BREAKING** — a JSON response's `Content-Type` is now `application/json`, with no `charset`
parameter.

**What changes.** Every framework-generated JSON response — a handler's `ctx.json()`, an object
passed to `ctx.send()`, and the framework's own `404`/`500`/`504` envelope — carries
`content-type: application/json` on every adapter. It previously carried
`application/json; charset=utf-8`.

```ts
// Before
expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
// After
expect(res.headers.get('content-type')).toBe('application/json');
```

**Why.** RFC 8259 §8.1 registers `application/json` with no parameters — JSON is UTF-8 by
definition, so a `charset` parameter is one the specification does not define. Hono 4.13.0 and
Express 5.2.1 already send the bare value; only Fastify sends the parameterised form. The earlier
conformance rule that pinned the parameterised value existed to stop adapters drifting apart — Edge
and Bun's server-level error path emitted a bare `application/json` while the shared helper emitted
the parameterised form. Every adapter now goes through the one shared helper that emits the bare
value, so the uniformity is preserved and the drift is gone.

**Migration.** Applications that only *parse* the media type are unaffected: JSON parsing keys off
the `application/json` type, and the `charset` parameter was never required for it. Only an
exact-string comparison needs updating. The value is now identical on every adapter, so one
assertion update covers all of them.

**What does not change.** The status, the body bytes, `Content-Length`, the header set, the
multi-value `Set-Cookie` behaviour, `text/plain` and `text/html`, and every other response
behaviour. Request parsing, routing, middleware ordering, `ctx.next()`, body limits, raw-body bytes,
UTF-8 correctness, caching, streaming, and error status mapping are all untouched.

**Why the bump is major.** The header value is observable by clients, and a client that asserts the
exact string must change. The change also removes a per-request `Headers` allocation from every Web
response, and the bare media type lets Deno's `Response` constructor take its static fast path —
together **−16.6 % server CPU per request on Deno GET** and −8.1 % on Deno POST, measured against
the previous release, with no regression on Bun or Node.

**The request deadline no longer costs a timer per request.** A request that waits on I/O — a body
read, a database call — is still pending when the timeout window opens, so the framework armed a
`setTimeout` for it and cleared it when the request settled. That pair costs 2.15 µs on Deno
against 0.16 µs on Bun, and it measured **8.28 µs of server CPU per request on Deno POST (+29.8 %)**.
The deadline is now served by one shared timer per runner: the deadline value, the `504`, the
`ctx.signal` cancellation, and the late-rejection guard are unchanged, and the measured effect is
**−13.8 % on Deno POST and −10.4 % on Bun POST**, with no change on the GET fast path.
