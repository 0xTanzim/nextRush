---
"@nextrush/adapter-serverless": minor
"@nextrush/adapter-edge": patch
"@nextrush/runtime": patch
"@nextrush/types": patch
---

`@nextrush/adapter-serverless`: `createGoogleHandler` and `createAzureHandler` are now true
drop-ins — pass them directly to `functions.http('api', handler)` / `app.http('api', { handler })`
with no hand-written field mapping (RFC-027). The previous struct-based behavior is preserved
unchanged under `createGoogleEventHandler` / `createAzureEventHandler`. **Breaking** for direct
callers of the old `createGoogleHandler`/`createAzureHandler` struct signature — rename to
`createGoogleEventHandler`/`createAzureEventHandler` to keep current behavior unchanged, or delete
your hand-written bridge to adopt the drop-in. Permitted without a major bump per this package's
`Internal` tier (ADR-0005).

Adds `ctx.platform` (`PlatformId | undefined`) across `@nextrush/adapter-edge` and
`@nextrush/adapter-serverless`, orthogonal to the unchanged `ctx.runtime` (RFC-026). Each
serverless Tier-1 handler (`createLambdaHandler`/`createGoogleHandler`/`createAzureHandler`) sets
it explicitly to its own known platform; `@nextrush/adapter-edge`'s Cloudflare/Vercel/Netlify
handlers detect it via the new `detectPlatform()` in `@nextrush/runtime`. Fully additive — no
existing type or value changes.
