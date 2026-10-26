---
'@nextrush/types': minor
'@nextrush/core': minor
'@nextrush/runtime': minor
'@nextrush/adapter-bun': minor
'@nextrush/adapter-deno': minor
'@nextrush/adapter-edge': minor
'@nextrush/router': patch
---

**A route that finishes synchronously now answers with a `Response` instead of a promise, so Bun
stops paying a microtask hop the runtime never needed.**

**What changes.** `createWebRunner` returns `Response | Promise<Response>`, and `createHandler` in
the Bun, Deno and edge adapters follows that type. When the application's only middleware is the
mounted router and the route executor reports that the handler settled without leaving work
pending, the runner builds the response and returns it directly. Every other shape — application
middleware, per-route middleware, an async handler, a throw — takes the existing promise path
unchanged, timeout race included.

**Why it is safe to answer early.** The new `Application.syncDispatchSafe` getter is true only when
the middleware stack is exactly one entry *and* that entry is a router dispatch mounted at the root.
That middleware returns the executor's promise directly and never resumes after the handler, so
nothing can mutate the response once the handler returns. A middleware registered ahead of the
router can resume after `next()`, which is why a stack with two or more entries never takes the
path — even when every middleware in it happens to be synchronous. The executor sets its marker
only in the no-per-route-middleware branch, and only when the handler returned without a promise; a
throw produces a rejection and no marker.

**Compatibility.** Runtime behaviour is unchanged: callers that `await` the handler still work,
because a `Response` awaits to itself. The type widening is source-visible for code that stores the
return value in a `Promise<Response>`-typed variable; annotate it as `Response | Promise<Response>`
(the adapters' own `BunFetchHandler` and `FetchHandler` types already do). `Bun.serve`, `Deno.serve`
and the edge runtimes all accept either shape.

**Measured (`wrk -t2 -c64`, server pinned to one core, paired order-flipped, CPU µs/request from
`/proc/<pid>/stat`).** Bun GET: 14.86 → 13.20 µs (−11.7 %, 5/5 pairs). Deno GET: 12.75 → 11.44 µs
(−6.8 %, 3/3). Deno POST: 36.59 → 34.76 µs (−2.9 %, 3/3). Bun POST and Node GET/POST: unchanged
within noise (Bun POST keeps its `bodyParser` middleware, so the chain is genuinely asynchronous and
the path does not apply). Node is unaffected because its adapter owns a callback-based runner.
