---
'@nextrush/core': minor
'@nextrush/router': minor
'@nextrush/runtime': minor
'@nextrush/types': minor
'nextrush': minor
---

feat(core,runtime,router): add universal fetch (`app.fetch`) and multi-prefix mounting (#74, #77)

- **Universal Fetch (`app.fetch`)**: Instance-bound Web standards request handler on `Application` enabling direct zero-boilerplate export (`export default app;` / `export default { fetch: app.fetch }`) across Bun, Cloudflare Workers, Vercel Edge, Deno, and Web standard fetch unit tests without manual adapter imports.
- **Multi-Runtime Signature Normalization**: `UniversalWebContext` transparently normalizes 5 runtime signatures (1-arg `fetch(req)`, Cloudflare Workers `(req, env, ctx)` with `ctx.env` and `ctx.waitUntil`, Vercel Edge `(req, ctx)` with `ctx.waitUntil`, Bun `(req, server)` with `server.requestIP`, and Deno `(req, info)` with `info.remoteAddr`).
- **Zero Overhead on Traditional Servers**: Lazily initialized fetch runner ensures Node.js `listen(app, port)` servers incur zero allocations, zero CPU overhead, and zero timer scheduling.
- **Multi-Prefix Router Mounting**: `app.route(prefixes, router)` and `router.mount(prefixes, subRouter)` accept arrays of path prefixes (e.g. `['/api', '/v1']`), normalizing slashes and deduplicating prefixes automatically.
