# Context API (accurate)

Implemented primarily by `WebContextBase` (`@nextrush/runtime`). Adapters subclass for IP/runtime/stream wiring.

## Request fields

```typescript
ctx.method: HttpMethod
ctx.url: string              // pathname + search
ctx.path: string             // pathname only
ctx.query: QueryParams       // lazily parsed on first read, memoized
ctx.bodyLength?: number      // declared content-length when known (Web context)
ctx.readBody<T>(): Promise<T> // read + parse once; shares an in-flight read
ctx.params: RouteParams      // route params (set by router)
ctx.headers: IncomingHeaders // lowercased record
ctx.get(field: string): string | undefined
ctx.body: unknown            // after body-parser / multipart
ctx.bodySource               // low-level body reader
ctx.ip: string               // adapter policy; may be '' on edge without trustProxy
ctx.runtime: Runtime
ctx.platform: PlatformId | undefined
ctx.state: ContextState       // mutable per-request bag
ctx.signal: AbortSignal      // client disconnect + timeout
ctx.env?: Env                // Cloudflare bindings when provided
ctx.raw: { req: Request; res?: unknown }  // lazy; res undefined on web adapters
```

## Response

```typescript
ctx.status = 200             // default 200; an explicit status argument also updates it
ctx.set(field, value)        // string | number | string[]
ctx.json(data, statusOrOptions?)    // application/json
ctx.send(data, statusOrOptions?)    // ResponseBody auto
ctx.html(content, statusOrOptions?) // text/html
ctx.redirect(url, status?)   // default 302
ctx.responded: boolean
ctx.getResponse(): Response  // build final Web Response (adapter)
ctx.markResponded()
```

### Per-call status and headers (RFC-048)

`ctx.json`, `ctx.html` and `ctx.send` accept a second argument: a numeric status, or
`{ status?, headers? }`.

```typescript
ctx.json({ users });                                   // carried status (default 200)
ctx.json({ id: 'u_123' }, 201);                        // numeric shorthand
ctx.json({ id: 'u_123' }, {
  status: 201,
  headers: { Location: '/users/u_123', 'Cache-Control': 'no-store' },
});
ctx.status = 201; ctx.json({ id: 'u_123' });           // still supported
```

- Precedence: explicit status → carried `ctx.status` → `200`. The explicit value is written **back**
  onto `ctx.status`, so post-handler middleware (logging, metrics) reads the status that was sent.
- Accepted statuses: integers `200`–`599`. Anything else throws `RangeError` before the response is
  committed (the error handler can still answer).
- `headers` merge with recorded headers: an ordinary field overrides its earlier value, `Set-Cookie`
  accumulates, an array replaces then appends, and a supplied `Content-Type` beats the helper default.
- `Content-Length` in `headers` throws — the framework derives it from the body.
- `204`/`304`/HEAD still suppress the body, and a call after the response is committed changes
  nothing (including `ctx.status`).

## Streaming

```typescript
await ctx.stream(run)        // text stream writer
await ctx.sse(run)           // SSE writer { data, event?, id?, retry? }
await ctx.ndjson(run)        // NDJSON writer
await ctx.sendStream(readable: ReadableStream<Uint8Array>)
```

## Control flow

```typescript
await ctx.next()             // continue middleware chain
// Middleware signature often (ctx, next) => ...; both styles exist depending on compose path
```

## Errors

```typescript
ctx.throw(status: number, message?: string): never   // throws HttpError
ctx.assert(condition, status, message?): asserts condition
```

## Background (edge / next)

```typescript
ctx.waitUntil?.(promise)     // when execution context exists; else no-op
```

## Do NOT invent

These are **not** standard NextRush Context helpers:

- `ctx.ok()`, `ctx.created()`, `ctx.badRequest()`, …
- `ctx.text()` may exist on some builders — prefer `ctx.send` / `ctx.html` / `ctx.json` from WebContextBase
- Express-style `res.end`

Use:

```typescript
ctx.status = 201;
ctx.json(payload);
// or
ctx.throw(400, 'invalid');
```

## Cookies

`ctx.cookies` is a first-class, fully typed capability present on every context
(RFC-034) — no casts, no `?.`. Before `cookies()` runs, property access is safe but
every operation throws `CapabilityNotInitializedError` with a WHAT/WHY/HOW/WHERE
diagnostic. Signed cookies live at `ctx.cookies.signed`, activated by `signedCookies()`
(which requires `cookies()` first). The `ctx.state.cookies` /
`ctx.state.signedCookies` aliases are deprecated — see middleware.md.
