---
"@nextrush/adapter-serverless": minor
---

`@nextrush/adapter-serverless`: `createGoogleHandler` and `createAzureHandler` are now true
drop-ins — pass them directly to `functions.http('api', handler)` / `app.http('api', { handler })`
with no hand-written field mapping (RFC-027). The previous struct-based behavior is preserved
unchanged under `createGoogleEventHandler` / `createAzureEventHandler`. **Breaking** for direct
callers of the old `createGoogleHandler`/`createAzureHandler` struct signature — rename to
`createGoogleEventHandler`/`createAzureEventHandler` to keep current behavior unchanged, or delete
your hand-written bridge to adopt the drop-in. Permitted without a major bump per this package's
`Internal` tier (ADR-0005).
