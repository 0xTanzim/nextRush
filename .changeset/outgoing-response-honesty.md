---
'@nextrush/compression': minor
'@nextrush/timer': patch
---

**Response-aware middleware reads one response shape, never the parsed request body, and the timer's
documented default now matches what it does.**

`@nextrush/compression` had two sources for the response it wanted to compress: `ctx.body` and
`raw.res.body`. The first is the **parsed request body**. So on a request whose response type was
already visible when the middleware resumed — a middleware that declares `Content-Type` before
`await next()` — a 20 KB POST was gzipped once as if it were the response, and the write that followed
failed because the response had already been sent. The second source is a slot no adapter fills, which
is why every shipped adapter compressed nothing and said nothing.

Both reads are replaced by a single declared shape: the outgoing response the adapter still exposes
(`raw.res`, marked by `getHeader`), from which the middleware reads headers and the buffered body — and
only that. When no outgoing body exists, it does **not** substitute the request body; it returns and
reports the situation **once per process**:

```
[@nextrush/compression] no outgoing body available: a response written with
ctx.json()/send()/html() is committed before this middleware runs, so it cannot
be compressed. ...
```

There is nothing compression can act on today: the Node adapter writes and ends the response inside the
handler, and the Web adapters record it privately and build the `Response` after the chain unwinds. No
longer silent, and no longer capable of touching a request body. The package README states the
limitation and the real-adapter tests pin it.

`@nextrush/timer` keeps `exposeHeader` defaulting to `false`, and its JSDoc and README examples now pass
`exposeHeader: true` — the earlier examples showed a header the default does not produce. The reason the
default is `false` is now stated plainly: the header is written after the handler has responded, which
lands on the Web adapters and cannot land on the Node adapter, where the response is already on the wire.
`serverTiming()` is documented the same way, and a real-adapter test locks both behaviours.

For adapter authors, `ConformanceDriver` gains `honorsPostHandlerHeaderWrite` — `false` for Node, `true`
for the Web family, serverless, and Next.js — and conformance scenario `#29` asserts the **observed**
behaviour agrees with the declared value, so an adapter that changes under the framework fails
conformance instead of silently flipping. A driver implementation must declare the new flag.
